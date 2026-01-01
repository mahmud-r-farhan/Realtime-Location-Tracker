import { LEAFLET_ICONS, INITIAL_MAP_VIEW, INITIAL_MAP_ZOOM } from './config.js';
import { getDeviceIcon } from './device.js';

export let map;
export const markers = {};

export function initMap(mapId = 'map') {
    map = L.map(mapId).setView(INITIAL_MAP_VIEW, INITIAL_MAP_ZOOM);

    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap'
    });

    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    });

    const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    });

    const baseMaps = {
        "OpenStreetMap": osm,
        "OpenTopoMap": topo,
        "Satellite": satellite,
        "Dark Mode": dark
    };

    L.control.layers(baseMaps).addTo(map);

    return map;
}

export function updateMarker(data) {
    const { id, latitude, longitude, deviceName, accuracy } = data;
    const iconKey = getDeviceIcon(deviceName);
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
    const iconKey = getDeviceIcon(deviceName);
    return `
        <div class="device-popup">
            <div class="device-popup-header">
                <img class="device-popup-icon" style="width: 70px; height: 70px;"  src="../assets/${iconKey.toLowerCase().replace(' ', '-')}-log.png" alt="Device">
                <span class="device-popup-name"  style="font-size: 18px;">${deviceName}</span>
            </div>
            <div class="device-info-grid">
                <div class="device-info-item">
                    <div class="device-info-label">Battery</div>
                    <div class="device-info-value">${deviceInfo?.battery ? `${deviceInfo.battery.level}% ${deviceInfo.battery.charging ? '<i class="fas fa-bolt"></i>' : ''}` : 'N/A'}</div>
                </div>
                <div class="device-info-item">
                    <div class="device-info-label">Connection</div>
                    <div class="device-info-value">${deviceInfo?.connection || 'Unknown'}</div>
                </div>
                <div class="device-info-item">
                    <div class="device-info-label">Location Accuracy</div>
                    <div class="device-info-value">${accuracy != null ? accuracy.toFixed(2) + 'm' : 'N/A'}</div>
                </div>
                <div class="device-info-item">
                    <div class="device-info-label">Platform</div>
                    <div class="device-info-value">${deviceInfo?.platform || 'Unknown'}</div>
                </div>
            </div>
            <div class="device-coordinates">
                <small>Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}</small>
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