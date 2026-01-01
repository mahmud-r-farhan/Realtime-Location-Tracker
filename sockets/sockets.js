const sanitizeHtml = require('sanitize-html');

function getClientIP(socket) {
    const handshake = socket.handshake;
    // Check X-Forwarded-For header (common proxy header)
    const forwardedFor = handshake.headers['x-forwarded-for'];
    if (forwardedFor) {
        // X-Forwarded-For can contain multiple IPs, take the first one (original client)
        const ips = forwardedFor.split(',').map(ip => ip.trim());
        return ips[0];
    }
    // Check X-Real-IP header (used by some proxies like nginx)
    const realIP = handshake.headers['x-real-ip'];
    if (realIP) {
        return realIP;
    }
    // Check CF-Connecting-IP for Cloudflare
    const cfIP = handshake.headers['cf-connecting-ip'];
    if (cfIP) {
        return cfIP;
    }
    let address = handshake.address;
    // Handle IPv6 mapped IPv4 (::ffff:192.168.1.1)
    if (address && address.startsWith('::ffff:')) {
        address = address.substring(7);
    }
    return address || 'Unknown';
}

function getDevicesInRoom(connectedDevices, room) {
    return Array.from(connectedDevices.entries())
        .filter(([_, data]) => data.room === room);
}

