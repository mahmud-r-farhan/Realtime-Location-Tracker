// ─── Leaflet default-marker icon fix ─────────────────────────────────────────
// When Leaflet is self-hosted, it cannot auto-detect the image path.
// Without this, marker-icon.png is requested from a CDN/broken URL and the
// location cursor never appears on the map.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl:       '/vendor/leaflet/images/marker-icon.png',
    iconRetinaUrl: '/vendor/leaflet/images/marker-icon-2x.png',
    shadowUrl:     '/vendor/leaflet/images/marker-shadow.png'
});

// ─── Custom device icons ───────────────────────────────────────────────────────
// All iconUrl values use absolute paths (/assets/…) so they resolve correctly
// regardless of which page URL the module is loaded from.
export const LEAFLET_ICONS = {
    "Android Device": L.icon({ iconUrl: '/assets/android-log.png',  iconSize: [25, 35], iconAnchor: [12, 17], popupAnchor: [1, -17] }),
    "iOS Device":     L.icon({ iconUrl: '/assets/ios-log.png',      iconSize: [32, 41], iconAnchor: [16, 41], popupAnchor: [1, -34] }),
    "Windows PC":     L.icon({ iconUrl: '/assets/windows-log.gif',  iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [1, -28] }),
    "Mac":            L.icon({ iconUrl: '/assets/mac-log.png',      iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34] }),
    "Linux PC":       L.icon({ iconUrl: '/assets/linux-log.png',    iconSize: [25, 25], iconAnchor: [12, 25], popupAnchor: [1, -20] }),
    "Unknown Device": L.icon({ iconUrl: '/assets/unknown-log.png',  iconSize: [25, 25], iconAnchor: [12, 25], popupAnchor: [1, -20] })
};

export const WEBRTC_CONFIGURATION = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.stunprotocol.org:3478' }
    ],
    iceCandidatePoolSize: 10
};

export const INITIAL_MAP_VIEW = [20, 0];
export const INITIAL_MAP_ZOOM = 3;
export const LOCATION_SEND_INTERVAL = 2000;   // ms
export const LOCATION_IDLE_INTERVAL = 30000;  // 30s when stationary
export const MAX_NOTIFICATIONS = 50;
export const NOTIFICATION_ACTIVE_TIMEOUT = 5000; // ms