export function getDeviceName() {
    const userAgent = navigator.userAgent;

    if (/android/i.test(userAgent)) return 'Android Device';
    // iPadOS 13+ masquerades as macOS; requestDesktopSite variants still
    // report multi-touch, which desktop Macs never do.
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) ||
        (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1);
    if (isIOS) return 'iOS Device';

    const platform = navigator.platform ? navigator.platform.toLowerCase() : '';
    if (/win/i.test(platform)) return 'Windows PC';
    if (/mac/i.test(platform)) return 'Mac';
    if (/linux/i.test(platform) && !/android/i.test(userAgent)) return 'Linux PC';

    // Fallback to User Agent if platform is not specific enough
    if (/Windows NT/i.test(userAgent)) return 'Windows PC';
    if (/Macintosh/i.test(userAgent)) return 'Mac';
    if (/Linux/i.test(userAgent)) return 'Linux PC';

    return 'Unknown Device';
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
    let deviceType = 'Desktop';

    if (/android/i.test(userAgent)) deviceType = 'Android';
    else if (/iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1)) deviceType = 'iOS';
    else if (/Windows NT/i.test(userAgent)) deviceType = 'Windows';
    else if (/Macintosh/i.test(userAgent)) deviceType = 'Mac';
    else if (/Linux/i.test(userAgent)) deviceType = 'Linux';

    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const connectionType = conn ? (conn.effectiveType || conn.type || 'unknown') : 'unknown';

    const info = {
        deviceType: deviceType,
        os: navigator.platform || 'Unknown',
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

function getBrowserName(userAgent) {
    if (userAgent.includes("Firefox")) return "Firefox";
    if (userAgent.includes("SamsungBrowser")) return "Samsung Internet";
    if (userAgent.includes("Opera") || userAgent.includes("OPR")) return "Opera";
    if (userAgent.includes("Edg")) return "Edge";
    if (userAgent.includes("Chrome")) return "Chrome";
    if (userAgent.includes("Safari")) return "Safari";
    return "Unknown";
}

export function getDeviceIcon(deviceName) {
    const name = typeof deviceName === 'string' ? deviceName : '';
    if (name.includes('Android')) return 'Android Device';
    if (name.includes('iOS')) return 'iOS Device';
    if (name.includes('Windows')) return 'Windows PC';
    if (name.includes('Linux')) return 'Linux PC';
    if (name.includes('Mac')) return 'Mac';
    return 'Unknown Device';
}
