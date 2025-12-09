const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*', // Adjust for production
        methods: ['GET', 'POST']
    }
});

// In-memory storage
const connectedDevices = new Map();
const peers = new Map();

// Setup imports
const setupMiddleware = require('./middleware/middleware');
const setupRoutes = require('./routes/routes');
const setupSockets = require('./sockets/sockets');

// Apply setups
setupMiddleware(app);
setupRoutes(app);
setupSockets(io, connectedDevices, peers);

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