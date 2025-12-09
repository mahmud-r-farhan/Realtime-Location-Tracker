const express = require('express');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

module.exports = function setupMiddleware(app) {
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
    app.use(express.static(path.join(__dirname, '../public'), {
        maxAge: '1d',
        setHeaders: (res, path) => {
            if (path.endsWith('.js')) {
                res.setHeader('Content-Type', 'application/javascript');
            }
        }
    }));
};