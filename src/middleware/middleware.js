const express = require('express');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');

module.exports = function setupMiddleware(app) {
    if (process.env.NODE_ENV === 'production') {
        app.set('trust proxy', 1);
    }

    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "script-src": ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://kit.fontawesome.com", "https://cdnjs.cloudflare.com"],
                "style-src": ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
                "img-src": [
                    "'self'",
                    "data:",
                    "blob:",
                    "https://*.tile.openstreetmap.org",
                    "https://*.tile.opentopomap.org",
                    "https://*.tile-cyclosm.openstreetmap.fr",
                    "https://*.tile.thunderforest.com",
                    "https://*.basemaps.cartocdn.com",
                    "https://gravatar.com",
                    "https://server.arcgisonline.com"
                ],
                "font-src": ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com", "https://ka-f.fontawesome.com"],
                "connect-src": ["'self'", "ws:", "wss:", "https://ipapi.co", "https://ka-f.fontawesome.com"],
            },
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    }));

    app.use(compression());

    // Static assets are served BEFORE the rate limiter: a single page load
    // fetches ~30 static files, which would otherwise exhaust the production
    // request budget (100 req / 15 min) after only a few reloads.
    app.use(express.static(path.join(__dirname, '../../public'), {
        maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
        setHeaders: (res, filePath) => {
            const filename = path.basename(filePath);
            // The service worker and manifest must always revalidate so
            // updates propagate; long-lived caching would strand clients
            // on old versions.
            if (filename === 'sw.js' || filename === 'manifest.json') {
                res.setHeader('Cache-Control', 'no-cache');
            }
        }
    }));

    const limiter = rateLimit({
        windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 1 * 60 * 1000,
        max: process.env.NODE_ENV === 'production' ? 100 : 2000,
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => req.path === '/health'
    });
    app.use(limiter);

    // No HTTP routes accept large bodies (all realtime data flows over
    // Socket.IO), so a small cap is sufficient and limits abuse surface.
    app.use(express.json({ limit: '100kb' }));
    app.use(express.urlencoded({ limit: '100kb', extended: true }));

    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../views'));
};
