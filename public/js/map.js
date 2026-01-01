import { LEAFLET_ICONS, INITIAL_MAP_VIEW, INITIAL_MAP_ZOOM } from './config.js';
import { getDeviceIcon } from './device.js';

export let map;
export const markers = {};

export function initMap(mapId = 'map') {
    map = L.map(mapId).setView(INITIAL_MAP_VIEW, INITIAL_MAP_ZOOM);

    // Initialize with default layer
    baseLayers['OpenStreetMap'].addTo(map);

    return map;
}

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

export function updateMarker(data) {
    const { id, latitude, longitude, deviceName, accuracy, deviceInfo } = data;
    // Use deviceType from info if available, otherwise fallback to name detection (legacy)
    const typeForIcon = deviceInfo?.deviceType || deviceName;
    const iconKey = getDeviceIcon(typeForIcon);

    if (markers[id]) {
        markers[id].setLatLng([latitude, longitude]);
    } else {
        markers[id] = L.marker([latitude, longitude], { icon: LEAFLET_ICONS[iconKey] }).addTo(map);
    }
    markers[id].bindPopup(createPopupContent(data));
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

function createPopupContent(data) {
    const { deviceName, latitude, longitude, accuracy, deviceInfo } = data;
    const typeForIcon = deviceInfo?.deviceType || deviceName;
    const iconKey = getDeviceIcon(typeForIcon);

    return `
        <div class="device-popup">
            <div class="device-popup-header">
                <img class="device-popup-icon" style="width: 60px; height: 60px;" src="../assets/${iconKey.toLowerCase().replace(' ', '-')}-log.png" alt="Device">
                <div class="device-header-text">
                    <span class="device-popup-name">${deviceName}</span>
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