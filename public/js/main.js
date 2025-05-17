import { initMap } from './map.js';
import { getDeviceName, getDeviceInfo } from './device.js';
import { showNamePopup, hideNamePopup, getUserNameInput, initSidebar, setupContinueButton } from './ui.js';
import { initNotificationPanel, addNotification } from './notification.js';
import { initSocketEventHandlers, emitSendLocation } from './socket.js';
import { initAudioControls } from './audio.js';
import { initChat, setCurrentChatUser } from './chat.js';
import { LOCATION_SEND_INTERVAL } from './config.js';

let userName = localStorage.getItem('userName') || '';
const deviceName = getDeviceName();
let locationSendIntervalId = null;

async function sendLocationData() {
    if (!('geolocation' in navigator)) {
        addNotification('Geolocation is not available.');
        return;
    }
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            });
        });
        const deviceInfo = await getDeviceInfo();
        const { latitude, longitude, accuracy } = position.coords;
        const displayName = userName || deviceName;
        emitSendLocation({
            latitude,
            longitude,
            deviceName: displayName,
            accuracy,
            deviceInfo
        });
    } catch (error) {
        console.error('Error getting location:', error);
        if (error.code === 1) addNotification('Location access denied.');
        else if (error.code === 2) addNotification('Location unavailable.');
        else if (error.code === 3) addNotification('Location request timed out.');
        else addNotification('Error getting location.');
    }
}

function startLocationUpdates() {
    sendLocationData();
    if (locationSendIntervalId) clearInterval(locationSendIntervalId);
    locationSendIntervalId = setInterval(sendLocationData, LOCATION_SEND_INTERVAL);
}

function initializeApp() {
    initMap();
    initSidebar();
    initAudioControls();
    initChat();
    initNotificationPanel();
    initSocketEventHandlers();
    startLocationUpdates();
    addNotification('App initialized. Sharing location...');
}

document.addEventListener('DOMContentLoaded', () => {
    if (!userName && !localStorage.getItem('userNameSkipped')) {
        showNamePopup();
        setupContinueButton(() => {
            const inputName = getUserNameInput();
            if (inputName) {
                userName = inputName;
                localStorage.setItem('userName', userName);
            } else {
                localStorage.setItem('userNameSkipped', 'true');
            }
            setCurrentChatUser(userName || deviceName);
            hideNamePopup();
            initializeApp();
        });
    } else {
        setCurrentChatUser(userName || deviceName);
        initializeApp();
    }
});