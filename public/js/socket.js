import { updateMarker, removeMarker, focusMapOnDevice } from './map.js';
import { updateDeviceList, updateUserCount } from './ui.js';
import { addNotification } from './notification.js';
import { addMessageToChat } from './chat.js';
import { createPeerConnection, handleOffer, handleAnswer, handleIceCandidate, closePeerConnection } from './audio.js';

export const socket = io({
    reconnectionAttempts: 5,
    reconnectionDelay: 3000
});

export function initSocketEventHandlers() {
    socket.on('connect', () => {
        addNotification('Connected to server');
    });

    socket.on('disconnect', () => {
        addNotification('Disconnected from server');
    });

    socket.on('reconnect', (attemptNumber) => {
        addNotification(`Reconnected to server after ${attemptNumber} attempts`);
    });

    socket.on('receive-location', (data) => {
        updateMarker(data);
        if (!Object.keys(markers).includes(data.id)) {
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
        updateDeviceList(devices, socket.id);
    });

    socket.on('update-user-count', (count) => {
        updateUserCount(count);
    });

    socket.on('user-connected', async ({ peerId, userName }) => {
        const displayName = userName || 'A new user';
        addNotification(`${displayName} has connected`);
        createPeerConnection(peerId);
    });

    socket.on('offer', async ({ peerId, description }) => {
        await handleOffer(peerId, description);
    });

    socket.on('answer', async ({ peerId, description }) => {
        await handleAnswer(peerId, description);
    });

    socket.on('ice-candidate', async ({ peerId, candidate }) => {
        await handleIceCandidate(peerId, candidate);
    });

    socket.on('chat-message', (data) => {
        if (data.sender !== (localStorage.getItem('userName') || getDeviceName())) {
            addMessageToChat(data, false);
        }
    });

    // Note: 'user-audio' and 'toggle-speaker' are not handled as they seem server-specific and unsupported
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