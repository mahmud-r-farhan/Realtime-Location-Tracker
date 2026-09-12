const { describe, it } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../src/app');

describe('HTTP Routes API', () => {
    it('GET /health - should return status ok', async () => {
        const response = await request(app).get('/health');
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.body.status, 'ok');
        assert.ok(response.body.timestamp);
    });

    it('GET / - should render index page', async () => {
        const response = await request(app).get('/');
        assert.strictEqual(response.status, 200);
        assert.ok(response.text.includes('Real-Time Location Tracker'));
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
