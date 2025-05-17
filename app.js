const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const sanitizeHtml = require('sanitize-html');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*', // Adjust for production
        methods: ['GET', 'POST']
    }
});

// Rate Limiting
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Middleware
app.use(compression());
app.set('view engine', 'ejs');

// Serve static files with correct MIME type for JS modules
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/developer', (req, res) => {
    res.redirect('https://gravatar.com/floawd');
});

// In-memory storage
const connectedDevices = new Map();
const peers = new Map();

// Socket.IO Handlers
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
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

    socket.on('join-audio', () => {
        peers.set(socket.id, { socket, deviceName: socket.deviceName });
        socket.broadcast.emit('user-connected', {
            peerId: socket.id,
            userName: socket.deviceName
        });
    });

    socket.on('leave-audio', () => {
        peers.delete(socket.id);
        socket.broadcast.emit('user-disconnected', {
            peerId: socket.id,
            userName: socket.deviceName
        });
    });

    socket.on('offer', ({ target, description }) => {
        const peer = peers.get(target);
        if (peer) {
            peer.socket.emit('offer', {
                peerId: socket.id,
                description
            });
        } else {
            console.warn(`Peer ${target} not found for offer from ${socket.id}`);
        }
    });

    socket.on('answer', ({ target, description }) => {
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
            console.warn(`Peer ${target} not found for ICE candidate from ${socket.id}`);
        }
    });

    socket.on('disconnect', () => {
        const deviceData = connectedDevices.get(socket.id);
        if (deviceData) {
            io.emit('user-disconnect', {
                peerId: socket.id,
                userName: deviceData.deviceName
            });
            io.emit('user-disconnected', {
                peerId: socket.id,
                userName: deviceData.deviceName
            });
        }
        connectedDevices.delete(socket.id);
        peers.delete(socket.id);
        io.emit('update-device-list', Array.from(connectedDevices.entries()));
        io.emit('update-user-count', connectedDevices.size);
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).send('Something went wrong!');
});

// Start server
const PORT = process.env.PORT || 3007;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});