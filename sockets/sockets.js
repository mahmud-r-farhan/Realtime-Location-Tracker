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

module.exports = function setupSockets(io, connectedDevices, peers) {
    io.on('connection', (socket) => {
        // Get client IP on connection
        const clientIP = getClientIP(socket);
        socket.clientIP = clientIP;

        console.log(`User connected: ${socket.id} (IP: ${clientIP})`);
        io.emit('update-user-count', connectedDevices.size);

        socket.on('send-location', (data) => {
            if (!data || !data.latitude || !data.longitude || !data.deviceName) {
                console.warn(`Invalid location data from ${socket.id}`);
                return;
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
                joinedAt: new Date()
            };
            connectedDevices.set(socket.id, deviceData);
            socket.deviceName = sanitizedDeviceName;
            io.emit('receive-location', { id: socket.id, ...deviceData });
            io.emit('update-device-list', Array.from(connectedDevices.entries()));
            io.emit('update-user-count', connectedDevices.size);
        });

        socket.on('request-device-location', (id) => {
            const device = connectedDevices.get(id);
            if (device) {
                socket.emit('focus-device-location', { id, ...device });
            } else {
                console.warn(`Device ${id} not found for request from ${socket.id}`);
            }
        });

        socket.on('chat-message', (data, callback) => {
            if (!data || !data.text || !socket.deviceName) {
                console.warn(`Invalid chat message from ${socket.id}`);
                return callback && callback({ error: 'Invalid message data' });
            }
            const sanitizedText = sanitizeHtml(data.text, {
                allowedTags: [],
                allowedAttributes: {}
            });
            const messageData = {
                id: Date.now(),
                text: sanitizedText,
                sender: socket.deviceName,
                timestamp: Date.now()
            };
            io.emit('chat-message', messageData);
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
                timestamp: Date.now()
            };

            console.log(`🚨 SOS Alert from ${sanitizedSender} (${socket.id}) - IP: ${sosData.ipInfo.ip}`);

            // Broadcast to all OTHER users (not the sender)
            socket.broadcast.emit('sos-alert', sosData);
        });

        // Audio/WebRTC Handlers
        socket.on('join-audio', () => {
            console.log(`🎤 ${socket.deviceName || socket.id} joined audio`);

            // Get current list of audio peers (excluding the joining user)
            const currentPeers = Array.from(peers.entries())
                .filter(([peerId]) => peerId !== socket.id)
                .map(([peerId, peerData]) => ({
                    peerId: peerId,
                    userName: peerData.deviceName
                }));

            // Add this user to peers
            peers.set(socket.id, { socket, deviceName: socket.deviceName });

            // Send the list of current peers to the joining user
            socket.emit('audio-peers', currentPeers);

            // Notify other peers that a new user joined
            socket.broadcast.emit('user-connected', {
                peerId: socket.id,
                userName: socket.deviceName
            });

            console.log(`📢 Audio peers count: ${peers.size}`);
        });

        socket.on('leave-audio', () => {
            console.log(`🔇 ${socket.deviceName || socket.id} left audio`);
            peers.delete(socket.id);

            socket.broadcast.emit('user-disconnected', {
                peerId: socket.id,
                userName: socket.deviceName
            });

            console.log(`📢 Audio peers count: ${peers.size}`);
        });

        socket.on('offer', ({ target, description }) => {
            console.log(`📨 Offer from ${socket.id} to ${target}`);
            const peer = peers.get(target);
            if (peer) {
                peer.socket.emit('offer', {
                    peerId: socket.id,
                    description
                });
            } else {
                console.warn(`Peer ${target} not found for offer from ${socket.id}`);
                // Check if target is still connected (might not have joined audio yet)
                const targetSocket = io.sockets.sockets.get(target);
                if (targetSocket) {
                    console.log(`Target ${target} is connected but not in audio peers`);
                }
            }
        });

        socket.on('answer', ({ target, description }) => {
            console.log(`📨 Answer from ${socket.id} to ${target}`);
            const peer = peers.get(target);
            if (peer) {
                peer.socket.emit('answer', {
                    peerId: socket.id,
                    description
                });
            } else {
                console.warn(`Peer ${target} not found for answer from ${socket.id}`);
            }
        });

        socket.on('ice-candidate', ({ target, candidate }) => {
            const peer = peers.get(target);
            if (peer) {
                peer.socket.emit('ice-candidate', {
                    peerId: socket.id,
                    candidate
                });
            } else {
                // ICE candidates can arrive before peer is ready, just log at debug level
                console.debug(`Peer ${target} not found for ICE candidate from ${socket.id}`);
            }
        });

        socket.on('disconnect', () => {
            const deviceData = connectedDevices.get(socket.id);
            const wasInAudio = peers.has(socket.id);

            if (deviceData) {
                io.emit('user-disconnect', {
                    peerId: socket.id,
                    userName: deviceData.deviceName
                });
            }

            // If user was in audio, notify others
            if (wasInAudio) {
                io.emit('user-disconnected', {
                    peerId: socket.id,
                    userName: deviceData?.deviceName || 'Unknown'
                });
            }

            connectedDevices.delete(socket.id);
            peers.delete(socket.id);
            io.emit('update-device-list', Array.from(connectedDevices.entries()));
            io.emit('update-user-count', connectedDevices.size);
            console.log(`User disconnected: ${socket.id}`);
        });
    });
};