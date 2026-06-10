const express = require('express');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');

module.exports = function setupMiddleware(app) {
    // Trust proxy in production
    if (process.env.NODE_ENV === 'production') {
        app.set('trust proxy', 1);
    }

    // Security Headers
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "script-src": ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://kit.fontawesome.com"],
                "img-src": ["'self'", "data:", "https://*.tile.openstreetmap.org", "https://*.tile.thunderforest.com", "https://*.basemaps.cartocdn.com", "https://gravatar.com"],
                "connect-src": ["'self'", "https://ipapi.co", "https://ka-f.fontawesome.com"],
            },
        },
        hsts: {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true
        }
    }));

    // Rate Limiting
    const limiter = rateLimit({
        windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 1 * 60 * 1000,
        max: process.env.NODE_ENV === 'production' ? 100 : 1000,
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => req.path === '/health'
    });
    app.use(limiter);

    // Middleware
    app.use(compression());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ limit: '10mb', extended: true }));
    
    // View engine setup
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../views'));

    // Serve static files with correct MIME type for JS modules
    app.use(express.static(path.join(__dirname, '../../public'), {
        maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.js')) {
                res.setHeader('Content-Type', 'application/javascript');
            }
            // Security headers for static files
            res.setHeader('X-Content-Type-Options', 'nosniff');
        }
    }));
};