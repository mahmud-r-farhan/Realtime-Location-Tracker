const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const compression = require('compression');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.set('view engine', 'ejs');
app.use(compression());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/developer', (req, res) => {
    res.send('https://gravatar.com/floawd');
});

const connectedDevices = new Map();
const peers = {};

io.on('connection', (socket) => {
    console.log('A user connected');
    io.emit('update-user-count', connectedDevices.size);
    peers[socket.id] = { socket };

    socket.on('send-location', (data) => {
        const { latitude, longitude, deviceName, accuracy } = data;
        connectedDevices.set(socket.id, { latitude, longitude, deviceName, accuracy });
        io.emit('receive-location', { id: socket.id, ...data });
        io.emit('update-device-list', Array.from(connectedDevices.entries()));
        io.emit('update-user-count', connectedDevices.size);
    });

    socket.on('request-device-location', (deviceId) => {
        const deviceData = connectedDevices.get(deviceId);
        if (deviceData) {
            socket.emit('focus-device-location', { id: deviceId, ...deviceData });
        }
    });

    socket.on('user-audio', (data) => {
        socket.broadcast.emit('user-audio', data);
    });

    socket.on('toggle-speaker', (data) => {
        socket.broadcast.emit('toggle-speaker', data);
    });

    socket.on('join-audio', (userData) => {
        socket.broadcast.emit('user-connected', { peerId: socket.id });
    });

    socket.on('ice-candidate', ({ target, candidate }) => {
        if (peers[target]) {
            peers[target].socket.emit('ice-candidate', {
                peerId: socket.id,
                candidate
            });
        }
    });

    socket.on('offer', ({ target, description }) => {
        if (peers[target]) {
            peers[target].socket.emit('offer', {
                peerId: socket.id,
                description
            });
        }
    });

    socket.on('answer', ({ target, description }) => {
        if (peers[target]) {
            peers[target].socket.emit('answer', {
                peerId: socket.id,
                description
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
        connectedDevices.delete(socket.id);
        io.emit('user-disconnect', socket.id);
        io.emit('update-device-list', Array.from(connectedDevices.entries()));
        io.emit('update-user-count', connectedDevices.size);
        delete peers[socket.id];
        io.emit('user-disconnected', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});