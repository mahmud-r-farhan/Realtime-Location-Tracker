import { addNotification } from './notification.js';
import { socket } from './socket.js';

// Battery thresholds
const LOW_BATTERY_THRESHOLD = 20;
const CRITICAL_BATTERY_THRESHOLD = 10;

// Track devices we've already alerted about
const alertedDevices = {
    low: new Set(),
    critical: new Set()
};

// Store all device battery info
const deviceBatteries = new Map();

// UI elements
let batteryPanelElement = null;

export function updateDeviceBattery(deviceId, deviceName, batteryInfo) {
    if (!batteryInfo || typeof batteryInfo.level !== 'number') return;

    const previousInfo = deviceBatteries.get(deviceId);
    deviceBatteries.set(deviceId, {
        deviceName,
        level: batteryInfo.level,
        charging: batteryInfo.charging || false,
        lastUpdate: Date.now()
    });

    // Check for alerts (only if not charging)
    if (!batteryInfo.charging) {
        checkBatteryAlerts(deviceId, deviceName, batteryInfo.level, previousInfo);
    } else {
        // Clear alerts if charging
        alertedDevices.low.delete(deviceId);
        alertedDevices.critical.delete(deviceId);
    }

    // Update UI if panel is open
    updateBatteryPanel();
}


function checkBatteryAlerts(deviceId, deviceName, level, previousInfo) {
    // Critical battery alert (10%)
    if (level <= CRITICAL_BATTERY_THRESHOLD && !alertedDevices.critical.has(deviceId)) {
        alertedDevices.critical.add(deviceId);
        showBatteryAlert(deviceName, level, 'critical');
        playBatteryAlertSound('critical');
    }
    // Low battery alert (20%)
    else if (level <= LOW_BATTERY_THRESHOLD && level > CRITICAL_BATTERY_THRESHOLD && !alertedDevices.low.has(deviceId)) {
        alertedDevices.low.add(deviceId);
        showBatteryAlert(deviceName, level, 'low');
        playBatteryAlertSound('low');
    }
    // Reset alerts if battery goes above threshold (was charged)
    else if (level > LOW_BATTERY_THRESHOLD) {
        alertedDevices.low.delete(deviceId);
        alertedDevices.critical.delete(deviceId);
    }
}

/**
 * Show battery alert notification
 */
function showBatteryAlert(deviceName, level, type) {
    const icon = type === 'critical' ? '🪫' : '🔋';
    const message = type === 'critical'
        ? `${icon} CRITICAL: ${deviceName} battery at ${level}%!`
        : `${icon} Low battery: ${deviceName} at ${level}%`;

    addNotification(message);

    // Show browser notification if permitted
    if (Notification.permission === 'granted') {
        new Notification(`Battery ${type === 'critical' ? 'Critical' : 'Low'}`, {
            body: `${deviceName} battery is at ${level}%`,
            icon: '/assets/icons/icon.svg',
            tag: `battery-${type}-${deviceName}`
        });
    }
}

/**
 * Play battery alert sound
 */
function playBatteryAlertSound(type) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (type === 'critical') {
            // More urgent sound for critical
            oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
            oscillator.type = 'square';
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        } else {
            // Gentle beep for low
            oscillator.frequency.setValueAtTime(660, audioContext.currentTime);
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
        }

        oscillator.start(audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        console.warn('Could not play battery alert sound:', e);
    }
}

/**
 * Remove device from battery tracking
 */
export function removeDeviceBattery(deviceId) {
    deviceBatteries.delete(deviceId);
    alertedDevices.low.delete(deviceId);
    alertedDevices.critical.delete(deviceId);
    updateBatteryPanel();
}

/**
 * Get all device battery info
 * @returns {Array} Array of battery info objects
 */
export function getAllBatteryInfo() {
    return Array.from(deviceBatteries.entries()).map(([id, info]) => ({
        id,
        ...info
    }));
}

/**
 * Get battery icon based on level and charging status
 */
function getBatteryIcon(level, charging) {
    if (charging) return '⚡';
    if (level > 75) return '🔋';
    if (level > 50) return '🔋';
    if (level > 25) return '🪫';
    if (level > 10) return '🪫';
    return '🪫';
}

/**
 * Get battery color class based on level
 */
function getBatteryClass(level, charging) {
    if (charging) return 'battery-charging';
    if (level <= CRITICAL_BATTERY_THRESHOLD) return 'battery-critical';
    if (level <= LOW_BATTERY_THRESHOLD) return 'battery-low';
    if (level <= 50) return 'battery-medium';
    return 'battery-full';
}

/**
 * Create battery panel HTML
 */
