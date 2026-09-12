import { updateMarker, removeMarker, focusMapOnDevice, markers, setSelfId } from './map.js';
import { updateDeviceList, updateUserCount } from './ui.js';
import { addNotification } from './notification.js';
import { addMessageToChat } from './chat.js';
import {
    createPeerConnection,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    closePeerConnection,
    handleUserConnectedToAudio,
    handleUserDisconnectedFromAudio,
    handleAudioPeersList
} from './audio.js';
import { getDeviceName } from './device.js';

export const socket = io({
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
});

// Remember the last joined room/device so the session can be restored after
// a reconnect - on reconnect the server assigns a NEW socket id and the old
// room membership is gone. Without re-joining, users silently end up in the
// "public" room.
let lastRoom = null;
let lastDeviceName = null;
let currentSelfId = null;

export function initSocketEventHandlers(onJoinSuccess) {
    socket.on('connect', () => {
        addNotification('Connected to server');
        setSelfId(socket.id);

        // A reconnect gets a fresh socket id: remove the ghost marker left
        // behind by our previous session.
        if (currentSelfId && currentSelfId !== socket.id) {
            removeMarker(currentSelfId);
        }
        currentSelfId = socket.id;

        // Restore room membership after any (re)connect
        if (lastRoom) {
            socket.emit('join-room', { room: lastRoom, deviceName: lastDeviceName || getDeviceName() });
        }
    });

    socket.on('disconnect', (reason) => {
        addNotification('Disconnected from server');
        if (reason === 'io server disconnect') {
            // The server forcefully disconnected us; socket.io will NOT
            // auto-reconnect in this case - do it manually.
            socket.connect();
        }
    });

    // NOTE: 'reconnect' is a Manager-level event in socket.io-client v4 and is
    // NOT re-emitted on the Socket instance, so a socket.on('reconnect', ...)
    // handler here would be dead code. Reconnect recovery (re-joining the room
    // with the new socket id and clearing the ghost self-marker) is fully
    // handled by the 'connect' listener above, which fires on every reconnect.

    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error.message);
        addNotification('⚠️ Cannot reach server - retrying...');
    });

    socket.on('joined-room', (data) => {
        lastRoom = data.room;
        addNotification(`Joined organization/fleet: ${data.room}`);
        if (onJoinSuccess) onJoinSuccess();
    });

    socket.on('receive-location', (data) => {
        const isNewDevice = !(data.id in markers);
        updateMarker(data);
        if (isNewDevice) {
            addNotification(`${data.deviceName} started sharing location`);
        }
    });

    socket.on('focus-device-location', (data) => {
        updateMarker(data);
        focusMapOnDevice(data.latitude, data.longitude);
    });

    socket.on('user-disconnect', (data) => {
        const displayName = data.userName || 'A user';
        addNotification(`${displayName} has disconnected`);
        removeMarker(data.peerId);
        closePeerConnection(data.peerId);
    });

    socket.on('update-device-list', (devices) => {
        if (!Array.isArray(devices)) return;
        updateDeviceList(devices, socket.id);
    });

    socket.on('update-user-count', (count) => {
        updateUserCount(count);
    });

    // WebRTC Audio Events
    socket.on('user-connected', ({ peerId, userName }) => {
        const displayName = userName || 'A new user';
        console.log(`User connected to audio: ${displayName} (${peerId})`);
        handleUserConnectedToAudio(peerId, displayName);
    });

    socket.on('user-disconnected', ({ peerId, userName }) => {
        const displayName = userName || 'A user';
        console.log(`User disconnected from audio: ${displayName} (${peerId})`);
        handleUserDisconnectedFromAudio(peerId);
    });

    // Handle list of current audio peers when joining
    socket.on('audio-peers', (peers) => {
        console.log('Received audio peers:', peers);
        handleAudioPeersList(peers);
    });

    socket.on('offer', async ({ peerId, description }) => {
        console.log(`Received offer from ${peerId}`);
        await handleOffer(peerId, description);
    });

    socket.on('answer', async ({ peerId, description }) => {
        console.log(`Received answer from ${peerId}`);
        await handleAnswer(peerId, description);
    });

    socket.on('ice-candidate', async ({ peerId, candidate }) => {
        await handleIceCandidate(peerId, candidate);
    });

    // Bug fix (chat double-beep): addMessageToChat() already calls
    // playNotificationBeep() internally for received messages. The old code
    // in socket.js also played a beep here, causing two beeps per message.
    // We only call addMessageToChat — the sound is its responsibility.
    socket.on('chat-message', (data) => {
        const userName = localStorage.getItem('userName') || getDeviceName();
        if (data.senderId === socket.id || data.sender === userName) {
            return; // Own message (already echoed locally on send)
        }
        addMessageToChat(data, false);
    });
}

export function emitJoinRoom(room, deviceName) {
    lastRoom = room || 'public';
    lastDeviceName = deviceName || null;
    socket.emit('join-room', { room: lastRoom, deviceName: lastDeviceName });
}

export function emitSendLocation(locationData) {
    socket.emit('send-location', locationData);
}

export function emitRequestDeviceLocation(id) {
    socket.emit('request-device-location', id);
}

export function emitJoinAudio() {
    socket.emit('join-audio');
}

export function emitLeaveAudio() {
    socket.emit('leave-audio');
}
