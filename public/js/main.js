import { initMap, focusMapOnDevice } from './map.js';
import { getDeviceName, getDeviceInfoSafely } from './device.js';
import { showNamePopup, hideNamePopup, getUserNameInput, getOrgInput, initSidebar, setupContinueButton, initInviteLink } from './ui.js';
import { initNotificationPanel, addNotification } from './notification.js';
import { initSocketEventHandlers, emitSendLocation, emitJoinRoom } from './socket.js';
import { initAudioControls } from './audio.js';
import { initChat, setCurrentChatUser } from './chat.js';
import { initSOS } from './sos.js';
import { LOCATION_SEND_INTERVAL, LOCATION_IDLE_INTERVAL } from './config.js';
import { initTheme } from './theme.js';
import { initControls } from './controls.js';
import { initBatteryMonitor } from './batteryMonitor.js';
import { getUserName, getOrgName, updateProfile } from './profile.js';
import { haversineDistance } from './utils.js';
import { initDialogFocus } from './dialogs.js';

// Expose focusMapOnDevice globally for SOS
window.focusMapOnLocation = focusMapOnDevice;

// Debug exposure
import { socket } from './socket.js';
import { map, markers, updateMarker, toggleFollowMe, setSelfId, removeMarker } from './map.js';

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.__DEBUG__ = {
        socket,
        map,
        markers,
        updateMarker,
        toggleFollowMe,
        setSelfId
    };
}

const deviceName = getDeviceName();
let locationSendIntervalId = null;
let isStationary = false;
let appInitialized = false;
let roomReady = false;
let sharingPaused = localStorage.getItem('locationSharingPaused') === 'true';
let sharingState = sharingPaused ? 'paused' : 'waiting';

// Motion-based battery optimization: slow GPS polling after the device has
// been motionless for a while (time-based rather than counting events, since
// devicemotion frequency varies across devices).
const MOTION_THRESHOLD = 0.5;          // total acceleration delta treated as "no movement"
const STATIONARY_AFTER_MS = 10_000;    // 10s without motion => idle mode
let lastMotionTime = Date.now();
let lastAcceleration = { x: 0, y: 0, z: 0 };

// Listen for profile updates
window.addEventListener('profileUpdate', (e) => {
    const { userName, orgName } = e.detail;
    setCurrentChatUser(userName || deviceName);
    if (!appInitialized) return;
    // Re-join so the server moves us to the new organization/fleet room
    roomReady = false;
    locationGeneration++;
    if (!sharingPaused) setSharingState('waiting');
    emitJoinRoom(orgName, userName || deviceName);
    addNotification('🔄 Profile updated synced');
});

// Battery Optimization: Accelerometer logic
let motionDetectionInitialized = false;

function initMotionDetection() {
    // The join callback also runs after every reconnect - without this guard
    // each reconnect would stack another devicemotion listener (battery drain
    // and duplicated interval restarts).
    if (motionDetectionInitialized) return;

    if ('DeviceMotionEvent' in window) {
        motionDetectionInitialized = true;
        window.addEventListener('devicemotion', (event) => {
            const acc = event.accelerationIncludingGravity;
            if (!acc || acc.x === null) return;

            const deltaX = Math.abs(acc.x - lastAcceleration.x);
            const deltaY = Math.abs(acc.y - lastAcceleration.y);
            const deltaZ = Math.abs(acc.z - lastAcceleration.z);

            lastAcceleration = { x: acc.x, y: acc.y, z: acc.z };

            const totalMovement = deltaX + deltaY + deltaZ;

            if (totalMovement >= MOTION_THRESHOLD) {
                lastMotionTime = Date.now();
                if (isStationary) {
                    console.log('Motion detected! Increasing update frequency.');
                    isStationary = false;
                    if (sharingState !== 'denied') startLocationUpdates(LOCATION_SEND_INTERVAL);
                }
            } else if (!isStationary && Date.now() - lastMotionTime >= STATIONARY_AFTER_MS) {
                console.log('Device stationary. Reducing update frequency.');
                isStationary = true;
                if (sharingState !== 'denied') startLocationUpdates(LOCATION_IDLE_INTERVAL);
            }
        });
        console.log('Motion detection initialized for Battery Optimization.');
    } else {
        console.warn('DeviceMotionEvent not supported. Battery optimization disabled.');
    }
}

