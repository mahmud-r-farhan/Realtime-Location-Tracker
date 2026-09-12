const { verifySession, parseSessionCookie } = require('../routes/routes');

// ---------------------------------------------------------------------------
// Input sanitization
// ---------------------------------------------------------------------------

// Control characters that have no business in user-provided text
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// Strips <script>/<style> blocks (with content), then any remaining tags.
// Stray angle brackets are kept as literal text - every client render path
// escapes via textContent/escapeHtml, so they can never form markup.
// Whitespace is collapsed since removed blocks leave gaps behind.
function stripTags(input) {
    return input
        .replace(/<script[\s\S]*?<\/script\s*>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style\s*>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(CONTROL_CHARS, '')
        .trim();
}

function sanitizeString(str, maxLength = 50) {
    if (typeof str !== 'string') return '';
    return stripTags(str).trim().substring(0, maxLength);
}

// Whitelists deviceInfo: only known keys, sanitized primitive values.
// Never trust arbitrary nested objects from clients - they are rebroadcast
// to every peer in the room and rendered into the DOM.
const DEVICE_INFO_STRING_KEYS = ['deviceType', 'os', 'browser', 'screen', 'connection', 'memory', 'cores'];
const DEVICE_INFO_STRING_MAX = 100;

function sanitizeDeviceInfo(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

    const info = {};
    for (const key of DEVICE_INFO_STRING_KEYS) {
        const value = sanitizeString(raw[key], DEVICE_INFO_STRING_MAX);
        if (value) info[key] = value;
    }

    if (raw.battery && typeof raw.battery === 'object' && !Array.isArray(raw.battery)) {
        const level = Math.round(Number(raw.battery.level));
        if (Number.isFinite(level)) {
            info.battery = {
                level: Math.max(0, Math.min(100, level)),
                charging: Boolean(raw.battery.charging)
            };
        }
    }
    return info;
}

// ---------------------------------------------------------------------------
// Client IP resolution
// ---------------------------------------------------------------------------

// Proxy headers are only trusted when the app actually runs behind a proxy
// (production). Otherwise any client could spoof the IP shown to other users.
function getClientIP(socket) {
    const handshake = socket.handshake;
    if (!handshake) return 'Unknown';

    if (process.env.NODE_ENV === 'production') {
        const forwardedFor = handshake.headers['x-forwarded-for'];
        if (forwardedFor) {
            const firstHop = String(forwardedFor).split(',')[0].trim();
            if (firstHop) return firstHop;
        }
        const realIP = handshake.headers['x-real-ip'];
        if (realIP) return String(realIP).trim();

        const cfIP = handshake.headers['cf-connecting-ip'];
        if (cfIP) return String(cfIP).trim();
    }

    let address = handshake.address;
    if (typeof address === 'string' && address.startsWith('::ffff:')) {
        address = address.substring(7);
    }
    return address || 'Unknown';
}

function getDevicesInRoom(connectedDevices, room) {
    const devices = [];
    for (const [id, data] of connectedDevices) {
        if (data.room === room) devices.push([id, data]);
    }
    return devices;
}

// ---------------------------------------------------------------------------
// Per-socket event rate limiting (sliding window)
// Protects rooms from chat/SOS/location floods that WebSockets would
// otherwise relay for free.
// ---------------------------------------------------------------------------
const EVENT_RATE_LIMITS = {
    'send-location': { max: 120, windowMs: 60_000 },
    'chat-message': { max: 20, windowMs: 60_000 },
    'sos-alert': { max: 5, windowMs: 60_000 },
    'request-join-call': { max: 4, windowMs: 60_000 }
};

function isRateLimited(socket, event) {
    const limit = EVENT_RATE_LIMITS[event];
    if (!limit) return false;

    const now = Date.now();
    if (!socket._rateWindow) socket._rateWindow = new Map();

    let timestamps = socket._rateWindow.get(event);
    if (!timestamps) {
        timestamps = [];
        socket._rateWindow.set(event, timestamps);
    }

    // Drop timestamps outside the current window
    while (timestamps.length > 0 && timestamps[0] <= now - limit.windowMs) {
        timestamps.shift();
    }

    if (timestamps.length >= limit.max) return true;

    timestamps.push(now);
    return false;
}

function broadcastRoomStats(io, connectedDevices, room) {
    const devicesInRoom = getDevicesInRoom(connectedDevices, room);
    io.to(room).emit('update-device-list', devicesInRoom);
    io.to(room).emit('update-user-count', devicesInRoom.length);
}

// ---------------------------------------------------------------------------
// WebRTC payload validation - signaling data is relayed to other peers,
// so shape and size must be checked before relaying. The expected SDP type
// is enforced per event to avoid signaling-state confusion between peers.
// ---------------------------------------------------------------------------
function isValidSessionDescription(description, expectedType) {
    return !!description &&
        typeof description === 'object' &&
        description.type === expectedType &&
        typeof description.sdp === 'string' &&
        description.sdp.length > 0 &&
        description.sdp.length <= 100_000;
}

function isValidIceCandidate(candidate) {
    return !!candidate &&
        typeof candidate === 'object' &&
        typeof candidate.candidate === 'string' &&
        candidate.candidate.length <= 2000 &&
        (candidate.sdpMid === null || candidate.sdpMid === undefined || typeof candidate.sdpMid === 'string') &&
        (candidate.sdpMLineIndex === null || candidate.sdpMLineIndex === undefined ||
            (Number.isInteger(candidate.sdpMLineIndex) && candidate.sdpMLineIndex >= 0));
}

module.exports = function setupSockets(io, connectedDevices, peers) {
    // Require the signed session cookie issued by the web app before allowing a connection.
    // This prevents unauthenticated clients (e.g. scripts hitting the socket endpoint directly)
    // from connecting without ever obtaining a server-verified identity.
    io.use((socket, next) => {
        if (verifySession(parseSessionCookie(socket.handshake.headers.cookie))) {
            return next();
        }
        next(new Error('Unauthorized: valid session required'));
    });

    io.on('connection', (socket) => {
        socket.clientIP = getClientIP(socket);
        socket.room = 'public';

        socket.on('join-room', (data) => {
            const rawRoom = data && data.room ? data.room : 'public';
            const rawDeviceName = data && data.deviceName ? data.deviceName : 'Unknown';

            const roomName = sanitizeString(rawRoom, 50) || 'public';
            const deviceName = sanitizeString(rawDeviceName, 50) || 'Unknown';

            const previousRoom = socket.room;

            if (previousRoom !== roomName) {
                // Keep the device registry consistent so the old room's list
                // drops this device immediately instead of waiting for the
                // next location update.
                const existing = connectedDevices.get(socket.id);
                if (existing) existing.room = roomName;

                socket.leave(previousRoom);
                socket.join(roomName);
                socket.room = roomName;

                if (previousRoom) {
                    broadcastRoomStats(io, connectedDevices, previousRoom);
                }
            }

            socket.deviceName = deviceName;

            socket.emit('joined-room', { room: roomName });
            broadcastRoomStats(io, connectedDevices, roomName);
        });

        socket.on('send-location', (data) => {
            if (!data || isRateLimited(socket, 'send-location')) return;

            if (data.latitude === undefined || data.longitude === undefined) {
                return;
            }

            const lat = parseFloat(data.latitude);
            const lng = parseFloat(data.longitude);
            const acc = parseFloat(data.accuracy) || 0;

            if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                return;
            }

            if (!socket.room) {
                socket.join('public');
                socket.room = 'public';
            }

            const rawName = data.deviceName || socket.deviceName || 'Unknown';
            const sanitizedDeviceName = sanitizeString(rawName, 50) || 'Unknown';

            const deviceData = {
                latitude: lat,
                longitude: lng,
                deviceName: sanitizedDeviceName,
                accuracy: Math.max(0, Math.min(acc, 10000)),
                deviceInfo: sanitizeDeviceInfo(data.deviceInfo),
                ip: socket.clientIP,
                joinedAt: new Date(),
                room: socket.room
            };

            connectedDevices.set(socket.id, deviceData);
            socket.deviceName = sanitizedDeviceName;

            io.to(socket.room).emit('receive-location', { id: socket.id, ...deviceData });
            broadcastRoomStats(io, connectedDevices, socket.room);
        });

        socket.on('request-device-location', (id) => {
            if (typeof id !== 'string' || id.length === 0 || id.length > 100) return;

            const device = connectedDevices.get(id);
            if (device && device.room === socket.room) {
                socket.emit('focus-device-location', { id, ...device });
            }
        });

        socket.on('chat-message', (data, callback) => {
            if (isRateLimited(socket, 'chat-message')) {
                if (typeof callback === 'function') {
                    callback({ error: 'Sending too fast. Please slow down.' });
                }
                return;
            }

            if (!data || typeof data.text !== 'string' || !data.text.trim()) {
                if (typeof callback === 'function') {
                    callback({ error: 'Invalid message text' });
                }
                return;
            }

            const room = socket.room || 'public';
            const sanitizedText = sanitizeString(data.text, 1000);
            if (!sanitizedText) {
                if (typeof callback === 'function') {
                    callback({ error: 'Empty message' });
                }
                return;
            }

            const rawSender = data.sender || socket.deviceName || 'Unknown';
            const senderName = sanitizeString(rawSender, 50) || 'Unknown';

            const messageData = {
                id: `${Date.now()}-${socket.id}`,
                text: sanitizedText,
                sender: senderName,
                senderId: socket.id,
                timestamp: Date.now(),
                room: room
            };

            io.to(room).emit('chat-message', messageData);

            if (typeof callback === 'function') {
                callback({ success: true, messageId: messageData.id });
            }
        });

        socket.on('sos-alert', (data, callback) => {
            // Optional ack: tells the sender whether the alert was relayed and
            // returns the public IP the server sees (clients cannot know it).
            const respond = (payload) => {
                if (typeof callback === 'function') callback(payload);
            };

            if (!data || !data.location) {
                respond({ error: 'Invalid SOS payload' });
                return;
            }

            if (isRateLimited(socket, 'sos-alert')) {
                respond({ error: 'Too many SOS alerts sent. Please wait a minute.' });
                return;
            }

            const room = socket.room || 'public';
            const rawSender = data.sender || socket.deviceName || 'Unknown';
            const sanitizedSender = sanitizeString(rawSender, 50) || 'Unknown';

            const lat = parseFloat(data.location.latitude);
            const lng = parseFloat(data.location.longitude);
            const acc = parseFloat(data.location.accuracy) || 0;

            // An SOS without usable coordinates is still broadcast, but with
            // clamped, non-hostile numbers.
            const safeLat = Number.isFinite(lat) ? Math.max(-90, Math.min(90, lat)) : 0;
            const safeLng = Number.isFinite(lng) ? Math.max(-180, Math.min(180, lng)) : 0;

            const sosData = {
                id: `sos-${Date.now()}-${socket.id}`,
                sender: sanitizedSender,
                senderId: socket.id,
                location: {
                    latitude: safeLat,
                    longitude: safeLng,
                    accuracy: Math.max(0, Math.min(acc, 10000))
                },
                // False only when the sender explicitly reports no usable GPS
                // fix; the alert is still relayed so people know there is an
                // emergency even without coordinates.
                locationAvailable: data.locationAvailable !== false,
                deviceInfo: sanitizeDeviceInfo(data.deviceInfo),
                ipInfo: {
                    ip: socket.clientIP
                },
                message: 'Emergency SOS Alert!',
                timestamp: Date.now(),
                room: room
            };

            socket.to(room).emit('sos-alert', sosData);
            respond({ success: true, ip: socket.clientIP });
        });

        // Audio & WebRTC signaling
        socket.on('join-audio', () => {
            const room = socket.room || 'public';

            const currentPeers = [];
            for (const [peerId, peerData] of peers) {
                if (peerId !== socket.id && peerData.room === room) {
                    currentPeers.push({ peerId, userName: peerData.deviceName });
                }
            }

            peers.set(socket.id, { socket, deviceName: socket.deviceName || 'Unknown', room: room });

            socket.emit('audio-peers', currentPeers);
            socket.to(room).emit('user-connected', {
                peerId: socket.id,
                userName: socket.deviceName || 'Unknown'
            });
        });

        socket.on('leave-audio', () => {
            if (!peers.has(socket.id)) return;

            const room = socket.room || 'public';
            peers.delete(socket.id);

            socket.to(room).emit('user-disconnected', {
                peerId: socket.id,
                userName: socket.deviceName || 'Unknown'
            });
        });

        socket.on('request-join-call', () => {
            if (isRateLimited(socket, 'request-join-call')) return;

            const room = socket.room || 'public';
            const senderName = socket.deviceName || 'A user';

            socket.to(room).emit('request-join-call', {
                senderId: socket.id,
                senderName: senderName
            });
        });

        socket.on('offer', ({ target, description } = {}) => {
            if (typeof target !== 'string' || !isValidSessionDescription(description, 'offer')) return;
            const peer = peers.get(target);
            if (peer && peer.room === socket.room) {
                peer.socket.emit('offer', {
                    peerId: socket.id,
                    description
                });
            }
        });

        socket.on('answer', ({ target, description } = {}) => {
            if (typeof target !== 'string' || !isValidSessionDescription(description, 'answer')) return;
            const peer = peers.get(target);
            if (peer && peer.room === socket.room) {
                peer.socket.emit('answer', {
                    peerId: socket.id,
                    description
                });
            }
        });

        socket.on('ice-candidate', ({ target, candidate } = {}) => {
            if (typeof target !== 'string' || !isValidIceCandidate(candidate)) return;
            const peer = peers.get(target);
            if (peer && peer.room === socket.room) {
                peer.socket.emit('ice-candidate', {
                    peerId: socket.id,
                    candidate
                });
            }
        });

        socket.on('disconnect', () => {
            if (socket._rateWindow) socket._rateWindow.clear();

            const deviceData = connectedDevices.get(socket.id);
            const wasInAudio = peers.has(socket.id);
            const room = (deviceData && deviceData.room) || socket.room || 'public';

            if (deviceData) {
                io.to(room).emit('user-disconnect', {
                    peerId: socket.id,
                    userName: deviceData.deviceName
                });
            }

            if (wasInAudio) {
                io.to(room).emit('user-disconnected', {
                    peerId: socket.id,
                    userName: (deviceData && deviceData.deviceName) || 'Unknown'
                });
            }

            connectedDevices.delete(socket.id);
            peers.delete(socket.id);

            broadcastRoomStats(io, connectedDevices, room);
        });
    });
};

// Exported for testing
module.exports.sanitizeString = sanitizeString;
module.exports.sanitizeDeviceInfo = sanitizeDeviceInfo;
