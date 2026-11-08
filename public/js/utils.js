/**
 * Shared client-side utilities
 */

const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
};

/**
 * Escapes a value for safe interpolation into HTML (innerHTML/template strings).
 * ALWAYS use this when inserting untrusted or remote data into markup.
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"'/]/g, (ch) => HTML_ESCAPES[ch]);
}

/**
 * Great-circle distance between two points in meters (haversine formula).
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Validates that a value is a usable latitude/longitude pair.
 */
export function isValidLatLng(latitude, longitude) {
    return Number.isFinite(latitude) && Number.isFinite(longitude) &&
        latitude >= -90 && latitude <= 90 &&
        longitude >= -180 && longitude <= 180;
}

// Device-provided fix times are estimates and can be wrong if its clock is off.
export function formatFixAge(timestamp, now = Date.now()) {
    const time = Date.parse(timestamp);
    if (!Number.isFinite(time) || time > now + 120_000) return 'time unavailable';
    const seconds = Math.max(0, Math.floor((now - time) / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    return `${Math.floor(hours / 24)} d ago`;
}
