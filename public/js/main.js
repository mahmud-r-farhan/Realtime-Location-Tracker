import { initMap, focusMapOnDevice } from './map.js';
import { getDeviceName, getDeviceInfo } from './device.js';
import { showNamePopup, hideNamePopup, getUserNameInput, getOrgInput, initSidebar, setupContinueButton } from './ui.js';
import { initNotificationPanel, addNotification } from './notification.js';
import { initSocketEventHandlers, emitSendLocation, emitJoinRoom } from './socket.js';
import { initAudioControls } from './audio.js';
import { initChat, setCurrentChatUser } from './chat.js';
import { initSOS } from './sos.js';
import { LOCATION_SEND_INTERVAL, LOCATION_IDLE_INTERVAL } from './config.js';

// Expose focusMapOnDevice globally for SOS
window.focusMapOnLocation = focusMapOnDevice;

let userName = localStorage.getItem('userName') || '';
let orgName = localStorage.getItem('orgName') || 'public';

const deviceName = getDeviceName();
let locationSendIntervalId = null;
let lastAcceleration = { x: 0, y: 0, z: 0 };
let stationaryCounter = 0;
let isstationary = false;

// Battery Optimization: Accelerometer logic
function initMotionDetection() {
    if ('DeviceMotionEvent' in window) {
        window.addEventListener('devicemotion', (event) => {
            const acc = event.accelerationIncludingGravity;
            if (!acc) return;

            const deltaX = Math.abs(acc.x - lastAcceleration.x);
            const deltaY = Math.abs(acc.y - lastAcceleration.y);
            const deltaZ = Math.abs(acc.z - lastAcceleration.z);

            lastAcceleration = { x: acc.x, y: acc.y, z: acc.z };

            // Simple threshold to detect movement
            const totalMovement = deltaX + deltaY + deltaZ;

            if (totalMovement < 0.5) { // Threshold for "no movement"
                stationaryCounter++;
            } else {
                stationaryCounter = 0;
                if (isstationary) {
                    console.log("Motion detected! Increasing update frequency.");
                    isstationary = false;
                    startLocationUpdates(LOCATION_SEND_INTERVAL);
                }
            }

            // If stationary for ~10 seconds (~60 events at 60ms default interval roughly, usually events fire frequently)
            // Let's rely on time check implicitly by counter size or just check periodically
            if (stationaryCounter > 100 && !isstationary) { // Arbitrary number of events
                console.log("Device stationary. Reducing update frequency.");
                isstationary = true;
                startLocationUpdates(LOCATION_IDLE_INTERVAL);
            }
        });
        console.log("Motion detection initialized for Battery Optimization.");
    } else {
        console.warn("DeviceMotionEvent not supported. Battery optimization disabled.");
    }
}


async function sendLocationData() {
    if (!('geolocation' in navigator)) {
        addNotification('Geolocation is not available.');
        return;
    }
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: !isstationary, // Disable high accuracy if stationary to save battery
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
        // Only notify specific errors to avoid spamming
        if (error.code === 1) addNotification('Location access denied.');
    }
}

function startLocationUpdates(interval) {
    if (locationSendIntervalId) clearInterval(locationSendIntervalId);
    sendLocationData(); // Send immediately
    locationSendIntervalId = setInterval(sendLocationData, interval);
}

function initializeApp() {
    initMap();
    initSidebar();
    initAudioControls();
    initChat();
    initNotificationPanel();
    initSOS();

    // Join Room
    emitJoinRoom(orgName, userName || deviceName);

    // Socket handlers with callback for when joined
    initSocketEventHandlers(() => {
        // Start updates after joining room
        startLocationUpdates(LOCATION_SEND_INTERVAL);
        initMotionDetection();
        addNotification('Location sharing enabled.');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (!userName && !localStorage.getItem('userNameSkipped')) {
        showNamePopup();
        setupContinueButton(() => {
            const inputName = getUserNameInput();
            const inputOrg = getOrgInput();

            if (inputName) {
                userName = inputName;
                localStorage.setItem('userName', userName);
            } else {
                localStorage.setItem('userNameSkipped', 'true');
            }

            if (inputOrg) {
                orgName = inputOrg;
                localStorage.setItem('orgName', orgName);
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