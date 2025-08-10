export const LEAFLET_ICONS = {
    "Android Device": L.icon({ iconUrl: '../assets/android-log.png', iconSize: [25, 35], iconAnchor: [12, 41] }),
    "iOS Device": L.icon({ iconUrl: '../assets/ios-log.png', iconSize: [32, 41], iconAnchor: [12, 32] }),
    "Windows PC": L.icon({ iconUrl: '../assets/windows-log.gif', iconSize: [25, 25], iconAnchor: [12, 25] }),
    "Mac": L.icon({ iconUrl: '../assets/mac-log.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
    "Unknown Device": L.icon({ iconUrl: '../assets/unknown-log.svg', iconSize: [25, 25], iconAnchor: [12, 25] })
};

export const WEBRTC_CONFIGURATION = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
            urls: 'turn:numb.viagenie.ca',
            username: 'webrtc@live.com',
            credential: 'muazkh'
        }
    ]
};

export const INITIAL_MAP_VIEW = [0, 0];
export const INITIAL_MAP_ZOOM = 3;
export const LOCATION_SEND_INTERVAL = 2000; // ms
export const MAX_NOTIFICATIONS = 50;
export const NOTIFICATION_ACTIVE_TIMEOUT = 5000; // ms