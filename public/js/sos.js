import { socket, getJoinedRoom } from './socket.js';
import { getDeviceInfoSafely, getDeviceName } from './device.js';
import { getUserName } from './profile.js';
import { addNotification } from './notification.js';
import { markers, showSOSLocation } from './map.js';
import { escapeHtml, isValidLatLng } from './utils.js';

// SOS State
let sosHoldTimer = null;
let cancelModalHold = null;
let sosReturnFocus = null;
let isSOSActive = false;
let sosContextVersion = 0;
window.addEventListener('tracker-room-changing', () => { sosContextVersion++; });
socket.on('disconnect', () => { sosContextVersion++; });
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
    setupSOSNotifications();
    initSOSSocketHandlers();
    loadSOSFromStorage();
    setupSOSListActions();
    console.log('[SOS] SOS module initialized');
}


function setupSOSNotifications() {
    const button = document.getElementById('sos-notifications-btn');
    const hint = document.getElementById('sos-notification-hint');
    if (!button || !hint) return;
    function update() {
        if (!('Notification' in window)) {
            hint.textContent = 'Browser notifications are not supported here.';
            button.hidden = true;
        } else if (Notification.permission === 'granted') {
            hint.textContent = 'Browser notifications are enabled when supported. They do not guarantee delivery.';
            button.hidden = true;
        } else if (Notification.permission === 'denied') {
            hint.textContent = 'Notifications are blocked. Change browser permissions to enable them.';
            button.hidden = true;
        } else {
            hint.textContent = 'Optional browser notifications do not guarantee delivery.';
            button.hidden = false;
        }
    }
    button.addEventListener('click', async () => {
        try { await Notification.requestPermission(); } catch (error) { console.warn('[SOS] Notification permission failed:', error); }
        update();
    });
    update();
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

function startSOSHold(event) {
    if (isSOSActive || sosHoldTimer || (event && event.button !== undefined && event.button !== 0)) return;

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

    for (const [index, options] of attempts.entries()) {
        if (!navigator.geolocation) break;
        let timer;
        try {
            // Some implementations never invoke either callback despite their
            // timeout option. Bound each attempt independently of the browser.
            const position = await new Promise((resolve, reject) => {
                timer = setTimeout(() => reject(new Error('Location timed out')), options.timeout + 250);
                navigator.geolocation.getCurrentPosition(resolve, reject, options);
            });
            if (isValidLatLng(position.coords.latitude, position.coords.longitude)) {
                const accuracy = position.coords.accuracy == null ? null : Number(position.coords.accuracy);
                return {
                    latitude: position.coords.latitude, longitude: position.coords.longitude,
                    accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
                    locationAvailable: true, locationSource: index === 0 ? 'fresh' : 'cached'
                };
            }
        } catch (error) {
            console.warn('[SOS] Location attempt failed:', error?.message || error);
        } finally { clearTimeout(timer); }
    }

    const marker = markers[socket.id];
    const ll = marker?.getLatLng();
    if (ll && isValidLatLng(ll.lat, ll.lng)) {
        const accuracy = marker._trackerFix?.accuracy;
        return { latitude: ll.lat, longitude: ll.lng, accuracy: Number.isFinite(accuracy) ? accuracy : null,
            locationAvailable: true, locationSource: 'last-shared' };
    }
    return { latitude: 0, longitude: 0, accuracy: null, locationAvailable: false, locationSource: 'unknown' };
}

function setSOSStatus(message, state = '') {
    const status = document.getElementById('sos-status');
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
    status.classList.toggle('hidden', !message);
}

async function triggerSOS() {
    if (isSOSActive) return;
    isSOSActive = true;
    sosHoldTimer = null;
    const room = getJoinedRoom();
    const connectionId = socket.id;
    const sender = getUserName() || getDeviceName();
    const contextVersion = sosContextVersion;
    const sosButton = document.getElementById('sos-btn');
    const triggerButton = document.getElementById('sos-trigger-btn');
    sosButton?.classList.remove('holding');
    sosButton?.classList.add('triggered');
    if (triggerButton) triggerButton.disabled = true;
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
    openSOSModal('send');
    setSOSStatus('Preparing alert and checking location. This does not contact emergency services.', 'pending');

    try {
        if (!socket.connected || !room) {
            addSOSToList({ sender, room: room || 'Unknown', timestamp: Date.now(),
                location: { latitude: 0, longitude: 0, accuracy: null }, locationAvailable: false,
                isOwn: true, delivery: 'not-sent', ipInfo: { ip: 'Unknown' } });
            setSOSStatus('SOS not sent: not connected to a room. Contact emergency services directly.', 'error');
            addNotification('⚠️ SOS not sent: not connected to a room.');
            if (!document.getElementById('sos-modal')?.classList.contains('hidden')) switchSOSTab('alerts');
            return;
        }
        const [location, deviceInfo] = await Promise.all([resolveSOSLocation(), getDeviceInfoSafely()]);
        const entry = {
            sender,
            location: { latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy },
            locationAvailable: location.locationAvailable,
            locationSource: location.locationSource,
            deviceInfo: deviceInfo || {}, ipInfo: { ip: IP_PENDING }, timestamp: Date.now(),
            message: 'Emergency SOS Alert!', isOwn: true, room: room || 'Unknown', delivery: 'pending'
        };
        // Insert immediately; IP lookup must never delay the alert or its display.
        addSOSToList(entry);
        if (!document.getElementById('sos-modal')?.classList.contains('hidden')) switchSOSTab('alerts');

        if (!socket.connected || !room || socket.id !== connectionId || getJoinedRoom() !== room || sosContextVersion !== contextVersion) {
            entry.delivery = 'not-sent';
            entry.ipInfo = { ip: 'Unknown' };
            setSOSStatus('SOS not sent: connection or room changed. Contact emergency services directly.', 'error');
            addNotification('⚠️ SOS not sent: connection or room changed.');
        } else {
            const result = await new Promise(resolve => {
                socket.timeout(5000).emit('sos-alert', { ...entry, expectedRoom: room, expectedSocketId: connectionId }, (error, response) => resolve({ error, response }));
            });
            if (!result.error && result.response?.success) {
                entry.delivery = 'relayed';
                entry.ipInfo = { ip: String(result.response.ip || 'Unknown') };
                setSOSStatus('Relayed to the room. Receipt and response are not guaranteed.', 'relayed');
                addNotification('⚠️ SOS relayed to connected room members. Receipt is not guaranteed.');
                enrichIpInfo(entry);
            } else {
                entry.delivery = result.response?.error ? 'not-sent' : 'unconfirmed';
                entry.ipInfo = { ip: 'Unknown' };
                setSOSStatus(result.response?.error ? `SOS not sent: ${result.response.error} Contact emergency services directly.` : 'SOS delivery not confirmed. Contact emergency services directly.', 'error');
                addNotification(`⚠️ SOS ${result.response?.error ? 'not sent' : 'delivery not confirmed'}. Contact emergency services directly.`);
            }
        }
        persistAndRender();
    } catch (error) {
        console.error('[SOS] Error triggering SOS:', error);
        setSOSStatus('SOS failed. Contact emergency services directly.', 'error');
        addNotification('❌ SOS failed. Contact emergency services directly.');
    } finally {
        isSOSActive = false;
        sosButton?.classList.remove('triggered');
        if (triggerButton) triggerButton.disabled = false;
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

        const startModalHold = (event) => {
            if (isSOSActive || modalHoldTimer || (event && event.button !== undefined && event.button !== 0)) return;
            triggerBtn.classList.add('holding');
            modalHoldTimer = setTimeout(() => {
                modalHoldTimer = null;
                triggerBtn.classList.remove('holding');
                triggerSOS();
            }, SOS_HOLD_DURATION);

            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        };

        cancelModalHold = () => {
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
        triggerBtn.addEventListener('keydown', event => {
            if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
                event.preventDefault();
                startModalHold();
            }
        });
        triggerBtn.addEventListener('keyup', event => {
            if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); cancelModalHold(); }
        });
        triggerBtn.addEventListener('blur', cancelModalHold);
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
    document.querySelectorAll('.sos-tab').forEach(t => {
        const active = t.dataset.tab === tabName;
        t.classList.toggle('active', active);
        t.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('.sos-tab-content').forEach(c => c.classList.remove('active'));

    const content = document.getElementById(`sos-tab-${tabName}`);

    if (content) content.classList.add('active');
}


function openSOSModal(mode = 'alerts') {
    const modal = document.getElementById('sos-modal');
    if (modal) {
        if (modal.classList.contains('hidden')) sosReturnFocus = document.activeElement;
        modal.classList.remove('hidden');
        switchSOSTab(mode);
        document.getElementById('sos-modal-close')?.focus();
        renderSOSAlerts();
    }
}

function closeSOSModal() {
    const modal = document.getElementById('sos-modal');
    if (modal) {
        cancelModalHold?.();
        modal.classList.add('hidden');
        if (sosReturnFocus && typeof sosReturnFocus.focus === 'function') sosReturnFocus.focus();
        sosReturnFocus = null;
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

function addSOSToList(sosData) {
    if (!sosData || typeof sosData !== 'object') return;
    if (!sosData.ipInfo || typeof sosData.ipInfo !== 'object') sosData.ipInfo = { ip: 'Unknown' };
    if (!Number.isFinite(Number(sosData.timestamp))) sosData.timestamp = Date.now();
    sosData.isOwn = Boolean(sosData.isOwn);
    sosAlerts.unshift(sosData);
    if (sosAlerts.length > MAX_SOS_ALERTS) sosAlerts.pop();
    persistAndRender();
    if (!sosData.isOwn && !sosData.ipInfo.city) enrichIpInfo(sosData);
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
    if (sosAlerts.includes(entry)) persistAndRender();
}

async function fetchIPGeolocation(ip) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
        const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { signal: controller.signal });
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
    } finally {
        clearTimeout(timeout);
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
                <small>SOS history is stored on this browser, including alerts from previous rooms.</small>
            </div>
        `;
        return;
    }

    // All SOS fields originate from remote clients - escape everything.
    list.innerHTML = sosAlerts.map((sos, index) => {
        const lat = sos?.location && Number(sos.location.latitude);
        const lng = sos?.location && Number(sos.location.longitude);
        const accuracy = sos?.location?.accuracy == null ? null : Number(sos.location.accuracy);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ''; // Skip malformed entries

        const locationAvailable = sos.locationAvailable !== false;
        const safeSender = escapeHtml(sos.sender || 'Unknown');
        const safeIp = escapeHtml(sos.ipInfo?.ip || 'Unknown');
        const safePlatform = escapeHtml(sos.deviceInfo?.deviceType || sos.deviceInfo?.os || 'Unknown');
        const hasIpLocation = sos.ipInfo?.city && sos.ipInfo?.country;
        const hasBattery = sos.deviceInfo?.battery && Number.isFinite(sos.deviceInfo.battery.level);
        const deliveryLabels = { pending: 'Sending…', relayed: 'Relayed to room · receipt not guaranteed', 'not-sent': 'Not sent', unconfirmed: 'Delivery not confirmed' };
        const delivery = sos.isOwn && deliveryLabels[sos.delivery];
        const sourceLabels = { fresh: 'Fresh location request', cached: 'Cached location may be older', 'last-shared': 'Last shared location may be old' };
        const source = sourceLabels[sos.locationSource];

        return `
        <div class="sos-alert-item ${sos.isOwn ? 'own' : ''}" data-index="${index}">
            <div class="sos-alert-header">
                <span class="sos-alert-sender">
                    ${sos.isOwn ? '📤' : '📥'} ${safeSender}
                </span>
                <span class="sos-alert-time">${formatTime(sos.timestamp)}</span>
            </div>
            ${delivery ? `<p class="sos-delivery" data-state="${escapeHtml(sos.delivery)}">${escapeHtml(delivery)}</p>` : ''}
            <p class="sos-history-room">Room: ${escapeHtml(sos.room || 'Unknown (older alert)')} · Stored on this browser</p>
            <div class="sos-alert-details">
                <div class="sos-detail">
                    <span class="detail-label">📍 Location:</span>
                    <span class="detail-value">${locationAvailable ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : 'Unavailable'}</span>
                </div>
                ${locationAvailable ? `
                <div class="sos-detail">
                    <span class="detail-label">🎯 Accuracy:</span>
                    <span class="detail-value">${Number.isFinite(accuracy) ? `Estimated ±${accuracy.toFixed(0)} m` : 'Unavailable'}</span>
                </div>
                ${source ? `<div class="sos-detail"><span class="detail-label">Fix:</span><span class="detail-value">${escapeHtml(source)}</span></div>` : ''}
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
    if (isValidLatLng(sos.location?.latitude, sos.location?.longitude)) {
        showSOSLocation(sos);
        window.dispatchEvent(new Event('tracker-show-map'));
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
        if (!data || typeof data !== 'object' || data.room !== getJoinedRoom()) return;

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
        ).slice(0, 20).map(sos => sos.delivery === 'pending' ? { ...sos, delivery: 'unconfirmed' } : sos);

        renderSOSAlerts();
        updateSOSCount();
    } catch (e) {
        console.log('[SOS] Could not load from storage');
    }
}

// Export for external use
export { openSOSModal, closeSOSModal };
