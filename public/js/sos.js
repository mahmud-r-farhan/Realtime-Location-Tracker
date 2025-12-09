import { socket } from './socket.js';
import { getDeviceInfo, getDeviceName } from './device.js';
import { addNotification } from './notification.js';

// SOS State
let sosHoldTimer = null;
let isSOSActive = false;
let sosAlerts = [];
const SOS_HOLD_DURATION = 2000; // 2 seconds hold to trigger SOS

// Audio context for SOS sound
let audioContext = null;

export function initSOS() {
    setupSOSButton();
    setupSOSModal();
    initSOSSocketHandlers();
    loadSOSFromStorage();
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

    // Touch events for mobile
    sosButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startSOSHold();
    }, { passive: false });
    sosButton.addEventListener('touchend', cancelSOSHold);
    sosButton.addEventListener('touchcancel', cancelSOSHold);

    // Click handler to open modal (only if not holding)
    let clickTimer = null;
    sosButton.addEventListener('click', () => {
        if (!isSOSActive && !sosHoldTimer) {
            // Small delay to differentiate from hold
            clickTimer = setTimeout(() => {
                openSOSModal();
            }, 50);
        }
    });

    console.log('[SOS] SOS button setup complete');
}

function startSOSHold() {
    if (sosHoldTimer) return;

    const sosButton = document.getElementById('sos-btn');
    sosButton.classList.add('holding');

    sosHoldTimer = setTimeout(() => {
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


async function triggerSOS() {
    isSOSActive = true;
    sosHoldTimer = null;

    const sosButton = document.getElementById('sos-btn');
    sosButton.classList.remove('holding');
    sosButton.classList.add('triggered');

    // Vibrate pattern (mobile)
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
    }

    // Get current location and device info
    try {
        const position = await getCurrentPosition();
        const deviceInfo = await getDeviceInfo();

        const sosData = {
            sender: localStorage.getItem('userName') || getDeviceName(),
            location: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            },
            deviceInfo: {
                ...deviceInfo,
                userAgent: navigator.userAgent,
                screenSize: `${screen.width}x${screen.height}`,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },

            timestamp: Date.now(),
            message: 'Emergency SOS Alert!'
        };

        // Emit SOS to all users
        socket.emit('sos-alert', sosData);

        // Add to local notifications
        addNotification('⚠️ SOS sent! All users have been alerted.');

        // Add to local SOS list
        addSOSToList({ ...sosData, isOwn: true });

        // Open modal to show confirmation
        openSOSModal('alerts');

    } catch (error) {
        console.error('[SOS] Error getting location:', error);
        addNotification('❌ SOS failed - Could not get location');
        sosButton.classList.remove('triggered');
        isSOSActive = false;
    }

    // Reset after 5 seconds
    setTimeout(() => {
        isSOSActive = false;
        sosButton.classList.remove('triggered');
    }, 5000);
}


function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    });
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
    closeBtn.addEventListener('click', closeSOSModal);

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
            triggerBtn.classList.add('holding');
            modalHoldTimer = setTimeout(() => {
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


async function addSOSToList(sosData) {
    // Fetch IP geolocation if not already present
    if (!sosData.ipInfo.city && sosData.ipInfo.ip && sosData.ipInfo.ip !== 'Unknown') {
        try {
            const geoData = await fetchIPGeolocation(sosData.ipInfo.ip);
            sosData.ipInfo = { ...sosData.ipInfo, ...geoData };
        } catch (error) {
            console.log('[SOS] Could not fetch IP geolocation:', error);
        }
    }
    
    sosAlerts.unshift(sosData);
    if (sosAlerts.length > 50) sosAlerts.pop();
    saveSOSToStorage();
    renderSOSAlerts();
    updateSOSCount();
}

async function fetchIPGeolocation(ip) {
    try {
        const response = await fetch(`https://ipapi.co/${ip}/json/`);
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

    list.innerHTML = sosAlerts.map((sos, index) => `
        <div class="sos-alert-item ${sos.isOwn ? 'own' : ''}" data-index="${index}">
            <div class="sos-alert-header">
                <span class="sos-alert-sender">
                    ${sos.isOwn ? '📤' : '📥'} ${sos.sender}
                </span>
                <span class="sos-alert-time">${formatTime(sos.timestamp)}</span>
            </div>
            <div class="sos-alert-details">
                <div class="sos-detail">
                    <span class="detail-label">📍 Location:</span>
                    <span class="detail-value">${sos.location.latitude.toFixed(6)}, ${sos.location.longitude.toFixed(6)}</span>
                </div>
                <div class="sos-detail">
                    <span class="detail-label">🎯 Accuracy:</span>
                    <span class="detail-value">${sos.location.accuracy.toFixed(0)}m</span>
                </div>
                <div class="sos-detail">
                    <span class="detail-label">🌐 IP Address:</span>
                    <span class="detail-value">${sos.ipInfo?.ip || 'Unknown'}</span>
                </div>
                ${sos.ipInfo?.city && sos.ipInfo?.country ? `
                <div class="sos-detail">
                    <span class="detail-label">🏙️ Location:</span>
                    <span class="detail-value">${sos.ipInfo.city}, ${sos.ipInfo.country}</span>
                </div>
                ` : ''}
                <div class="sos-detail">
                    <span class="detail-label">📱 Device:</span>
                    <span class="detail-value">${sos.deviceInfo?.platform || 'Unknown'}</span>
                </div>
                ${sos.deviceInfo?.battery ? `
                <div class="sos-detail">
                    <span class="detail-label">🔋 Battery:</span>
                    <span class="detail-value">${sos.deviceInfo.battery.level}% ${sos.deviceInfo.battery.charging ? '⚡' : ''}</span>
                </div>
                ` : ''}
            </div>
            <div class="sos-alert-actions">
                <button class="sos-action-btn view-map" onclick="window.viewSOSOnMap(${index})">
                    <span>🗺️</span> View on Map
                </button>
                <button class="sos-action-btn dismiss" onclick="window.dismissSOS(${index})">
                    <span>✓</span> Dismiss
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Format timestamp
 */
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
}

/**
 * Update SOS count badge
 */
function updateSOSCount() {
    const countEl = document.getElementById('sos-count');
    if (!countEl) return;

    const count = sosAlerts.filter(s => !s.dismissed).length;

    if (count > 0) {
        countEl.textContent = count;
        countEl.classList.remove('hidden');
    } else {
        countEl.classList.add('hidden');
    }
}

window.viewSOSOnMap = function (index) {
    const sos = sosAlerts[index];
    if (sos && window.focusMapOnLocation) {
        window.focusMapOnLocation(sos.location.latitude, sos.location.longitude);
        closeSOSModal();
    }
};

/**
 * Dismiss SOS alert (global function)
 */
window.dismissSOS = function (index) {
    sosAlerts.splice(index, 1);
    saveSOSToStorage();
    renderSOSAlerts();
    updateSOSCount();
};

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
    socket.on('sos-alert', (data) => {
        console.log('[SOS] Received SOS alert:', data);

        // Play sound
        playSOSSound();

        // Vibrate
        if (navigator.vibrate) {
            navigator.vibrate([500, 200, 500, 200, 500]);
        }

        // Add to list
        addSOSToList({ ...data, isOwn: false });

        // Show notification
        addNotification(`🚨 SOS from ${data.sender}!`);

        // Show browser notification if permitted
        showBrowserNotification(data);

        // Flash the SOS button
        const sosButton = document.getElementById('sos-btn');
        if (sosButton) {
            sosButton.classList.add('incoming');
            setTimeout(() => sosButton.classList.remove('incoming'), 3000);
        }

        // Auto-open modal
        openSOSModal('alerts');
    });
}


async function showBrowserNotification(sosData) {
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            new Notification('🚨 SOS Alert!', {
                body: `Emergency from ${sosData.sender}\nLocation: ${sosData.location.latitude.toFixed(4)}, ${sosData.location.longitude.toFixed(4)}`,
                icon: '/assets/icons/icon.svg',
                tag: 'sos-alert',
                requireInteraction: true
            });
        } else if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                showBrowserNotification(sosData);
            }
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
        if (stored) {
            sosAlerts = JSON.parse(stored);
            updateSOSCount();
        }
    } catch (e) {
        console.log('[SOS] Could not load from storage');
    }
}

// Export for external use
export { openSOSModal, closeSOSModal };
