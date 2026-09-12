import { LEAFLET_ICONS, INITIAL_MAP_VIEW, INITIAL_MAP_ZOOM } from './config.js';
import { getDeviceIcon } from './device.js';

export let map;
export const markers = {};
let followMe = false;
let selfId = null;

// Map Layer Definitions
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
});

const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenTopoMap'
});

const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'
});

const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
});

const light = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
});

const voyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
});

const cyclosm = L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
    attribution: 'For cyclists'
});

const esriStreet = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'
});

export const baseLayers = {
    "OpenStreetMap": osm,
    "Satellite": satellite,
    "Dark Mode": dark,
    "Light Mode": light,
    "Voyager": voyager,
    "OpenTopoMap": topo,
    "CyclOSM": cyclosm,
    "Street Map": esriStreet
};

let currentLayer = osm;

export function initMap(mapId = 'map') {
    map = L.map(mapId).setView(INITIAL_MAP_VIEW, INITIAL_MAP_ZOOM);

    // Initialize with default layer
    baseLayers['OpenStreetMap'].addTo(map);

    return map;
}

export function switchLayer(name) {
    const newLayer = baseLayers[name];
    if (newLayer && map) {
        map.removeLayer(currentLayer);
        newLayer.addTo(map);
        currentLayer = newLayer;
        return true;
    }
    return false;
}

export function setSelfId(id) {
    selfId = id;
}

export function toggleFollowMe(enabled) {
    followMe = enabled;
    if (followMe && selfId && markers[selfId]) {
        const latLng = markers[selfId].getLatLng();
        focusMapOnDevice(latLng.lat, latLng.lng);
    }
}

export function updateMarker(data) {
    const { id, latitude, longitude, deviceName, accuracy, deviceInfo } = data;
    const typeForIcon = deviceInfo?.deviceType || deviceName;
    let iconKey = getDeviceIcon(typeForIcon);

    const isSelf = id === selfId;

    if (markers[id]) {
        markers[id].setLatLng([latitude, longitude]);
    } else {
        const icon = LEAFLET_ICONS[iconKey] || LEAFLET_ICONS["Unknown Device"];
        markers[id] = L.marker([latitude, longitude], {
            icon: icon,
            zIndexOffset: isSelf ? 1000 : 0
        }).addTo(map);
    }

    markers[id].bindPopup(createPopupContent(data, isSelf));

    if (isSelf && followMe) {
        focusMapOnDevice(latitude, longitude);
    }
}

export function removeMarker(peerId) {
    if (markers[peerId]) {
        map.removeLayer(markers[peerId]);
        delete markers[peerId];
    }
}

export function focusMapOnDevice(latitude, longitude, zoom = 15) {
    if (map) {
        map.setView([latitude, longitude], zoom);
    }
}

export function openDevicePopup(peerId) {
    if (markers[peerId]) {
        const currentZoom = map.getZoom();
        map.setView(markers[peerId].getLatLng(), currentZoom < 15 ? 15 : currentZoom);
        markers[peerId].openPopup();
    }
}

function getIconAssetUrl(iconKey) {
    switch (iconKey) {
        case 'Android Device': return '/assets/android-log.png';
        case 'iOS Device': return '/assets/ios-log.png';
        case 'Windows PC': return '/assets/windows-log.gif';
        case 'Mac': return '/assets/mac-log.png';
        case 'Linux PC': return '/assets/linux-log.png';
        default: return '/assets/unknown-log.png';
    }
}

function createPopupContent(data, isSelf = false) {
    const { deviceName, latitude, longitude, accuracy, deviceInfo } = data;
    const typeForIcon = deviceInfo?.deviceType || deviceName;
    const iconKey = getDeviceIcon(typeForIcon);
    const iconUrl = getIconAssetUrl(iconKey);

    return `
        <div class="device-popup">
            <div class="device-popup-header">
                <img class="device-popup-icon" style="width: 50px; height: 50px; object-fit: contain;" src="${iconUrl}" alt="Device">
                <div class="device-header-text">
                    <span class="device-popup-name">${deviceName}${isSelf ? ' (You)' : ''}</span>
                    <small class="device-popup-type">${deviceInfo?.deviceType || 'Unknown Device'}</small>
                </div>
            </div>
            <div class="device-info-grid">
                <div class="device-info-item">
                    <div class="device-info-label">Battery</div>
                    <div class="device-info-value">
                        ${deviceInfo?.battery ?
            `<span class="${deviceInfo.battery.level < 20 ? 'low-battery' : ''}">${deviceInfo.battery.level}%</span> ${deviceInfo.battery.charging ? '<i class="fas fa-bolt"></i>' : ''}`
            : 'N/A'}
                    </div>
                </div>
                <div class="device-info-item">
                    <div class="device-info-label">System</div>
                    <div class="device-info-value">${deviceInfo?.os || 'N/A'} • ${deviceInfo?.browser || 'N/A'}</div>
                </div>
                <div class="device-info-item">
                    <div class="device-info-label">Network</div>
                    <div class="device-info-value">${deviceInfo?.connection || 'Unknown'}</div>
                </div>
                <div class="device-info-item">
                    <div class="device-info-label">Display</div>
                    <div class="device-info-value">${deviceInfo?.screen || 'N/A'}</div>
                </div>
                <div class="device-info-item">
                    <div class="device-info-label">Hardware</div>
                    <div class="device-info-value">${deviceInfo?.memory !== 'N/A' ? deviceInfo.memory : ''} ${deviceInfo?.cores !== 'N/A' ? `(${deviceInfo?.cores})` : ''}</div>
                </div>
                <div class="device-info-item">
                    <div class="device-info-label">IP Address</div>
                    <div class="device-info-value">${data.ip || (data.ipInfo && data.ipInfo.ip) || 'Unknown'}</div>
                </div>
            </div>
            <div class="device-coordinates">
                <i class="fas fa-map-marker-alt"></i> ${latitude.toFixed(6)}, ${longitude.toFixed(6)}
            </div>
        </div>
    `;
}

export function showDeviceInfo(device) {
    L.popup()
        .setLatLng([device.latitude, device.longitude])
        .setContent(createPopupContent(device))
        .openOn(map);
}