function createBatteryPanel() {
    if (document.getElementById('battery-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'battery-panel';
    panel.className = 'battery-panel hidden';
    panel.innerHTML = `
        <div class="battery-panel-header">
            <h3>🔋 Battery Status</h3>
            <button id="close-battery-panel" class="close-btn">&times;</button>
        </div>
        <div class="battery-panel-content">
            <div id="battery-list" class="battery-list"></div>
        </div>
    `;

    document.body.appendChild(panel);
    batteryPanelElement = panel;

    // Close button handler
    document.getElementById('close-battery-panel').addEventListener('click', closeBatteryPanel);

    addBatteryStyles();
}

/**
 * Update battery panel content
 */
function updateBatteryPanel() {
    const batteryList = document.getElementById('battery-list');
    if (!batteryList) return;

    const batteries = getAllBatteryInfo().sort((a, b) => a.level - b.level);

    if (batteries.length === 0) {
        batteryList.innerHTML = `
            <div class="battery-empty">
                <span>🔋</span>
                <p>No battery data available</p>
            </div>
        `;
        return;
    }

    batteryList.innerHTML = batteries.map(device => `
        <div class="battery-item ${getBatteryClass(device.level, device.charging)}">
            <div class="battery-device">
                <span class="device-name">${device.deviceName}</span>
                <span class="battery-time">${formatTimeSince(device.lastUpdate)}</span>
            </div>
            <div class="battery-indicator">
                <div class="battery-bar">
                    <div class="battery-fill" style="width: ${device.level}%"></div>
                </div>
                <span class="battery-percent">
                    ${device.charging ? '⚡' : ''} ${device.level}%
                </span>
            </div>
        </div>
    `).join('');
}

/**
 * Format time since last update
 */
function formatTimeSince(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
}

/**
 * Open battery panel
 */
export function openBatteryPanel() {
    createBatteryPanel();
    updateBatteryPanel();
    batteryPanelElement.classList.remove('hidden');
}

/**
 * Close battery panel
 */
export function closeBatteryPanel() {
    if (batteryPanelElement) {
        batteryPanelElement.classList.add('hidden');
    }
}

/**
 * Add battery monitor styles
 */
function addBatteryStyles() {
    if (document.getElementById('battery-styles')) return;

    const style = document.createElement('style');
    style.id = 'battery-styles';
    style.textContent = `
        .battery-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 90%;
            max-width: 400px;
            max-height: 80vh;
            background: var(--card-bg, #fff);
            border-radius: 16px;
            box-shadow: 0 20px 50px var(--shadow-color, rgba(0,0,0,0.2));
            z-index: 10001;
            overflow: hidden;
            animation: slideUp 0.3s ease;
        }

        .battery-panel.hidden {
            display: none;
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translate(-50%, -45%);
            }
            to {
                opacity: 1;
                transform: translate(-50%, -50%);
            }
        }

        .battery-panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            background: var(--bg-secondary, #f8f9fa);
            border-bottom: 1px solid var(--border-color, #dee2e6);
        }

        .battery-panel-header h3 {
            margin: 0;
            font-size: 18px;
            color: var(--text-primary, #212529);
        }

        .battery-panel-header .close-btn {
            width: 32px;
            height: 32px;
            border: none;
            background: var(--bg-tertiary, #e9ecef);
            border-radius: 50%;
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-secondary);
            transition: all 0.2s;
        }

        .battery-panel-header .close-btn:hover {
            background: var(--danger-color);
            color: white;
        }

        .battery-panel-content {
            padding: 16px;
            max-height: 400px;
            overflow-y: auto;
        }

        .battery-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .battery-item {
            padding: 14px;
            background: var(--bg-secondary, #f8f9fa);
            border-radius: 12px;
            border-left: 4px solid var(--success-color);
        }

        .battery-item.battery-low {
            border-left-color: var(--warning-color);
        }

        .battery-item.battery-critical {
            border-left-color: var(--danger-color);
            animation: pulse-critical 2s infinite;
        }

        .battery-item.battery-charging {
            border-left-color: var(--accent-color);
        }

        @keyframes pulse-critical {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }

        .battery-device {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        }

        .device-name {
            font-weight: 600;
            color: var(--text-primary);
        }

        .battery-time {
            font-size: 12px;
            color: var(--text-muted);
        }

        .battery-indicator {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .battery-bar {
            flex: 1;
            height: 8px;
            background: var(--bg-tertiary, #e9ecef);
            border-radius: 4px;
            overflow: hidden;
        }

        .battery-fill {
            height: 100%;
            background: var(--success-color);
            border-radius: 4px;
            transition: width 0.3s ease;
        }

        .battery-low .battery-fill {
            background: var(--warning-color);
        }

        .battery-critical .battery-fill {
            background: var(--danger-color);
        }

        .battery-charging .battery-fill {
            background: var(--accent-color);
        }

        .battery-percent {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary);
            min-width: 50px;
            text-align: right;
        }

        .battery-empty {
            text-align: center;
            padding: 40px 20px;
            color: var(--text-muted);
        }

        .battery-empty span {
            font-size: 48px;
            display: block;
            margin-bottom: 10px;
        }
    `;

    document.head.appendChild(style);
}

/**
 * Initialize battery monitoring
 */
export function initBatteryMonitor() {
    // Request notification permission for battery alerts
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // Listen for location updates to extract battery info
    socket.on('receive-location', (data) => {
        if (data.deviceInfo && data.deviceInfo.battery) {
            updateDeviceBattery(data.id, data.deviceName, data.deviceInfo.battery);
        }
    });

    // Clean up on user disconnect
    socket.on('user-disconnect', (data) => {
        removeDeviceBattery(data.peerId);
    });

    console.log('🔋 Battery monitor initialized');
}

// Export for global access
window.openBatteryPanel = openBatteryPanel;
