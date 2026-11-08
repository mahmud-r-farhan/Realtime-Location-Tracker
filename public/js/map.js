import { INITIAL_MAP_VIEW, INITIAL_MAP_ZOOM } from './config.js';
import { getDeviceIcon, getDeviceSymbol } from './device.js';
import { escapeHtml, isValidLatLng, formatFixAge } from './utils.js';

export let map;
export const markers = {};
let followMe = false;
let selfId = null;
let viewChosen = false;
let tileHealthBound = false;

export function initMap(mapId = 'map') {
    map = L.map(mapId, {
        zoomControl: true,
        attributionControl: true
    }).setView(INITIAL_MAP_VIEW, INITIAL_MAP_ZOOM);

    // Do not move the map under a user who has already chosen a view.
    const container = map.getContainer();
    ['pointerdown', 'wheel', 'keydown'].forEach(event => {
        container.addEventListener(event, () => { viewChosen = true; }, { passive: true });
    });
    if (!tileHealthBound) {
        Object.values(baseLayers).forEach(observeTileHealth);
        tileHealthBound = true;
    }
    document.getElementById('retry-map-tiles')?.addEventListener('click', retryMapTiles);
    baseLayers['Satellite'].addTo(map);

    return map;
}

// Map Layer Definitions
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});

const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
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
    attribution: '<a href="https://www.cyclosm.org">CyclOSM</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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

function setTileWarning(show) {
    document.getElementById('map-tile-warning')?.classList.toggle('hidden', !show);
}

// A tile provider can fail even when the Socket.IO server is reachable.
// Warn only if an entire completed batch failed; partial/mixed success stays usable.
function observeTileHealth(layer) {
    let successes = 0;
    let failures = 0;
    layer.on('loading', () => { successes = 0; failures = 0; });
    layer.on('tileload', () => { successes++; });
    layer.on('tileerror', () => { failures++; });
    layer.on('load', () => {
        if (layer !== currentLayer) return;
        if (successes > 0) setTileWarning(false);
        else if (failures > 0) setTileWarning(true);
    });
}

export function retryMapTiles() {
    if (!map || !currentLayer) return;
    setTileWarning(false);
    currentLayer.redraw();
}

export function getCurrentLayerName() {
    return Object.keys(baseLayers).find(name => baseLayers[name] === currentLayer);
}

