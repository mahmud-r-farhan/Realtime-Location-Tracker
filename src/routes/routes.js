const crypto = require('crypto');

// Secret used to sign session identifiers so they cannot be forged by clients
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function signSession(id) {
    return `${id}.${crypto.createHmac('sha256', SESSION_SECRET).update(id).digest('hex')}`;
}

// Verifies a "<id>.<hmac>" session token was issued by this server (not forged/guessed)
function verifySession(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return false;
    const [id, sig] = token.split('.');
    if (!id || !sig) return false;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(id).digest('hex');
    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
}

module.exports = function setupRoutes(app) {
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.status(200).json({ 
            status: 'ok',
            timestamp: new Date().toISOString()
        });
    });

    // Home page - issues a signed session identity used to authenticate later socket connections
    app.get('/', (req, res, next) => {
        const cookieHeader = req.headers.cookie || '';
        const hasValidSession = cookieHeader.split(';').some((c) => {
            const [k, v] = c.trim().split('=');
            return k === 'sid' && verifySession(decodeURIComponent(v || ''));
        });
        if (!hasValidSession) {
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