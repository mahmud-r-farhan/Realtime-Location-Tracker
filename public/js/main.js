import { initMap, focusMapOnDevice } from './map.js';
import { getDeviceName, getDeviceInfo } from './device.js';
import { showNamePopup, hideNamePopup, getUserNameInput, getOrgInput, initSidebar, setupContinueButton } from './ui.js';
import { initNotificationPanel, addNotification } from './notification.js';
import { initSocketEventHandlers, emitSendLocation, emitJoinRoom } from './socket.js';
import { initAudioControls } from './audio.js';
import { initChat, setCurrentChatUser } from './chat.js';
import { initSOS } from './sos.js';
import { LOCATION_SEND_INTERVAL, LOCATION_IDLE_INTERVAL } from './config.js';
import { initTheme } from './theme.js';
import { initControls } from './controls.js';
import { initBatteryMonitor } from './batteryMonitor.js';

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
        if (error.code === 1) {
            addNotification('Location access denied.');
            showPermissionDeniedAlert('location');
        }
    }
}

function showPermissionDeniedAlert(type) {
    if (document.getElementById(`permission-alert-${type}`)) return;

    const modal = document.createElement('div');
    modal.id = `permission-alert-${type}`;
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; max-width: 400px; text-align: center;">
            <div style="font-size: 40px; margin-bottom: 20px;">⚠️</div>
            <h2>${type === 'location' ? 'Location' : 'Microphone'} Access Denied</h2>
            <p style="margin: 15px 0;">We cannot ${type === 'location' ? 'track your location' : 'process audio'} because permission was denied.</p>
            <p style="color: #666; font-size: 14px;">Please enable permissions in your browser settings (look for the lock icon in the address bar) and reload the page.</p>
            <button class="retry-btn" style="margin-top: 20px; padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer;">I Understand</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.retry-btn').addEventListener('click', () => modal.remove());
}

function startLocationUpdates(interval) {
    if (locationSendIntervalId) clearInterval(locationSendIntervalId);
    sendLocationData(); // Send immediately
    locationSendIntervalId = setInterval(sendLocationData, interval);
}

function initializeApp() {
    // Initialize theme system first (applies CSS variables)
    initTheme();

    // Core modules
    initMap();
    initSidebar();
    initAudioControls();
    initChat();
    initNotificationPanel();
    initSOS();

    // New feature modules
    initControls();
    initBatteryMonitor();

    // Join Room
    emitJoinRoom(orgName, userName || deviceName);

    // Socket handlers with callback for when joined
    initSocketEventHandlers(() => {
        // Start updates after joining room
        startLocationUpdates(LOCATION_SEND_INTERVAL);
        initMotionDetection();
        addNotification('📍 Location sharing enabled');
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