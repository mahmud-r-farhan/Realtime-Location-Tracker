const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const socketIo = require('socket.io');
const ioClient = require('socket.io-client');
const setupSockets = require('../src/sockets/sockets');

describe('Socket.IO Realtime Event Handlers', () => {
    let server;
    let io;
    let clientSocket1;
    let clientSocket2;
    let port;
    const connectedDevices = new Map();
    const peers = new Map();

    before(async () => {
        const app = express();
        server = http.createServer(app);
        io = socketIo(server);
        setupSockets(io, connectedDevices, peers);

        await new Promise((resolve) => {
            server.listen(0, resolve);
        });
        port = server.address().port;
    });

    after(async () => {
        if (io) io.close();
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    beforeEach(async () => {
        clientSocket1 = ioClient(`http://localhost:${port}`, {
            transports: ['websocket'],
            forceNew: true
        });
        clientSocket2 = ioClient(`http://localhost:${port}`, {
            transports: ['websocket'],
            forceNew: true
        });

        await Promise.all([
            new Promise(resolve => clientSocket1.on('connect', resolve)),
            new Promise(resolve => clientSocket2.on('connect', resolve))
        ]);
    });

    afterEach(() => {
        if (clientSocket1 && clientSocket1.connected) clientSocket1.disconnect();
        if (clientSocket2 && clientSocket2.connected) clientSocket2.disconnect();
        connectedDevices.clear();
        peers.clear();
    });

    it('join-room event', async () => {
        const promise = new Promise((resolve) => {
            clientSocket1.on('joined-room', (data) => {
                assert.strictEqual(data.room, 'test-room');
                resolve();
            });
        });

        clientSocket1.emit('join-room', { room: 'test-room', deviceName: 'Device 1' });
        await promise;
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

        await promise;
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

        await promise;
    });

    it('sos-alert emergency broadcast', async () => {
        clientSocket1.emit('join-room', { room: 'emergency-room', deviceName: 'Hiker 1' });
        clientSocket2.emit('join-room', { room: 'emergency-room', deviceName: 'Rescuer 1' });

        const promise = new Promise((resolve) => {
            clientSocket2.on('sos-alert', (sosData) => {
                assert.strictEqual(sosData.sender, 'Hiker 1');
                assert.strictEqual(sosData.location.latitude, 40.7128);
                assert.strictEqual(sosData.location.longitude, -74.0060);
                resolve();
            });
        });

        await new Promise(r => setTimeout(r, 50));
        clientSocket1.emit('sos-alert', {
            sender: 'Hiker 1',
            location: {
                latitude: 40.7128,
                longitude: -74.0060,
                accuracy: 5
            }
        });

        await promise;
    });
});