export function switchLayer(name) {
    const newLayer = baseLayers[name];
    if (newLayer && map && newLayer !== currentLayer) {
        map.removeLayer(currentLayer);
        currentLayer = newLayer;
        setTileWarning(false);
        newLayer.addTo(map);
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

const popupImages = {
    'Android Device': 'android-device-log.png', 'iOS Device': 'ios-device-log.png',
    'Windows PC': 'windows-pc-log.png', 'Mac': 'mac-log.png',
    'Linux PC': 'linux-pc-log.png', 'Chromebook': 'unknown-device-log.png',
    'Unknown Device': 'unknown-device-log.png'
};
function makeDeviceMarkerIcon(iconKey, isSelf) {
    const symbol = getDeviceSymbol(iconKey);
    return L.divIcon({
        className: 'tracker-marker-shell',
        html: `<span class="tracker-marker ${isSelf ? 'tracker-marker-self' : ''}"><i class="fas ${symbol}" aria-hidden="true"></i></span>`,
        iconSize: [42, 50], iconAnchor: [21, 48], popupAnchor: [0, -46], tooltipAnchor: [0, -44]
    });
}

export function updateMarker(data) {
    const { id, latitude, longitude, deviceName, deviceInfo } = data;

    if (!id || !isValidLatLng(latitude, longitude) || !map) return;

    // Use deviceType from info if available, otherwise fallback to name detection (legacy)
    const typeForIcon = deviceInfo?.deviceType || deviceName;
    const iconKey = getDeviceIcon(typeForIcon);
    const isSelf = id === selfId;

    if (!markers[id]) {
        markers[id] = L.marker([latitude, longitude], {
            icon: makeDeviceMarkerIcon(iconKey, isSelf),
            zIndexOffset: isSelf ? 1000 : 0
        }).addTo(map);
    }

    const marker = markers[id];
    marker._trackerFix = { capturedAt: data.capturedAt, accuracy: data.accuracy };
    const markerStyle = `${iconKey}:${isSelf}`;
    if (marker._trackerStyle !== markerStyle) {
        // Metadata may arrive later than the first location fix.
        marker.setIcon(makeDeviceMarkerIcon(iconKey, isSelf));
        marker._trackerStyle = markerStyle;
    }
    const label = `${deviceName || 'Unknown device'}${isSelf ? ' (You)' : ''}`;
    const element = marker.getElement();
    if (element) {
        element.setAttribute('aria-label', `Location of ${label}`);
        element.setAttribute('title', label);
    }
    if (marker.getTooltip()) marker.setTooltipContent(escapeHtml(label));
    else marker.bindTooltip(escapeHtml(label), { direction: 'top' });
    const popup = marker.getPopup();
    const content = createPopupContent(data, isSelf);
    if (popup) {
        // Leaflet auto-pans an open popup whenever its marker or content changes.
        // Suppress that only during live updates so tracking does not drag the
        // map away from a location the user is inspecting.
        const autoPan = popup.options.autoPan;
        popup.options.autoPan = false;
        try {
            marker.setLatLng([latitude, longitude]);
            popup.setContent(content);
        } finally {
            popup.options.autoPan = autoPan;
        }
    } else {
        marker.setLatLng([latitude, longitude]);
        marker.bindPopup(content);
    }

    if (isSelf && !viewChosen) {
        // The initial fix is useful context, but never repeatedly pull the map
        // back from a place the user has deliberately selected.
        viewChosen = true;
        map.setView([latitude, longitude], 14);
    } else if (isSelf && followMe) {
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
        viewChosen = true;
        map.setView([latitude, longitude], zoom);
    }
}

export function fitVisibleDevices() {
    if (!map) return false;
    const points = Object.values(markers).map(marker => marker.getLatLng());
    if (!points.length) return false;
    viewChosen = true;
    if (points.length === 1) {
        map.setView(points[0], 15);
    } else {
        // Shift longitudes toward the first point so markers either side of
        // the antimeridian don't force an unnecessary world-scale zoom.
        const reference = points[0].lng;
        const wrapped = points.map(point => [point.lat, reference + ((((point.lng - reference) % 360) + 540) % 360) - 180]);
        map.fitBounds(L.latLngBounds(wrapped), { padding: [50, 50], maxZoom: 15 });
    }
    return true;
}

export function openDevicePopup(peerId) {
    if (markers[peerId]) {
        viewChosen = true;
        const currentZoom = map.getZoom();
        map.setView(markers[peerId].getLatLng(), currentZoom < 15 ? 15 : currentZoom);
        markers[peerId].openPopup();
    }
}

let sosMapMarker = null;
export function showSOSLocation(alert) {
    const latitude = alert?.location?.latitude;
    const longitude = alert?.location?.longitude;
    if (!map || !isValidLatLng(latitude, longitude)) return false;
    if (sosMapMarker) map.removeLayer(sosMapMarker);
    focusMapOnDevice(latitude, longitude, 15);
    const marker = L.marker([latitude, longitude], {
        icon: L.divIcon({ className: 'tracker-marker-shell', html: '<span class="tracker-marker tracker-marker-sos"><i class="fas fa-exclamation" aria-hidden="true"></i></span>', iconSize: [42, 50], iconAnchor: [21, 48], popupAnchor: [0, -46] }),
        zIndexOffset: 2000,
        title: 'SOS location'
    }).addTo(map);
    sosMapMarker = marker;
    marker.bindPopup(`<div class="sos-map-popup"><strong>SOS location</strong><p>${escapeHtml(alert.sender || 'Unknown')} · ${escapeHtml(alert.room || 'Unknown room')}</p><p>${latitude.toFixed(6)}, ${longitude.toFixed(6)}</p><small>Location may be old or approximate. Close to remove this pin.</small></div>`).openPopup();
    marker.on('popupclose', () => {
        if (sosMapMarker === marker) sosMapMarker = null;
        if (map.hasLayer(marker)) map.removeLayer(marker);
    });
    return true;
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
                <img class="device-popup-icon" style="width: 60px; height: 60px;" src="/assets/${popupImages[iconKey] || popupImages['Unknown Device']}" alt="Device">
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
            <div class="device-fix-summary">Fix: ${escapeHtml(formatFixAge(data.capturedAt))}${Number.isFinite(accuracy) ? ` · estimated ±${Math.round(accuracy)} m` : ''}</div>
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