module.exports = function setupSockets(io, connectedDevices, peers) {
    io.on('connection', (socket) => {
        // Get client IP on connection
        const clientIP = getClientIP(socket);
        socket.clientIP = clientIP;
        socket.room = 'public'; // Default room

        console.log(`User connected: ${socket.id} (IP: ${clientIP})`);

        socket.on('join-room', (data) => {
            const roomName = data && data.room ? sanitizeHtml(data.room) : 'public';
            const deviceName = data && data.deviceName ? sanitizeHtml(data.deviceName) : 'Unknown';

            socket.join(roomName);
            socket.room = roomName;
            socket.deviceName = deviceName;

            console.log(`User ${socket.id} joined room: ${roomName}`);

            // Notify user they joined
            socket.emit('joined-room', { room: roomName });

            // Send current devices in this room to the new user
            const devicesInRoom = getDevicesInRoom(connectedDevices, roomName);
            socket.emit('update-device-list', devicesInRoom);
            io.to(roomName).emit('update-user-count', devicesInRoom.length); // Approximate count based on devices sharing location
        });

        socket.on('send-location', (data) => {
            if (!data || !data.latitude || !data.longitude || !data.deviceName) {
                console.warn(`Invalid location data from ${socket.id}`);
                return;
            }
            // Ensure socket is in a room. If send-location comes before join-room, default to public
            if (!socket.room) {
                socket.join('public');
                socket.room = 'public';
            }

            const sanitizedDeviceName = sanitizeHtml(data.deviceName, {
                allowedTags: [],
                allowedAttributes: {}
            });
            const deviceData = {
                latitude: data.latitude,
                longitude: data.longitude,
                deviceName: sanitizedDeviceName,
                accuracy: data.accuracy,
                deviceInfo: data.deviceInfo || {},
                ip: socket.clientIP, // Add IP address
                joinedAt: new Date(),
                room: socket.room // Store room
            };
            connectedDevices.set(socket.id, deviceData);
            socket.deviceName = sanitizedDeviceName;

            // Emit ONLY to room
            io.to(socket.room).emit('receive-location', { id: socket.id, ...deviceData });

            const devicesInRoom = getDevicesInRoom(connectedDevices, socket.room);
            io.to(socket.room).emit('update-device-list', devicesInRoom);
            io.to(socket.room).emit('update-user-count', devicesInRoom.length);
        });

        socket.on('request-device-location', (id) => {
            const device = connectedDevices.get(id);
            // Only allow if in same room
            if (device && device.room === socket.room) {
                socket.emit('focus-device-location', { id, ...device });
            } else {
                console.warn(`Device ${id} not found or in different room for request from ${socket.id}`);
            }
        });

        socket.on('chat-message', (data, callback) => {
            if (!data || !data.text || !socket.deviceName) {
                console.warn(`Invalid chat message from ${socket.id}`);
                return callback && callback({ error: 'Invalid message data' });
            }
            // Ensure room
            const room = socket.room || 'public';

            const sanitizedText = sanitizeHtml(data.text, {
                allowedTags: [],
                allowedAttributes: {}
            });

            // Use sender from data if available (supports instant profile updates), else socket.deviceName
            const senderName = data.sender ? sanitizeHtml(data.sender) : (socket.deviceName || 'Unknown');

            const messageData = {
                id: Date.now(),
                text: sanitizedText,
                sender: senderName,
                senderId: socket.id, // Add sender ID for location tracking
                timestamp: Date.now(),
                room: room
            };

            // Broadcast to room
            io.to(room).emit('chat-message', messageData);

            if (callback) {
                callback({ success: true, messageId: messageData.id });
            }
        });

        // SOS Alert Handler
        socket.on('sos-alert', (data) => {
            if (!data || !data.location || !data.sender) {
                console.warn(`Invalid SOS data from ${socket.id}`);
                return;
            }

            const sanitizedSender = sanitizeHtml(data.sender, {
                allowedTags: [],
                allowedAttributes: {}
            });

            const clientIP = getClientIP(socket);
            const room = socket.room || 'public';

            const sosData = {
                id: `sos-${Date.now()}-${socket.id}`,
                sender: sanitizedSender,
                senderId: socket.id,
                location: {
                    latitude: parseFloat(data.location.latitude) || 0,
                    longitude: parseFloat(data.location.longitude) || 0,
                    accuracy: parseFloat(data.location.accuracy) || 0
                },
                deviceInfo: data.deviceInfo || {},
                ipInfo: {
                    ip: clientIP
                },
                message: 'Emergency SOS Alert!',
                timestamp: Date.now(),
                room: room
            };

            console.log(`🚨 SOS Alert from ${sanitizedSender} (${socket.id}) in ${room} - IP: ${sosData.ipInfo.ip}`);

            // Broadcast to all users IN THE ROOM (except sender usually, but here use broadcast.to)
            socket.to(room).emit('sos-alert', sosData);
        });

        // Audio/WebRTC Handlers
        socket.on('join-audio', () => {
            const room = socket.room || 'public';
            console.log(`🎤 ${socket.deviceName || socket.id} joined audio in ${room}`);

            // Get current list of audio peers in THIS ROOM (excluding the joining user)
            const currentPeers = Array.from(peers.entries())
                .filter(([peerId, peerData]) => peerId !== socket.id && peerData.room === room)
                .map(([peerId, peerData]) => ({
                    peerId: peerId,
                    userName: peerData.deviceName
                }));

            // Add this user to peers with room info
            peers.set(socket.id, { socket, deviceName: socket.deviceName, room: room });

            // Send the list of current peers to the joining user
            socket.emit('audio-peers', currentPeers);

            // Notify other peers IN THE ROOM that a new user joined
            socket.to(room).emit('user-connected', {
                peerId: socket.id,
                userName: socket.deviceName
            });

            const roomPeersCount = Array.from(peers.values()).filter(p => p.room === room).length;
            console.log(`📢 Audio peers count in ${room}: ${roomPeersCount}`);
        });

        socket.on('leave-audio', () => {
            const room = socket.room || 'public';
            console.log(`🔇 ${socket.deviceName || socket.id} left audio in ${room}`);
            peers.delete(socket.id);

            socket.to(room).emit('user-disconnected', {
                peerId: socket.id,
                userName: socket.deviceName
            });
        });

        // Handle "Request All to Join"
        socket.on('request-join-call', () => {
            const room = socket.room || 'public';
            const senderName = socket.deviceName || 'A user';
            console.log(`📞 ${senderName} is requesting everyone to join call in ${room}`);

            // Broadcast to everyone in room (including sender is fine, but usually exclude sender)
            // Using socket.to(room) excludes sender
            socket.to(room).emit('request-join-call', {
                senderId: socket.id,
                senderName: senderName
            });
        });

        socket.on('offer', ({ target, description }) => {
            // Check if both are in the same room (optional but good for security)
            const peer = peers.get(target);
            if (peer && peer.room === socket.room) {
                console.log(`📨 Offer from ${socket.id} to ${target}`);
                peer.socket.emit('offer', {
                    peerId: socket.id,
                    description
                });
            } else {
                console.warn(`Peer ${target} not found or in different room for offer from ${socket.id}`);
            }
        });

        socket.on('answer', ({ target, description }) => {
            const peer = peers.get(target);
            if (peer && peer.room === socket.room) {
                console.log(`📨 Answer from ${socket.id} to ${target}`);
                peer.socket.emit('answer', {
                    peerId: socket.id,
                    description
                });
            } else {
                console.warn(`Peer ${target} not found or in different room for answer from ${socket.id}`);
            }
        });

        socket.on('ice-candidate', ({ target, candidate }) => {
            const peer = peers.get(target);
            if (peer && peer.room === socket.room) {
                peer.socket.emit('ice-candidate', {
                    peerId: socket.id,
                    candidate
                });
            } else {
                console.debug(`Peer ${target} not found for ICE candidate from ${socket.id}`);
            }
        });

        socket.on('disconnect', () => {
            const deviceData = connectedDevices.get(socket.id);
            const wasInAudio = peers.has(socket.id);
            const room = socket.room || 'public';

            if (deviceData) {
                io.to(room).emit('user-disconnect', {
                    peerId: socket.id,
                    userName: deviceData.deviceName
                });
            }

            // If user was in audio, notify others in room
            if (wasInAudio) {
                io.to(room).emit('user-disconnected', {
                    peerId: socket.id,
                    userName: deviceData?.deviceName || 'Unknown'
                });
            }

            connectedDevices.delete(socket.id);
            peers.delete(socket.id);

            const devicesInRoom = getDevicesInRoom(connectedDevices, room);
            io.to(room).emit('update-device-list', devicesInRoom);
            io.to(room).emit('update-user-count', devicesInRoom.length);

            console.log(`User disconnected: ${socket.id} from ${room}`);
        });
    });
};