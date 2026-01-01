export function getDeviceName() {
    const userAgent = navigator.userAgent;
    if (/android/i.test(userAgent)) return 'Android Device';
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) return 'iOS Device';
    if (/Windows NT/i.test(userAgent)) return 'Windows PC';
    if (/Macintosh/i.test(userAgent)) return 'Mac';
    if (/Linux/i.test(userAgent)) return 'Linux PC';
    return 'Unknown Device';
}

export async function getDeviceInfo() {
    const userAgent = navigator.userAgent;
    let deviceType = 'Desktop';

    if (/android/i.test(userAgent)) deviceType = 'Android';
    else if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) deviceType = 'iOS';
    else if (/Windows NT/i.test(userAgent)) deviceType = 'Windows';
    else if (/Macintosh/i.test(userAgent)) deviceType = 'Mac';
    else if (/Linux/i.test(userAgent)) deviceType = 'Linux';

    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const connectionType = conn ? (conn.effectiveType || conn.type || 'unknown') : 'unknown';

    const info = {
        deviceType: deviceType,
        os: navigator.platform,
        browser: getBrowserName(userAgent),
        screen: `${window.screen.width}x${window.screen.height}`,
        connection: connectionType,
        memory: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'N/A',
        cores: navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Cores` : 'N/A',
        battery: null
    };

    try {
        if (navigator.getBattery) {
            const battery = await navigator.getBattery();
            info.battery = {
                level: Math.round(battery.level * 100),
                charging: battery.charging
            };
        }
    } catch (err) {
        // Battery API not supported or blocked
    }
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
    if (deviceName.includes('Android')) return 'Android Device';
    if (deviceName.includes('iOS')) return 'iOS Device';
    if (deviceName.includes('Windows')) return 'Windows PC';
    if (deviceName.includes('Linux')) return 'Windows PC'; // Map Linux to Computer icon
    if (deviceName.includes('Mac')) return 'Mac';
    return 'Unknown Device';
}