let lastLocation = null;
let locationRequestInFlight = false;
let locationGeneration = 0;
// GPS readings jitter by several meters even when standing still; exact float
// comparison never deduplicates. Skip sends when movement is below this.
const MIN_SEND_DISTANCE_METERS = 8;
const MAX_SILENCE_MS = 60_000;
let lastSentAt = 0;

const sharingMessages = {
    waiting: ['Waiting', 'Waiting to join the room.'],
    locating: ['Locating', 'Waiting for a location fix from your device.'],
    sharing: ['Sharing', 'Your latest fix is shared with this room.'],
    paused: ['Paused', 'No new location updates will be sent. A disconnected device may remain visible briefly.'],
    denied: ['Permission denied', 'Allow location access in your browser settings, then try again.'],
    unavailable: ['Fix unavailable', 'Could not get a fresh fix. A previous fix may still be visible.'],
    offline: ['Offline', 'Location sharing will resume when the connection returns.']
};

function setSharingState(state) {
    sharingState = sharingPaused ? 'paused' : state;
    const [label, description] = sharingMessages[sharingState];
    const indicator = document.getElementById('sharing-indicator');
    const detail = document.getElementById('sharing-description');
    const toggle = document.getElementById('sharing-toggle');
    const retry = document.getElementById('sharing-retry');
    if (indicator) { indicator.textContent = label; indicator.dataset.state = sharingState; }
    if (detail) detail.textContent = description;
    if (toggle) {
        toggle.textContent = sharingPaused ? 'Resume sharing' : 'Pause sharing';
        toggle.setAttribute('aria-pressed', String(!sharingPaused));
    }
    retry?.classList.toggle('hidden', sharingPaused || !['denied', 'unavailable'].includes(sharingState));
}

function stopLocationTimer() {
    if (locationSendIntervalId) clearInterval(locationSendIntervalId);
    locationSendIntervalId = null;
}

function removeSharedLocation() {
    if (socket.id) removeMarker(socket.id);
    if (socket.connected) socket.emit('stop-sharing-location');
}

function initSharingControls() {
    setSharingState(sharingState);
    document.getElementById('sharing-toggle')?.addEventListener('click', () => {
        sharingPaused = !sharingPaused;
        localStorage.setItem('locationSharingPaused', String(sharingPaused));
        locationGeneration++;
        lastLocation = null;
        lastSentAt = 0;
        if (sharingPaused) {
            stopLocationTimer();
            removeSharedLocation();
            setSharingState('paused');
            addNotification('Location sharing paused');
        } else {
            if (socket.connected) socket.emit('resume-location-sharing');
            setSharingState(socket.connected ? (roomReady ? 'locating' : 'waiting') : 'offline');
            if (socket.connected && roomReady) startLocationUpdates(isStationary ? LOCATION_IDLE_INTERVAL : LOCATION_SEND_INTERVAL);
            addNotification('Location sharing resumed');
        }
    });
    document.getElementById('sharing-retry')?.addEventListener('click', () => {
        if (sharingPaused) return;
        locationGeneration++;
        lastLocation = null;
        if (socket.connected) socket.emit('resume-location-sharing');
        setSharingState(socket.connected ? (roomReady ? 'locating' : 'waiting') : 'offline');
        if (socket.connected && roomReady) startLocationUpdates(isStationary ? LOCATION_IDLE_INTERVAL : LOCATION_SEND_INTERVAL);
    });
    window.addEventListener('tracker-location-shared', () => {
        if (!sharingPaused && roomReady) setSharingState('sharing');
    });
}

