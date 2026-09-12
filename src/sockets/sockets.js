const sanitizeHtml = require('sanitize-html');

function sanitizeString(str, maxLength = 50) {
    if (typeof str !== 'string') return '';
    return sanitizeHtml(str, {
        allowedTags: [],
        allowedAttributes: {}
    }).trim().substring(0, maxLength);
}

function getClientIP(socket) {
    const handshake = socket.handshake;
    if (!handshake) return 'Unknown';

    const forwardedFor = handshake.headers['x-forwarded-for'];
    if (forwardedFor) {
        const ips = forwardedFor.split(',').map(ip => ip.trim());
        return ips[0];
    }
    const realIP = handshake.headers['x-real-ip'];
    if (realIP) return realIP;

    const cfIP = handshake.headers['cf-connecting-ip'];
    if (cfIP) return cfIP;

    let address = handshake.address;
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
        const clientIP = getClientIP(socket);
        socket.clientIP = clientIP;
        socket.room = 'public';

        socket.on('join-room', (data) => {
            const rawRoom = data && data.room ? data.room : 'public';
            const rawDeviceName = data && data.deviceName ? data.deviceName : 'Unknown';

            const roomName = sanitizeString(rawRoom, 50) || 'public';
            const deviceName = sanitizeString(rawDeviceName, 50) || 'Unknown';

            // Leave old room if switching
            if (socket.room && socket.room !== roomName) {
                socket.leave(socket.room);
            }

            socket.join(roomName);
            socket.room = roomName;
            socket.deviceName = deviceName;

            socket.emit('joined-room', { room: roomName });

            const devicesInRoom = getDevicesInRoom(connectedDevices, roomName);
            socket.emit('update-device-list', devicesInRoom);
            io.to(roomName).emit('update-user-count', devicesInRoom.length);
        });

        socket.on('send-location', (data) => {
            if (!data || data.latitude === undefined || data.longitude === undefined) {
                return;
            }

            const lat = parseFloat(data.latitude);
            const lng = parseFloat(data.longitude);
            const acc = parseFloat(data.accuracy) || 0;

            if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
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
                deviceInfo: typeof data.deviceInfo === 'object' && data.deviceInfo !== null ? data.deviceInfo : {},
                ip: socket.clientIP,
                joinedAt: new Date(),
                room: socket.room
            };

            connectedDevices.set(socket.id, deviceData);
            socket.deviceName = sanitizedDeviceName;

            io.to(socket.room).emit('receive-location', { id: socket.id, ...deviceData });

            const devicesInRoom = getDevicesInRoom(connectedDevices, socket.room);
            io.to(socket.room).emit('update-device-list', devicesInRoom);
            io.to(socket.room).emit('update-user-count', devicesInRoom.length);
        });

        socket.on('request-device-location', (id) => {
            const device = connectedDevices.get(id);
            if (device && device.room === socket.room) {
                socket.emit('focus-device-location', { id, ...device });
            }
        });

        socket.on('chat-message', (data, callback) => {
            if (!data || !data.text) {
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

        socket.on('sos-alert', (data) => {
            if (!data || !data.location) {
                return;
            }

            const room = socket.room || 'public';
            const rawSender = data.sender || socket.deviceName || 'Unknown';
            const sanitizedSender = sanitizeString(rawSender, 50) || 'Unknown';

            const lat = parseFloat(data.location.latitude) || 0;
            const lng = parseFloat(data.location.longitude) || 0;
            const acc = parseFloat(data.location.accuracy) || 0;

            const sosData = {
                id: `sos-${Date.now()}-${socket.id}`,
                sender: sanitizedSender,
                senderId: socket.id,
                location: {
                    latitude: lat,
                    longitude: lng,
                    accuracy: Math.max(0, Math.min(acc, 10000))
                },
                deviceInfo: typeof data.deviceInfo === 'object' && data.deviceInfo !== null ? data.deviceInfo : {},
                ipInfo: {
                    ip: socket.clientIP
                },
                message: 'Emergency SOS Alert!',
                timestamp: Date.now(),
                room: room
            };

            socket.to(room).emit('sos-alert', sosData);
        });

        // Audio & WebRTC
        socket.on('join-audio', () => {
            const room = socket.room || 'public';

            const currentPeers = Array.from(peers.entries())
                .filter(([peerId, peerData]) => peerId !== socket.id && peerData.room === room)
                .map(([peerId, peerData]) => ({
                    peerId: peerId,
                    userName: peerData.deviceName
                }));

            peers.set(socket.id, { socket, deviceName: socket.deviceName || 'Unknown', room: room });

            socket.emit('audio-peers', currentPeers);
            socket.to(room).emit('user-connected', {
                peerId: socket.id,
                userName: socket.deviceName || 'Unknown'
            });
        });

        socket.on('leave-audio', () => {
            const room = socket.room || 'public';
            peers.delete(socket.id);

            socket.to(room).emit('user-disconnected', {
                peerId: socket.id,
                userName: socket.deviceName || 'Unknown'
            });
        });

        socket.on('request-join-call', () => {
            const room = socket.room || 'public';
            const senderName = socket.deviceName || 'A user';

            socket.to(room).emit('request-join-call', {
                senderId: socket.id,
                senderName: senderName
            });
        });

        socket.on('offer', ({ target, description }) => {
            if (!target || !description) return;
            const peer = peers.get(target);
            if (peer && peer.room === socket.room) {
                peer.socket.emit('offer', {
                    peerId: socket.id,
                    description
                });
            }
        });

        socket.on('answer', ({ target, description }) => {
            if (!target || !description) return;
            const peer = peers.get(target);
            if (peer && peer.room === socket.room) {
                peer.socket.emit('answer', {
                    peerId: socket.id,
                    description
                });
            }
        });

        socket.on('ice-candidate', ({ target, candidate }) => {
            if (!target || !candidate) return;
            const peer = peers.get(target);
            if (peer && peer.room === socket.room) {
                peer.socket.emit('ice-candidate', {
                    peerId: socket.id,
                    candidate
                });
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
        });
    });
};
