const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS || '*',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

const connectedDevices = new Map();
const peers = new Map();

const setupMiddleware = require('./middleware/middleware');
const setupRoutes = require('./routes/routes');
const setupSockets = require('./sockets/sockets');

setupMiddleware(app);
setupRoutes(app);
setupSockets(io, connectedDevices, peers);

app.use((req, res) => {
    res.status(404).render('404', { 
        url: req.originalUrl 
    }, (err, html) => {
        if (err) {
            res.status(404).send('Page not found');
        } else {
            res.status(404).send(html);
        }
    });
});

app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    const status = err.status || err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' 
        ? 'Something went wrong!' 
        : err.message;
    
    console.error(`[${new Date().toISOString()}] Error (${status}):`, err.stack);
    
    res.status(status).render('error', { 
        message,
        status,
        error: process.env.NODE_ENV === 'production' ? {} : err
    }, (renderErr, html) => {
        if (renderErr) {
            res.status(status).send(message);
        } else {
            res.status(status).send(html);
        }
    });
});

if (require.main === module) {
    const PORT = process.env.PORT || 3007;
    const NODE_ENV = process.env.NODE_ENV || 'development';

    server.listen(PORT, () => {
        console.log(`[${new Date().toISOString()}] Server is running on port ${PORT} (${NODE_ENV})`);
    });
}

process.on('SIGTERM', () => {
    console.log('[SIGTERM] Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = { app, server, io };