async function sendLocationData() {
    if (sharingPaused || locationRequestInFlight || !socket.connected || !roomReady) return;
    if (!('geolocation' in navigator)) {
        setSharingState('unavailable');
        addNotification('Geolocation is not available.');
        stopLocationTimer();
        return;
    }
    locationRequestInFlight = true;
    const generation = locationGeneration;
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: !isStationary, // Disable high accuracy if stationary to save battery
                timeout: 15000,
                maximumAge: 5000
            });
        });

        const { latitude, longitude, accuracy } = position.coords;

        // Optimization: don't send if the device hasn't moved meaningfully
        if (lastLocation) {
            const moved = haversineDistance(lastLocation.latitude, lastLocation.longitude, latitude, longitude);
            if (sharingState === 'sharing' && moved < MIN_SEND_DISTANCE_METERS && Date.now() - lastSentAt < MAX_SILENCE_MS) {
                return;
            }
        }

        const info = await getDeviceInfoSafely();
        if (sharingPaused || !socket.connected || !roomReady || generation !== locationGeneration) return;
        lastSentAt = Date.now();
        lastLocation = { latitude, longitude };

        const displayName = getUserName() || deviceName;

        emitSendLocation({
            latitude,
            longitude,
            deviceName: displayName,
            accuracy,
            capturedAt: position.timestamp,
            deviceInfo: info
        });
    } catch (error) {
        if (generation !== locationGeneration || sharingPaused) return;
        console.error('Error getting location:', error);
        // Only notify specific errors to avoid spamming
        if (error.code === 1) {
            setSharingState('denied');
            removeSharedLocation();
            addNotification('Location access denied.');
            showPermissionDeniedAlert('location');
            // Stop polling - retrying a denied permission just burns battery
            stopLocationTimer();
        } else {
            setSharingState('unavailable');
        }
    } finally {
        locationRequestInFlight = false;
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
            <p style="color: #666; font-size: 14px;">Enable permission in your browser settings, then use Try again in the Devices panel.</p>
            <button class="retry-btn" style="margin-top: 20px; padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer;">I Understand</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.retry-btn').addEventListener('click', () => modal.remove());
}

function startLocationUpdates(interval) {
    stopLocationTimer();
    if (sharingPaused) return;
    locationSendIntervalId = setInterval(sendLocationData, interval);
    sendLocationData(); // Send immediately
}

function initializeApp() {
    // Guard against double initialization (e.g. double-click on "Continue"),
    // which would register duplicate socket listeners and timers.
    if (appInitialized) return;
    appInitialized = true;

    // Core modules
    initMap();
    initSidebar();
    initSharingControls();
    initAudioControls();
    initChat();
    initNotificationPanel();
    initSOS();

    // New feature modules
    initControls();
    initBatteryMonitor();
    initInviteLink();

    socket.on('disconnect', () => {
        roomReady = false;
        locationGeneration++;
        lastLocation = null;
        setSharingState('offline');
    });

    // Install listeners before joining: a fast acknowledgement must not be lost.
    initSocketEventHandlers(() => {
        // Republish even if the device has not moved since reconnect or a room change.
        locationGeneration++;
        roomReady = true;
        lastLocation = null;
        if (!sharingPaused) {
            socket.emit('resume-location-sharing');
            setSharingState('locating');
            startLocationUpdates(isStationary ? LOCATION_IDLE_INTERVAL : LOCATION_SEND_INTERVAL);
        } else {
            stopLocationTimer();
            setSharingState('paused');
        }
        initMotionDetection();
    });
    emitJoinRoom(getOrgName(), getUserName() || deviceName);
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initDialogFocus();
    // Handle room join from URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        updateProfile(undefined, roomParam);
    }

    const uName = getUserName();
    if (!uName && !localStorage.getItem('userNameSkipped')) {
        showNamePopup();
        setupContinueButton(() => {
            const inputName = getUserNameInput();
            const inputOrg = getOrgInput();

            if (inputName || inputOrg) {
                updateProfile(inputName, inputOrg);
            } else {
                localStorage.setItem('userNameSkipped', 'true');
            }

            setCurrentChatUser(getUserName() || deviceName);
            hideNamePopup();
            initializeApp();
        });
    } else {
        setCurrentChatUser(uName || deviceName);
        initializeApp();
    }
});
