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

io.on('connection', (socket) => {
    console.log('New Device Connected');
    io.emit('update-user-count', connectedDevices.size);

    socket.on('send-location', (data) => {
        const { latitude, longitude, deviceName, accuracy } = data;
        console.log(deviceName)
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

    socket.on('disconnect', () => {
        console.log('Device disconnected');
        connectedDevices.delete(socket.id);
        io.emit('user-disconnect', socket.id);
        io.emit('update-device-list', Array.from(connectedDevices.entries()));
        io.emit('update-user-count', connectedDevices.size);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});