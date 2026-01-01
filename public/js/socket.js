import { updateMarker, removeMarker, focusMapOnDevice, markers } from './map.js';
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
    reconnectionAttempts: 5,
    reconnectionDelay: 3000
});

export function initSocketEventHandlers(onJoinSuccess) {
    socket.on('connect', () => {
        addNotification('Connected to server');
    });

    socket.on('disconnect', () => {
        addNotification('Disconnected from server');
    });

    socket.on('reconnect', (attemptNumber) => {
        addNotification(`Reconnected to server after ${attemptNumber} attempts`);
    });

    socket.on('joined-room', (data) => {
        addNotification(`Joined organization/fleet: ${data.room}`);
        if (onJoinSuccess) onJoinSuccess();
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

    // WebRTC Audio Events
    socket.on('user-connected', async ({ peerId, userName }) => {
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

    socket.on('chat-message', (data) => {
        const userName = localStorage.getItem('userName') || getDeviceName();
        if (data.sender !== userName) {
            addMessageToChat(data, false);
        }
    });
}

export function emitJoinRoom(room, deviceName) {
    socket.emit('join-room', { room, deviceName });
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