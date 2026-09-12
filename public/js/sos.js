import { socket } from './socket.js';
import { getDeviceInfo, getDeviceName } from './device.js';
import { getUserName } from './profile.js';
import { addNotification } from './notification.js';
import { markers } from './map.js';
import { escapeHtml, isValidLatLng } from './utils.js';

// SOS State
let sosHoldTimer = null;
let isSOSActive = false;
let sosAlerts = [];
const SOS_HOLD_DURATION = 2000; // 2 seconds hold to trigger SOS
const SOS_TAP_DURATION = 400;   // shorter than this = tap (opens the alerts modal)
const MAX_SOS_ALERTS = 50;

// Placeholder shown for our own alert until the server ack tells us our public IP
const IP_PENDING = 'Pending...';
const IP_LOOKUP_SKIP = new Set(['Unknown', 'Pending...', 'Fetching...']);

// Audio context for SOS sound
let audioContext = null;

export function initSOS() {
    setupSOSButton();
    setupSOSModal();
    initSOSSocketHandlers();
    loadSOSFromStorage();
    setupSOSListActions();
    console.log('[SOS] SOS module initialized');
}


function setupSOSButton() {
    const sosButton = document.getElementById('sos-btn');
    if (!sosButton) {
        console.error('[SOS] SOS button not found in DOM');
        return;
    }

    // Desktop events
    sosButton.addEventListener('mousedown', startSOSHold);
    sosButton.addEventListener('mouseup', cancelSOSHold);
    sosButton.addEventListener('mouseleave', cancelSOSHold);

    // Touch events for mobile.
    // preventDefault() on touchstart suppresses the emulated click event, so a
    // quick tap must be reproduced manually here - otherwise mobile users can
    // never open the alerts modal with a tap (desktop-only click handler).
    let touchStartTime = 0;
    sosButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchStartTime = Date.now();
        startSOSHold();
    }, { passive: false });

    sosButton.addEventListener('touchend', () => {
        cancelSOSHold();
        const wasTap = Date.now() - touchStartTime < SOS_TAP_DURATION;
        if (wasTap && !isSOSActive && !sosHoldTimer) {
            openSOSModal('alerts');
        }
        touchStartTime = 0;
    });
    sosButton.addEventListener('touchcancel', () => {
        cancelSOSHold();
        touchStartTime = 0;
    });

    // Click handler to open modal (desktop quick click; only if not holding)
    sosButton.addEventListener('click', () => {
        if (!isSOSActive && !sosHoldTimer) {
            openSOSModal('alerts');
        }
    });

    console.log('[SOS] SOS button setup complete');
}

function startSOSHold() {
    if (sosHoldTimer) return;

    const sosButton = document.getElementById('sos-btn');
    if (sosButton) {
        sosButton.classList.add('holding');
    }

    sosHoldTimer = setTimeout(() => {
        sosHoldTimer = null;
        triggerSOS();
    }, SOS_HOLD_DURATION);

    // Vibrate on start (mobile)
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }
}

function cancelSOSHold() {
    if (sosHoldTimer) {
        clearTimeout(sosHoldTimer);
        sosHoldTimer = null;
    }

    const sosButton = document.getElementById('sos-btn');
    if (sosButton) {
        sosButton.classList.remove('holding');
    }
}


/**
 * Resolve the best available position for an SOS.
 * An emergency alert must never be blocked by GPS problems, so we walk a
 * fallback chain: fresh high-accuracy fix -> recently cached fix -> last
 * position this device shared on the map -> alert without location.
 */
async function resolveSOSLocation() {
    const attempts = [
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 5 * 60 * 1000 }
    ];

    for (const options of attempts) {
        if (!('geolocation' in navigator)) break;
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, options);
            });
            if (isValidLatLng(position.coords.latitude, position.coords.longitude)) {
                return {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: Number(position.coords.accuracy) || 0,
                    locationAvailable: true
                };
            }
        } catch (error) {
            console.warn('[SOS] Location attempt failed:', error && error.message ? error.message : error);
        }
    }

    // Fall back to the last position we shared on the map (our own marker)
    try {
        const selfMarker = markers[socket.id];
        if (selfMarker && typeof selfMarker.getLatLng === 'function') {
            const ll = selfMarker.getLatLng();
            if (isValidLatLng(ll.lat, ll.lng)) {
                return { latitude: ll.lat, longitude: ll.lng, accuracy: 0, locationAvailable: true };
            }
        }
    } catch (error) {
        console.warn('[SOS] Could not read last known position:', error);
    }

    // No usable position - still send the alert so people know there is an emergency
    return { latitude: 0, longitude: 0, accuracy: 0, locationAvailable: false };
}


