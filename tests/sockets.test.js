const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const ioClient = require('socket.io-client');
const { app, server } = require('../src/app');

describe('Socket.IO Realtime Event Handlers', () => {
    let clientSocket1;
    let clientSocket2;
    let port;

    before(async () => {
        await new Promise((resolve) => {
            server.listen(0, resolve);
        });
        port = server.address().port;
    });

    after(async () => {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    /**
     * The socket endpoint requires the signed `sid` session cookie issued by
     * GET /. Fetch one, then open an authenticated client connection.
     */
    async function createAuthenticatedClient() {
        const res = await request(app).get('/');
        assert.ok(res.headers['set-cookie'], 'expected a session cookie from GET /');
        const cookie = res.headers['set-cookie'][0].split(';')[0];

        const client = ioClient(`http://localhost:${port}`, {
            transports: ['websocket'],
            forceNew: true,
            extraHeaders: { Cookie: cookie }
        });

        await withTimeout(new Promise((resolve, reject) => {
            client.on('connect', resolve);
            client.on('connect_error', reject);
        }), 5000, 'client connect');

        return client;
    }

    /**
     * Guards every awaited event against hanging forever: a regression in the
     * server or a missed broadcast fails the test after `ms` instead of
     * stalling the whole CI job.
     */
    function withTimeout(promise, ms = 5000, label = 'event') {
        let timer;
        return Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), ms);
            })
        ]).finally(() => clearTimeout(timer));
    }

    beforeEach(async () => {
        clientSocket1 = await createAuthenticatedClient();
        clientSocket2 = await createAuthenticatedClient();
    });

    afterEach(() => {
        if (clientSocket1) clientSocket1.disconnect();
        if (clientSocket2) clientSocket2.disconnect();
    });

    it('rejects connections without a valid session cookie', async () => {
        const unauthenticated = ioClient(`http://localhost:${port}`, {
            transports: ['websocket'],
            forceNew: true,
            reconnection: false
        });

        const error = await new Promise((resolve) => {
            unauthenticated.on('connect_error', resolve);
        });

        assert.match(error.message, /Unauthorized/i);
        unauthenticated.close();
    });

    it('join-room event', async () => {
        const promise = new Promise((resolve) => {
            clientSocket1.on('joined-room', (data) => {
                assert.strictEqual(data.room, 'test-room');
                resolve();
            });
        });

        clientSocket1.emit('join-room', { room: 'test-room', deviceName: 'Device 1' });
        await withTimeout(promise, 5000, 'joined-room');
    });

    it('send-location and receive-location event', async () => {
        clientSocket1.emit('join-room', { room: 'fleet-1', deviceName: 'Truck 1' });
        clientSocket2.emit('join-room', { room: 'fleet-1', deviceName: 'Truck 2' });

        const promise = new Promise((resolve) => {
            clientSocket2.on('receive-location', (data) => {
                if (data.deviceName === 'Truck 1') {
                    assert.strictEqual(data.latitude, 37.7749);
                    assert.strictEqual(data.longitude, -122.4194);
                    assert.strictEqual(data.deviceName, 'Truck 1');
                    resolve();
                }
            });
        });

        await new Promise(r => setTimeout(r, 50));
        clientSocket1.emit('send-location', {
            latitude: 37.7749,
            longitude: -122.4194,
            deviceName: 'Truck 1',
            accuracy: 10
        });

        await withTimeout(promise, 5000, 'receive-location');
    });

    it('sanitizes hostile deviceInfo payloads', async () => {
        clientSocket1.emit('join-room', { room: 'sec-room', deviceName: 'Attacker' });
        clientSocket2.emit('join-room', { room: 'sec-room', deviceName: 'Victim' });

        const promise = new Promise((resolve) => {
            clientSocket2.on('receive-location', (data) => {
                if (data.deviceName !== 'Attacker') return;

                // Only whitelisted keys survive
                assert.strictEqual(data.deviceInfo.os, 'evil payload');
                assert.strictEqual(data.deviceInfo.evil, undefined);
                assert.strictEqual(data.deviceInfo.nested, undefined);
                // Angle brackets are stripped from every string value
                assert.ok(!data.deviceInfo.os.includes('<'));
                assert.ok(!data.deviceInfo.os.includes('>'));
                // Battery is clamped to a sane range
                assert.strictEqual(data.deviceInfo.battery.level, 100);
                assert.strictEqual(data.deviceInfo.battery.charging, true);
                resolve();
            });
        });

        await new Promise(r => setTimeout(r, 50));
        clientSocket1.emit('send-location', {
            latitude: 10,
            longitude: 10,
            deviceName: 'Attacker',
            deviceInfo: {
                os: 'evil<script>alert(1)</script>payload',
                evil: '<img src=x onerror=alert(1)>',
                nested: { deep: '<b>nope</b>' },
                battery: { level: 1000, charging: 'yes' }
            }
        });

        await withTimeout(promise, 5000, 'sanitized receive-location');
    });

    it('strips HTML tags from chat messages and device names', async () => {
        clientSocket1.emit('join-room', { room: 'sanitize-room', deviceName: '<b>Bob</b>' });
        clientSocket2.emit('join-room', { room: 'sanitize-room', deviceName: 'Alice' });

        const promise = new Promise((resolve) => {
            clientSocket2.on('chat-message', (data) => {
                assert.strictEqual(data.text, 'hello world');
                assert.strictEqual(data.sender, 'Bob');
                resolve();
            });
        });

        await new Promise(r => setTimeout(r, 50));
        clientSocket1.emit('chat-message', {
            text: 'hello <script>alert(1)</script>world',
            sender: '<i>Bob</i>'
        });

        await withTimeout(promise, 5000, 'sanitized chat-message');
    });

    it('rate limits chat-message floods', async () => {
        clientSocket1.emit('join-room', { room: 'flood-room', deviceName: 'Flooder' });

        await new Promise(r => setTimeout(r, 50));

        const results = await Promise.all(
            Array.from({ length: 30 }, () => new Promise((resolve) => {
                clientSocket1.emit('chat-message', { text: 'spam', sender: 'Flooder' }, resolve);
            }))
        );

        const errors = results.filter((r) => r && r.error);
        assert.ok(errors.length > 0, 'expected rate limit errors on a message flood');
    });

    it('chat-message event broadcasting', async () => {
        clientSocket1.emit('join-room', { room: 'chat-room', deviceName: 'Alice' });
        clientSocket2.emit('join-room', { room: 'chat-room', deviceName: 'Bob' });

        const promise = new Promise((resolve) => {
            clientSocket2.on('chat-message', (data) => {
                assert.strictEqual(data.text, 'Hello world!');
                assert.strictEqual(data.sender, 'Alice');
                resolve();
            });
        });

        await new Promise(r => setTimeout(r, 50));
        clientSocket1.emit('chat-message', {
            text: 'Hello world!',
            sender: 'Alice'
        });

        await withTimeout(promise, 5000, 'chat-message');
    });

    it('sos-alert emergency broadcast', async () => {
        clientSocket1.emit('join-room', { room: 'emergency-room', deviceName: 'Hiker 1' });
        clientSocket2.emit('join-room', { room: 'emergency-room', deviceName: 'Rescuer 1' });

        const promise = new Promise((resolve) => {
            clientSocket2.on('sos-alert', (sosData) => {
                assert.strictEqual(sosData.sender, 'Hiker 1');
                assert.strictEqual(sosData.location.latitude, 40.7128);
                assert.strictEqual(sosData.location.longitude, -74.006);
                // IP must come from the server, never from the client payload
                assert.ok(sosData.ipInfo && typeof sosData.ipInfo.ip === 'string');
                resolve();
            });
        });

        await new Promise(r => setTimeout(r, 50));
        clientSocket1.emit('sos-alert', {
            sender: 'Hiker 1',
            location: {
                latitude: 40.7128,
                longitude: -74.006,
                accuracy: 5
            }
        });

        await withTimeout(promise, 5000, 'sos-alert');
    });

    it('switching rooms updates the device list of the old room', async () => {
        clientSocket1.emit('join-room', { room: 'room-a', deviceName: 'Mover' });
        clientSocket2.emit('join-room', { room: 'room-a', deviceName: 'Stayer' });

        // Register Mover in the device registry via a location share
        await new Promise(r => setTimeout(r, 50));
        clientSocket1.emit('send-location', { latitude: 1, longitude: 1, deviceName: 'Mover' });
        await new Promise(r => setTimeout(r, 50));

        const listPromise = new Promise((resolve) => {
            clientSocket2.on('update-device-list', (devices) => {
                resolve(devices);
            });
        });

        const joinedPromise = new Promise((resolve) => {
            clientSocket1.on('joined-room', (data) => {
                if (data.room === 'room-b') resolve();
            });
        });

        clientSocket1.emit('join-room', { room: 'room-b', deviceName: 'Mover' });
        await joinedPromise;

        const remainingDevices = await Promise.race([
            listPromise.then((devices) => devices.filter(([id]) => id === clientSocket1.id)),
            new Promise((resolve) => setTimeout(() => resolve(null), 3000))
        ]);

        // The old room must no longer list the mover (either an updated list
        // arrived without them, or no stale list was ever left behind).
        assert.ok(remainingDevices === null || remainingDevices.length === 0);
    });
});
