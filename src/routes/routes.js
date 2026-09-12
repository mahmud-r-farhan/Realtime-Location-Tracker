const crypto = require('crypto');

// Secret used to sign session identifiers so they cannot be forged by clients.
// A stable secret (env) survives restarts; a random one is generated per boot as fallback.
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function signSession(id) {
    return `${id}.${crypto.createHmac('sha256', SESSION_SECRET).update(id).digest('hex')}`;
}

// Verifies a "<id>.<hmac>" session token was issued by this server (not forged/guessed)
function verifySession(token) {
    if (!token || typeof token !== 'string') return false;
    const dotIndex = token.indexOf('.');
    if (dotIndex <= 0 || dotIndex === token.length - 1) return false;

    const id = token.slice(0, dotIndex);
    const sig = token.slice(dotIndex + 1);

    // Signature must be exactly one HMAC hex digest; Buffer.from stops at the first
    // invalid hex char, so the strict length check below rejects malformed input
    // before timingSafeEqual (which throws on length mismatch).
    if (!/^[0-9a-f]{64}$/.test(sig)) return false;

    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(id).digest('hex');
    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
}

// Extracts the "sid" cookie value from a raw Cookie header.
// Splits on the FIRST "=" so values containing "=" survive, and tolerates
// quoted values. Returns the raw (still encoded) value or null.
function parseSessionCookie(cookieHeader) {
    if (!cookieHeader || typeof cookieHeader !== 'string') return null;

    for (const part of cookieHeader.split(';')) {
        const eqIndex = part.indexOf('=');
        if (eqIndex === -1) continue;

        if (part.slice(0, eqIndex).trim() !== 'sid') continue;

        let value = part.slice(eqIndex + 1).trim();
        if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
        }
        try {
            return decodeURIComponent(value);
        } catch {
            return value; // Malformed percent-encoding: treat as-is, verification will reject
        }
    }
    return null;
}

function hasValidSession(cookieHeader) {
    const token = parseSessionCookie(cookieHeader);
    return !!token && verifySession(token);
}

module.exports = function setupRoutes(app) {
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.status(200).json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: Math.floor(process.uptime())
        });
    });

    // Home page - issues a signed session identity used to authenticate later socket connections
    app.get('/', (req, res, next) => {
        if (!hasValidSession(req.headers.cookie)) {
            res.cookie('sid', signSession(crypto.randomUUID()), {
                httpOnly: true,
                sameSite: 'strict',
                secure: process.env.NODE_ENV === 'production',
                maxAge: 24 * 60 * 60 * 1000
            });
        }
        res.render('index', (err, html) => {
            if (err) {
                next(err);
            } else {
                res.send(html);
            }
        });
    });

    // Developer link
    app.get('/developer', (req, res) => {
        res.redirect('https://gravatar.com/floawd');
    });
};

module.exports.verifySession = verifySession;
module.exports.signSession = signSession;
module.exports.parseSessionCookie = parseSessionCookie;
