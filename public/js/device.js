// Browser identification is best-effort: browsers may reduce or spoof these hints.
export function detectDevice(userAgent = '', platform = '', touchPoints = 0) {
    const ua = String(userAgent);
    const plat = String(platform);
    if (/android/i.test(ua)) return { name: 'Android Device', type: 'Android', os: 'Android' };
    if (/iPad|iPhone|iPod/i.test(ua) || (/Macintosh|MacIntel/i.test(`${ua} ${plat}`) && touchPoints > 1)) {
        return { name: 'iOS Device', type: 'iOS', os: 'iOS / iPadOS' };
    }
    if (/CrOS/i.test(ua)) return { name: 'Chromebook', type: 'ChromeOS', os: 'ChromeOS' };
    if (/Windows/i.test(ua) || /^Win/i.test(plat)) return { name: 'Windows PC', type: 'Windows', os: 'Windows' };
    if (/Macintosh|Mac OS/i.test(ua) || /^Mac/i.test(plat)) return { name: 'Mac', type: 'Mac', os: 'macOS' };
    if (/Linux/i.test(`${ua} ${plat}`)) return { name: 'Linux PC', type: 'Linux', os: 'Linux' };
    return { name: 'Unknown Device', type: 'Unknown', os: 'Unknown' };
}

export function getDeviceName() {
    return detectDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints).name;
}

// Device info changes rarely (and costs several API reads to build), so it is
// cached briefly instead of being recomputed on every location ping.
const DEVICE_INFO_CACHE_TTL = 30_000;
let cachedDeviceInfo = null;
let deviceInfoFetchedAt = 0;

export async function getDeviceInfo(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedDeviceInfo && now - deviceInfoFetchedAt < DEVICE_INFO_CACHE_TTL) {
        return cachedDeviceInfo;
    }

    const userAgent = navigator.userAgent;
    const device = detectDevice(userAgent, navigator.platform, navigator.maxTouchPoints);

    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const connectionType = conn ? (conn.effectiveType || conn.type || 'unknown') : 'unknown';

    const info = {
        deviceType: device.type,
        os: device.os,
        browser: getBrowserName(userAgent),
        screen: `${window.screen.width}x${window.screen.height}`,
        connection: connectionType,
        memory: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'N/A',
        cores: navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Cores` : 'N/A',
        battery: null
    };

    try {
        if (typeof navigator.getBattery === 'function') {
            const battery = await navigator.getBattery();
            info.battery = {
                level: Math.round(battery.level * 100),
                charging: battery.charging
            };
        }
    } catch (err) {
        // Battery API not supported or blocked
    }

    cachedDeviceInfo = info;
    deviceInfoFetchedAt = now;
    return info;
}

// Supplemental device metadata must never block a location or emergency alert.
export async function getDeviceInfoSafely(timeoutMs = 2000) {
    let timer;
    try {
        return await Promise.race([
            getDeviceInfo().catch(() => ({})),
            new Promise(resolve => { timer = setTimeout(() => resolve({}), timeoutMs); })
        ]);
    } finally {
        clearTimeout(timer);
    }
}

export function getBrowserName(userAgent = '') {
    if (/EdgA|EdgiOS|Edg\//i.test(userAgent)) return 'Edge';
    if (/SamsungBrowser/i.test(userAgent)) return 'Samsung Internet';
    if (/OPR\/|Opera|OPiOS/i.test(userAgent)) return 'Opera';
    if (/FxiOS|Firefox/i.test(userAgent)) return 'Firefox';
    if (/CriOS|Chrome|Chromium/i.test(userAgent)) return 'Chrome';
    if (/Safari/i.test(userAgent)) return 'Safari';
    return 'Unknown';
}

export function getDeviceIcon(deviceName) {
    const name = typeof deviceName === 'string' ? deviceName : '';
    if (/android/i.test(name)) return 'Android Device';
    if (/ios|ipad|iphone|ipod/i.test(name)) return 'iOS Device';
    if (/chromeos|chromebook|cros/i.test(name)) return 'Chromebook';
    if (/windows/i.test(name)) return 'Windows PC';
    if (/linux/i.test(name)) return 'Linux PC';
    if (/mac/i.test(name)) return 'Mac';
    return 'Unknown Device';
}

// Keep the drawer's device symbols consistent with the map pins.
export function getDeviceSymbol(iconKey) {
    const symbols = {
        'Android Device': 'fa-mobile-alt', 'iOS Device': 'fa-mobile-alt',
        'Windows PC': 'fa-desktop', 'Mac': 'fa-laptop', 'Linux PC': 'fa-desktop',
        'Chromebook': 'fa-laptop', 'Unknown Device': 'fa-map-marker-alt'
    };
    return symbols[iconKey] || symbols['Unknown Device'];
}
