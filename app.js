const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const compression = require('compression');
const rateLimit = require("express-rate-limit");
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Rate Limiting
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100
});
app.use(limiter);

app.set('view engine', 'ejs');
app.use(compression());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));

app.get('/', (req, res) => {
    res.render('index');
});


app.get('/developer', (req, res) => {
    res.redirect('https://gravatar.com/floawd');
});

const connectedDevices = new Map();
const peers = new Map();
const chatRooms = new Map();

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    io.emit('update-user-count', connectedDevices.size);

    // Location tracking
    socket.on('send-location', (data) => {
        if (!data.latitude || !data.longitude || !data.deviceName) return;
        
        connectedDevices.set(socket.id, { 
            latitude: data.latitude, 
            longitude: data.longitude, 
            deviceName: data.deviceName, 
            accuracy: data.accuracy,
            joinedAt: new Date()
        });

        socket.deviceName = data.deviceName;
        io.emit('receive-location', { id: socket.id, ...data });
        io.emit('update-device-list', Array.from(connectedDevices.entries()));
        io.emit('update-user-count', connectedDevices.size);
    });

    
    socket.on('chat-message', (data, callback) => {
        if (!data || !data.text || !socket.deviceName) {
            return callback && callback({ error: 'Invalid message data' });
        }

        const messageData = {
            id: Date.now(),
            text: data.text,
            sender: socket.deviceName,
            timestamp: Date.now()
        };

       
        io.emit('chat-message', messageData);
        
      
        if (callback) callback({ success: true, messageId: messageData.id });
    });

    // WebRTC Signaling
    socket.on('join-audio', () => {
        peers.set(socket.id, { socket, deviceName: socket.deviceName });
        socket.broadcast.emit('user-connected', {
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
        }
    });

    socket.on('answer', ({ target, description }) => {
        const peer = peers.get(target);
        if (peer) {
            peer.socket.emit('answer', {
                peerId: socket.id,
                description
            });
        }
    });

    socket.on('ice-candidate', ({ target, candidate }) => {
        const peer = peers.get(target);
        if (peer) {
            peer.socket.emit('ice-candidate', {
                peerId: socket.id,
                candidate
            });
        }
    });

    socket.on('disconnect', () => {
        const deviceData = connectedDevices.get(socket.id);
        if (deviceData) {
            io.emit('user-disconnected', {
                peerId: socket.id,
                userName: deviceData.deviceName
            });
        }

        connectedDevices.delete(socket.id);
        peers.delete(socket.id);
        
        io.emit('update-device-list', Array.from(connectedDevices.entries()));
        io.emit('update-user-count', connectedDevices.size);
    });
});

const PORT = 3007;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
