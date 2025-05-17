export function getDeviceName() {
    const userAgent = navigator.userAgent;
    if (/android/i.test(userAgent)) return 'Android Device';
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) return 'iOS Device';
    if (/Windows NT/i.test(userAgent)) return 'Windows PC';
    if (/Macintosh/i.test(userAgent)) return 'Mac';
    return 'Unknown Device';
}

export async function getDeviceInfo() {
    const info = {
        battery: null,
        connection: navigator.connection?.type || 'unknown',
        language: navigator.language,
        platform: navigator.platform,
        orientation: screen.orientation?.type || 'unknown'
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
        console.log('Battery status not available');
    }
    return info;
}

export function getDeviceIcon(deviceName) {
    if (deviceName.includes('Android')) return 'Android Device';
    if (deviceName.includes('iOS')) return 'iOS Device';
    if (deviceName.includes('Windows')) return 'Windows PC';
    if (deviceName.includes('Mac')) return 'Mac';
    return 'Unknown Device';
}