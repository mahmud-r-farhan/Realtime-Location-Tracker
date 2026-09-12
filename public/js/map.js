import { LEAFLET_ICONS, INITIAL_MAP_VIEW, INITIAL_MAP_ZOOM } from './config.js';
import { getDeviceIcon } from './device.js';
import { escapeHtml, isValidLatLng } from './utils.js';

export let map;
export const markers = {};
let followMe = false;
let selfId = null;

export function initMap(mapId = 'map') {
    map = L.map(mapId, {
        zoomControl: true,
        attributionControl: true
    }).setView(INITIAL_MAP_VIEW, INITIAL_MAP_ZOOM);

    // Default layer: Esri Satellite (no API key required, reliable, professional look)
    baseLayers['Satellite'].addTo(map);

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

// Sync to match the layer added in initMap()
let currentLayer = satellite;

export function switchLayer(name) {
    const newLayer = baseLayers[name];
    if (newLayer && map && newLayer !== currentLayer) {
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
    const { id, latitude, longitude, deviceName, deviceInfo } = data;

    if (!id || !isValidLatLng(latitude, longitude) || !map) return;

    // Use deviceType from info if available, otherwise fallback to name detection (legacy)
    const typeForIcon = deviceInfo?.deviceType || deviceName;
    const iconKey = getDeviceIcon(typeForIcon);
    const isSelf = id === selfId;

    if (markers[id]) {
        markers[id].setLatLng([latitude, longitude]);
    } else {
        // Guard against unknown icon keys (e.g. legacy peers)
        const icon = LEAFLET_ICONS[iconKey] || LEAFLET_ICONS['Unknown Device'];
        markers[id] = L.marker([latitude, longitude], {
            icon: icon,
            zIndexOffset: isSelf ? 1000 : 0
        }).addTo(map);
    }

    // Reuse the existing popup instead of re-binding on every update
    const popup = markers[id].getPopup();
    const content = createPopupContent(data, isSelf);
    if (popup) {
        popup.setContent(content);
    } else {
        markers[id].bindPopup(content);
    }

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
    if (map && isValidLatLng(latitude, longitude)) {
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

function createPopupContent(data, isSelf = false) {
    const { deviceName, latitude, longitude, accuracy, deviceInfo } = data;
    const typeForIcon = deviceInfo?.deviceType || deviceName;
    const iconKey = getDeviceIcon(typeForIcon);

    // All remote data must be escaped - these values originate from other
    // clients and are interpolated into HTML.
    const safeName = escapeHtml(deviceName || 'Unknown');
    const safeType = escapeHtml(deviceInfo?.deviceType || 'Unknown Device');
    const safeOs = escapeHtml(deviceInfo?.os || 'N/A');
    const safeBrowser = escapeHtml(deviceInfo?.browser || 'N/A');
    const safeConnection = escapeHtml(deviceInfo?.connection || 'Unknown');
    const safeScreen = escapeHtml(deviceInfo?.screen || 'N/A');
    const safeMemory = escapeHtml(deviceInfo?.memory || '');
    const safeCores = deviceInfo?.cores && deviceInfo.cores !== 'N/A'
        ? escapeHtml(`(${deviceInfo.cores})`)
        : '';
    const safeIp = escapeHtml(data.ip || (data.ipInfo && data.ipInfo.ip) || 'Unknown');

    let batteryHtml = 'N/A';
    if (deviceInfo?.battery && Number.isFinite(deviceInfo.battery.level)) {
        const lowBatteryClass = deviceInfo.battery.level < 20 ? 'low-battery' : '';
        const chargingIcon = deviceInfo.battery.charging ? '<i class="fas fa-bolt"></i>' : '';
        batteryHtml = `<span class="${lowBatteryClass}">${Number(deviceInfo.battery.level)}%</span> ${chargingIcon}`;
    }

    return `
        <div class="device-popup">
            <div class="device-popup-header">
                <img class="device-popup-icon" style="width: 60px; height: 60px;" src="../assets/${iconKey.toLowerCase().replace(' ', '-')}-log.png" alt="Device">
                <div class="device-header-text">
                    <span class="device-popup-name">${safeName}${isSelf ? ' (You)' : ''}</span>
                    <small class="device-popup-type">${safeType}</small>
                </div>
            </div>
            <div class="device-info-grid">
                <div class="device-info-item">
                    <div class="device-info-label">Battery</div>
                    <div class="device-info-value">${batteryHtml}</div>
                </div>
                <div class="device-info-item">
                    <div class="device-info-label">System</div>
                    <div class="device-info-value">${safeOs} • ${safeBrowser}</div>
                </div>
                <div class="device-info-item">
                    <div class="device-info-label">Network</div>
                    <div class="device-info-value">${safeConnection}</div>
                </div>
                <div class="device-info-item">
                    <div class="device-info-label">Display</div>
                    <div class="device-info-value">${safeScreen}</div>
                </div>
                 <div class="device-info-item">
                    <div class="device-info-label">Hardware</div>
                    <div class="device-info-value">${safeMemory} ${safeCores}</div>
                </div>
                <div class="device-info-item">
                    <div class="device-info-label">IP Address</div>
                    <div class="device-info-value">${safeIp}</div>
                </div>
            </div>
            <div class="device-coordinates">
                <i class="fas fa-map-marker-alt"></i> ${latitude.toFixed(6)}, ${longitude.toFixed(6)}
            </div>
        </div>
    `;
}

export function showDeviceInfo(device) {
    if (!device || !isValidLatLng(device.latitude, device.longitude)) return;

    L.popup()
        .setLatLng([device.latitude, device.longitude])
        .setContent(createPopupContent(device))
        .openOn(map);
}
