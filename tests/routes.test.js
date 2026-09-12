const { describe, it } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../src/app');
const { verifySession, signSession, parseSessionCookie } = require('../src/routes/routes');

describe('HTTP Routes API', () => {
    it('GET /health - should return status ok', async () => {
        const response = await request(app).get('/health');
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.body.status, 'ok');
        assert.ok(response.body.timestamp);
        assert.ok(Number.isFinite(response.body.uptime));
    });

    it('GET / - should render index page and issue a signed session cookie', async () => {
        const response = await request(app).get('/');
        assert.strictEqual(response.status, 200);
        assert.ok(response.text.includes('Real-Time Location Tracker'));

        const setCookie = response.headers['set-cookie'];
        assert.ok(setCookie, 'expected Set-Cookie header');
        const sidCookie = setCookie.find((c) => c.startsWith('sid='));
        assert.ok(sidCookie, 'expected an "sid" cookie');
        assert.ok(sidCookie.includes('HttpOnly'), 'session cookie must be HttpOnly');

        const token = parseSessionCookie(sidCookie);
        assert.ok(verifySession(token), 'issued token must verify');
    });

    it('GET / - reuses a still-valid session cookie instead of re-issuing', async () => {
        const first = await request(app).get('/');
        const cookie = first.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ');

        const second = await request(app).get('/').set('Cookie', cookie);
        assert.strictEqual(second.status, 200);
        assert.ok(!second.headers['set-cookie'], 'no new session should be issued');
    });

    it('GET /developer - should redirect', async () => {
        const response = await request(app).get('/developer');
        assert.strictEqual(response.status, 302);
        assert.ok(response.headers.location.includes('gravatar.com'));
    });

    it('GET /non-existent-page - should return 404', async () => {
        const response = await request(app).get('/non-existent-page');
        assert.strictEqual(response.status, 404);
    });
});

describe('Session token verification', () => {
    it('accepts tokens signed by this server', () => {
        const token = signSession('01234567-89ab-cdef-0123-456789abcdef');
        assert.ok(verifySession(token));
    });

    it('rejects forged signatures', () => {
        const token = signSession('01234567-89ab-cdef-0123-456789abcdef');
        const forged = token.slice(0, -2) + '00';
        assert.ok(!verifySession(forged));
    });

    it('rejects malformed tokens', () => {
        assert.ok(!verifySession(undefined));
        assert.ok(!verifySession(''));
        assert.ok(!verifySession('no-signature'));
        assert.ok(!verifySession('.signature'));
        assert.ok(!verifySession('id.'));
        assert.ok(!verifySession('id.deadbeef'));
        assert.ok(!verifySession('id.' + 'g'.repeat(64))); // invalid hex
        assert.ok(!verifySession('id.' + 'a'.repeat(63))); // wrong length
        assert.ok(!verifySession(12345));
    });

    it('parses sid cookies from a raw Cookie header', () => {
        assert.strictEqual(parseSessionCookie('sid=abc.123'), 'abc.123');
        assert.strictEqual(parseSessionCookie('other=x; sid=abc.123'), 'abc.123');
        assert.strictEqual(parseSessionCookie('sid="quoted.value"'), 'quoted.value');
        assert.strictEqual(parseSessionCookie('sid=b64%2Fvalue'), 'b64/value');
        assert.strictEqual(parseSessionCookie('sid=has=equals'), 'has=equals');
        assert.strictEqual(parseSessionCookie(''), null);
        assert.strictEqual(parseSessionCookie('other=x'), null);
        assert.strictEqual(parseSessionCookie(undefined), null);
    });
});
