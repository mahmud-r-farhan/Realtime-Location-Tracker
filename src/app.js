const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

// ALLOWED_ORIGINS: comma-separated list of origins permitted to open socket
// connections (use when the frontend is hosted elsewhere). Unset/empty means
// same-origin only - no CORS headers are emitted, which is the safest default.
// The literal value "*" allows any origin but credentials are disabled then,
// since browsers reject wildcard origins together with credentials.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const corsOptions = allowedOrigins.includes('*')
    ? { origin: '*', methods: ['GET', 'POST'], credentials: false }
    : allowedOrigins.length > 0
        ? { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true }
        : undefined;

const io = socketIo(server, {
    // Socket.IO needs the same http server instance; apply CORS only when configured.
    ...(corsOptions ? { cors: corsOptions } : {}),
    // Cap single-message size (DoS protection). Location/chat/SOS payloads are tiny;
    // WebRTC SDPs are the largest legitimate messages (~10-20 KB).
    maxHttpBufferSize: 1e6,
    // Mobile devices background tabs frequently; relax heartbeat slightly to
    // avoid false-positive disconnects on flaky mobile networks.
    pingInterval: 25000,
    pingTimeout: 30000
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
    res.status(404).render('404',
        { url: req.originalUrl },
        (err, html) => {
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

    res.status(status).render('error',
        {
            message,
            status,
            error: process.env.NODE_ENV === 'production' ? {} : err
        },
        (renderErr, html) => {
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

// ---------------------------------------------------------------------------
// Graceful shutdown
// server.close() alone never completes while Socket.IO holds open WebSocket
// connections - io.close() must be called to close them first. A hard timer
// guarantees the process always exits.
// ---------------------------------------------------------------------------
let isShuttingDown = false;

function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`[${signal}] Shutting down gracefully...`);

    const forceExitTimer = setTimeout(() => {
        console.error('Graceful shutdown timed out; forcing exit');
        process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    io.close(() => {
        server.close(() => {
            clearTimeout(forceExitTimer);
            console.log('Server closed');
            process.exit(0);
        });
    });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
    console.error(`[${new Date().toISOString()}] Unhandled rejection:`, reason);
});

module.exports = { app, server, io };