async function triggerSOS() {
    isSOSActive = true;
    sosHoldTimer = null;

    const sosButton = document.getElementById('sos-btn');
    if (sosButton) {
        sosButton.classList.remove('holding');
        sosButton.classList.add('triggered');
    }

    // Vibrate pattern (mobile)
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
    }

    // Reset the button state after 5 seconds no matter what happens below
    const resetTimeout = setTimeout(() => {
        isSOSActive = false;
        if (sosButton) sosButton.classList.remove('triggered');
    }, 5000);

    try {
        const [location, deviceInfo] = await Promise.all([
            resolveSOSLocation(),
            getDeviceInfo().catch(() => ({}))
        ]);

        const sosData = {
            sender: getUserName() || getDeviceName(),
            location: {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy
            },
            locationAvailable: location.locationAvailable,
            // The server whitelists deviceInfo keys; keep the payload lean
            deviceInfo: deviceInfo || {},
            // Our public IP is only known to the server - filled in via the emit ack
            ipInfo: { ip: IP_PENDING },
            timestamp: Date.now(),
            message: 'Emergency SOS Alert!'
        };

        const localEntry = { ...sosData, isOwn: true };

        // Emit SOS to all users in the room. The ack carries our public IP so
        // our own alert card can show real data instead of a placeholder.
        socket.emit('sos-alert', sosData, (response) => {
            if (response && response.success && response.ip) {
                localEntry.ipInfo = { ip: String(response.ip) };
                persistAndRender();
                enrichIpInfo(localEntry);
            } else if (response && response.error) {
                localEntry.ipInfo = { ip: 'Unknown' };
                persistAndRender();
                addNotification(`⚠️ SOS not delivered: ${response.error}`);
            }
        });

        // Add to local notifications
        addNotification(location.locationAvailable
            ? '⚠️ SOS sent! All users have been alerted.'
            : '⚠️ SOS sent (without GPS location). All users have been alerted.');

        // Add to local SOS list
        await addSOSToList(localEntry);

        // Open modal to show confirmation
        openSOSModal('alerts');

    } catch (error) {
        console.error('[SOS] Error triggering SOS:', error);
        addNotification('❌ SOS failed - unexpected error');
        clearTimeout(resetTimeout);
        isSOSActive = false;
        if (sosButton) sosButton.classList.remove('triggered');
    }
}


function setupSOSModal() {
    const modal = document.getElementById('sos-modal');
    const closeBtn = document.getElementById('sos-modal-close');
    const triggerBtn = document.getElementById('sos-trigger-btn');

    if (!modal) {
        console.error('[SOS] SOS modal not found in DOM');
        return;
    }

    // Close button
    if (closeBtn) {
        closeBtn.addEventListener('click', closeSOSModal);
    }

    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeSOSModal();
    });

    // Tab switching
    document.querySelectorAll('.sos-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchSOSTab(tab.dataset.tab);
        });
    });

    // Modal SOS trigger button
    if (triggerBtn) {
        let modalHoldTimer = null;

        const startModalHold = () => {
            if (modalHoldTimer) return;
            triggerBtn.classList.add('holding');
            modalHoldTimer = setTimeout(() => {
                modalHoldTimer = null;
                triggerBtn.classList.remove('holding');
                closeSOSModal();
                triggerSOS();
            }, SOS_HOLD_DURATION);

            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        };

        const cancelModalHold = () => {
            if (modalHoldTimer) {
                clearTimeout(modalHoldTimer);
                modalHoldTimer = null;
            }
            triggerBtn.classList.remove('holding');
        };

        triggerBtn.addEventListener('mousedown', startModalHold);
        triggerBtn.addEventListener('mouseup', cancelModalHold);
        triggerBtn.addEventListener('mouseleave', cancelModalHold);
        triggerBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startModalHold();
        }, { passive: false });
        triggerBtn.addEventListener('touchend', cancelModalHold);
        triggerBtn.addEventListener('touchcancel', cancelModalHold);
    }

    // Escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeSOSModal();
        }
    });

    console.log('[SOS] SOS modal setup complete');
}


function switchSOSTab(tabName) {
    document.querySelectorAll('.sos-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sos-tab-content').forEach(c => c.classList.remove('active'));

    const tab = document.querySelector(`.sos-tab[data-tab="${tabName}"]`);
    const content = document.getElementById(`sos-tab-${tabName}`);

    if (tab) tab.classList.add('active');
    if (content) content.classList.add('active');
}


function openSOSModal(mode = 'alerts') {
    const modal = document.getElementById('sos-modal');
    if (modal) {
        modal.classList.remove('hidden');
        switchSOSTab(mode);
        renderSOSAlerts();
    }
}

function closeSOSModal() {
    const modal = document.getElementById('sos-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}


/**
 * Format an alert timestamp for the list: time-of-day for today,
 * "Mon D, HH:MM" for older entries, and a safe label for invalid values.
 */
function formatTime(timestamp) {
    const date = new Date(Number(timestamp));
    if (!Number.isFinite(date.getTime())) return 'Unknown time';

    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isToday = date.toDateString() === new Date().toDateString();
    if (isToday) return time;

    const day = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${day}, ${time}`;
}

/**
 * Keep the badge on the "SOS Alerts" tab in sync with the list.
 * Hidden while there are no alerts.
 */
function updateSOSCount() {
    const badge = document.getElementById('sos-count');
    if (!badge) return;

    const count = sosAlerts.length;
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.toggle('hidden', count === 0);
}

/** Save + re-render + badge in one step (keeps every mutation path consistent). */
function persistAndRender() {
    saveSOSToStorage();
    renderSOSAlerts();
    updateSOSCount();
}

async function addSOSToList(sosData) {
    if (!sosData || typeof sosData !== 'object') return;

    // Ensure ipInfo exists
    if (!sosData.ipInfo || typeof sosData.ipInfo !== 'object') {
        sosData.ipInfo = { ip: 'Unknown' };
    }
    if (!Number.isFinite(Number(sosData.timestamp))) {
        sosData.timestamp = Date.now();
    }
    sosData.isOwn = Boolean(sosData.isOwn);

    // Fetch IP geolocation for remote alerts that carry a real IP.
    // Own/pending/unknown placeholders are skipped (ack fills ours in later).
    const ip = sosData.ipInfo.ip;
    if (!sosData.ipInfo.city && typeof ip === 'string' && ip && !IP_LOOKUP_SKIP.has(ip)) {
        try {
            const geoData = await fetchIPGeolocation(ip);
            sosData.ipInfo = { ...sosData.ipInfo, ...geoData };
        } catch (error) {
            console.log('[SOS] Could not fetch IP geolocation:', error);
        }
    }

    sosAlerts.unshift(sosData);
    if (sosAlerts.length > MAX_SOS_ALERTS) sosAlerts.pop();
    persistAndRender();
}

/** Enrich our own alert with IP geolocation once the server ack provided the IP. */
async function enrichIpInfo(entry) {
    const ip = entry && entry.ipInfo && entry.ipInfo.ip;
    if (!ip || IP_LOOKUP_SKIP.has(ip)) return;

    try {
        const geoData = await fetchIPGeolocation(ip);
        entry.ipInfo = { ...entry.ipInfo, ...geoData };
    } catch (error) {
        console.log('[SOS] Could not fetch IP geolocation:', error);
    }
    persistAndRender();
}

async function fetchIPGeolocation(ip) {
    try {
        const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
        if (!response.ok) throw new Error('IP geolocation fetch failed');
        const data = await response.json();
        return {
            city: data.city || '',
            country: data.country_name || '',
            region: data.region || ''
        };
    } catch (error) {
        console.log('[SOS] IP geolocation error:', error);
        return {};
    }
}

function renderSOSAlerts() {
    const list = document.getElementById('sos-alerts-list');
    if (!list) return;

    if (sosAlerts.length === 0) {
        list.innerHTML = `
            <div class="sos-empty">
                <span class="sos-empty-icon">✓</span>
                <p>No active SOS alerts</p>
                <small>All users are safe</small>
            </div>
        `;
        return;
    }

    // All SOS fields originate from remote clients - escape everything.
    list.innerHTML = sosAlerts.map((sos, index) => {
        const lat = sos?.location && Number(sos.location.latitude);
        const lng = sos?.location && Number(sos.location.longitude);
        const accuracy = Number(sos?.location?.accuracy) || 0;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ''; // Skip malformed entries

        const locationAvailable = sos.locationAvailable !== false;
        const safeSender = escapeHtml(sos.sender || 'Unknown');
        const safeIp = escapeHtml(sos.ipInfo?.ip || 'Unknown');
        const safePlatform = escapeHtml(sos.deviceInfo?.deviceType || sos.deviceInfo?.os || 'Unknown');
        const hasIpLocation = sos.ipInfo?.city && sos.ipInfo?.country;
        const hasBattery = sos.deviceInfo?.battery && Number.isFinite(sos.deviceInfo.battery.level);

        return `
        <div class="sos-alert-item ${sos.isOwn ? 'own' : ''}" data-index="${index}">
            <div class="sos-alert-header">
                <span class="sos-alert-sender">
                    ${sos.isOwn ? '📤' : '📥'} ${safeSender}
                </span>
                <span class="sos-alert-time">${formatTime(sos.timestamp)}</span>
            </div>
            <div class="sos-alert-details">
                <div class="sos-detail">
                    <span class="detail-label">📍 Location:</span>
                    <span class="detail-value">${locationAvailable ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : 'Unavailable'}</span>
                </div>
                ${locationAvailable ? `
                <div class="sos-detail">
                    <span class="detail-label">🎯 Accuracy:</span>
                    <span class="detail-value">${accuracy.toFixed(0)}m</span>
                </div>
                ` : ''}
                <div class="sos-detail">
                    <span class="detail-label">🌐 IP Address:</span>
                    <span class="detail-value">${safeIp}</span>
                </div>
                ${hasIpLocation ? `
                <div class="sos-detail">
                    <span class="detail-label">🏙️ Location:</span>
                    <span class="detail-value">${escapeHtml(sos.ipInfo.city)}, ${escapeHtml(sos.ipInfo.country)}</span>
                </div>
                ` : ''}
                <div class="sos-detail">
                    <span class="detail-label">📱 Device:</span>
                    <span class="detail-value">${safePlatform}</span>
                </div>
                ${hasBattery ? `
                <div class="sos-detail">
                    <span class="detail-label">🔋 Battery:</span>
                    <span class="detail-value">${Number(sos.deviceInfo.battery.level)}% ${sos.deviceInfo.battery.charging ? '⚡' : ''}</span>
                </div>
                ` : ''}
            </div>
            <div class="sos-alert-actions">
                ${locationAvailable ? `
                <button class="sos-action-btn view-map">
                    <span>🗺️</span> View on Map
                </button>
                ` : ''}
                <button class="sos-action-btn dismiss">
                    <span>✓</span> Dismiss
                </button>
            </div>
        </div>
    `;
    }).join('');
}

/**
 * Event delegation for the "View on Map" / "Dismiss" buttons (replaces the
 * previous inline onclick="window.*" handlers).
 */
function setupSOSListActions() {
    const list = document.getElementById('sos-alerts-list');
    if (!list) return;

    list.addEventListener('click', (e) => {
        const button = e.target.closest('.sos-action-btn');
        if (!button) return;
        const item = button.closest('.sos-alert-item');
        if (!item || item.dataset.index === undefined) return;

        const index = Number(item.dataset.index);
        if (!Number.isInteger(index) || index < 0 || index >= sosAlerts.length) return;

        if (button.classList.contains('view-map')) {
            viewSOSOnMap(index);
        } else if (button.classList.contains('dismiss')) {
            dismissSOS(index);
        }
    });
}

function viewSOSOnMap(index) {
    const sos = sosAlerts[index];
    if (!sos || sos.locationAvailable === false) return;
    if (isValidLatLng(sos.location?.latitude, sos.location?.longitude) && window.focusMapOnLocation) {
        window.focusMapOnLocation(sos.location.latitude, sos.location.longitude);
        closeSOSModal();
    }
}

/**
 * Dismiss SOS alert
 */
function dismissSOS(index) {
    if (!Number.isInteger(index) || index < 0 || index >= sosAlerts.length) return;
    sosAlerts.splice(index, 1);
    persistAndRender();
}

/**
 * Play SOS notification sound
 */
function playSOSSound() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Resume audio context if suspended
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        // Create an alarm-like sound
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'square';
        gainNode.gain.value = 0.3;

        // Alarm pattern
        const now = audioContext.currentTime;

        for (let i = 0; i < 3; i++) {
            oscillator.frequency.setValueAtTime(880, now + i * 0.4);
            oscillator.frequency.setValueAtTime(660, now + i * 0.4 + 0.2);
        }

        oscillator.start(now);
        oscillator.stop(now + 1.2);

    } catch (error) {
        console.log('[SOS] Could not play sound:', error);
    }
}

function initSOSSocketHandlers() {
    socket.on('sos-alert', async (data) => {
        console.log('[SOS] Received SOS alert:', data);
        if (!data || typeof data !== 'object') return;

        // Play sound
        playSOSSound();

        // Vibrate
        if (navigator.vibrate) {
            navigator.vibrate([500, 200, 500, 200, 500]);
        }

        // Activate overlay
        const overlay = document.getElementById('sos-overlay');
        if (overlay) {
            overlay.classList.add('active');
            setTimeout(() => overlay.classList.remove('active'), 10000); // 10s overlay
        }

        // Show notification
        addNotification(`🚨 SOS from ${data.sender || 'a user'}!`);

        // Show browser notification if permitted
        showBrowserNotification(data);

        // Flash the SOS button
        const sosButton = document.getElementById('sos-btn');
        if (sosButton) {
            sosButton.classList.add('incoming');
            setTimeout(() => sosButton.classList.remove('incoming'), 3000);
        }

        // Add to list before opening the modal so the alert is visible immediately
        try {
            await addSOSToList({ ...data, isOwn: false });
        } catch (error) {
            console.error('[SOS] Could not add alert to list:', error);
        }

        // Auto-open modal
        openSOSModal('alerts');
    });
}


async function showBrowserNotification(sosData) {
    if (!('Notification' in window)) return;

    const hasLocation = sosData.locationAvailable !== false &&
        isValidLatLng(Number(sosData.location?.latitude), Number(sosData.location?.longitude));

    if (Notification.permission === 'granted') {
        try {
            new Notification('🚨 SOS Alert!', {
                body: `Emergency from ${sosData.sender || 'a user'}\n` +
                    (hasLocation
                        ? `Location: ${Number(sosData.location.latitude).toFixed(4)}, ${Number(sosData.location.longitude).toFixed(4)}`
                        : 'Location unavailable'),
                icon: '/assets/icons/icon.svg',
                tag: 'sos-alert',
                requireInteraction: true
            });
        } catch (e) {
            console.warn('[SOS] Could not show browser notification:', e);
        }
    } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            showBrowserNotification(sosData);
        }
    }
}


function saveSOSToStorage() {
    try {
        localStorage.setItem('sosAlerts', JSON.stringify(sosAlerts.slice(0, 20)));
    } catch (e) {
        console.log('[SOS] Could not save to storage');
    }
}


function loadSOSFromStorage() {
    try {
        const stored = localStorage.getItem('sosAlerts');
        if (!stored) return;

        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return;

        // Validate persisted entries - localStorage content can be stale or
        // hand-edited, and the renderer assumes a usable shape.
        sosAlerts = parsed.filter((sos) =>
            sos &&
            typeof sos === 'object' &&
            sos.location &&
            isValidLatLng(Number(sos.location.latitude), Number(sos.location.longitude)) &&
            typeof sos.sender === 'string'
        ).slice(0, 20);

        renderSOSAlerts();
        updateSOSCount();
    } catch (e) {
        console.log('[SOS] Could not load from storage');
    }
}

// Export for external use
export { openSOSModal, closeSOSModal };
