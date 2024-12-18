const socket = io();

let userName = localStorage.getItem('userName') || '';
const deviceName = getDeviceName();

function getDeviceName() {
    const userAgent = navigator.userAgent;
    if (/android/i.test(userAgent)) return 'Android Device';
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) return 'iOS Device';
    if (/Windows NT/i.test(userAgent)) return 'Windows PC';
    if (/Macintosh/i.test(userAgent)) return 'Mac';
    return 'Unknown Device';
}

const map = L.map('map').setView([0, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://gravatar.com/floawd">Mahmud R. Farhan</a>'
}).addTo(map);

const markers = {};

const icons = {
    "Android Device": L.icon({ iconUrl: '../assets/android-log.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
    "iOS Device": L.icon({ iconUrl: '../assets/ios-log.png', iconSize: [32, 41], iconAnchor: [12, 32] }),
    "Windows PC": L.icon({ iconUrl: '../assets/windows-log.png', iconSize: [25, 25], iconAnchor: [12, 25] }),
    "Mac": L.icon({ iconUrl: '../assets/mac-log.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
    "Unknown Device": L.icon({ iconUrl: '../assets/unknown-log.png', iconSize: [25, 25], iconAnchor: [12, 25] })
};

function sendLocation() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                const displayName = userName || deviceName;
                socket.emit('send-location', { latitude, longitude, deviceName: displayName, accuracy });
            },
            (error) => {
                console.error('Error getting location:', error);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    }
}

function showNamePopup() {
    document.getElementById('name-popup').classList.remove('hidden');
}

function hideNamePopup() {
    document.getElementById('name-popup').classList.add('hidden');
}

document.getElementById('continue-btn').addEventListener('click', () => {
    const inputName = document.getElementById('user-name-input').value.trim();
    if (inputName) {
        userName = inputName;
        localStorage.setItem('userName', userName);
    }
    hideNamePopup();
    initializeApp();
});

document.getElementById('cancel-btn').addEventListener('click', () => {
    hideNamePopup();
    initializeApp();
});

function initializeApp() {
    sendLocation();
    setInterval(sendLocation, 2000);
}

if (!userName) {
    showNamePopup();
} else {
    initializeApp();
}

socket.on('receive-location', (data) => {
    updateMarker(data);
});

socket.on('focus-device-location', (data) => {
    updateMarker(data);
    map.setView([data.latitude, data.longitude], 15);
});

function updateMarker(data) {
    const { id, latitude, longitude, deviceName, accuracy } = data;
    
    if (markers[id]) {
        markers[id].setLatLng([latitude, longitude]);
    } else {
        markers[id] = L.marker([latitude, longitude], { icon: icons[getDeviceIcon(deviceName)] }).addTo(map);
    }

    markers[id].bindPopup(createPopupContent(data));
}

function getDeviceIcon(deviceName) {
    if (deviceName.includes('Android')) return 'Android Device';
    if (deviceName.includes('iOS')) return 'iOS Device';
    if (deviceName.includes('Windows')) return 'Windows PC';
    if (deviceName.includes('Mac')) return 'Mac';
    return 'Unknown Device';
}

function createPopupContent(data) {
    const { deviceName, latitude, longitude, accuracy } = data;
    return `
        <b>${deviceName}</b><br>
        Latitude: ${latitude.toFixed(6)}<br>
        Longitude: ${longitude.toFixed(6)}<br>
        Accuracy: ${accuracy.toFixed(2)} meters
    `;
}

socket.on('user-disconnect', (id) => {
    if (markers[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
    }
});

socket.on('update-device-list', (devices) => {
    const deviceList = document.getElementById('device-list');
    deviceList.innerHTML = '';
    devices.forEach(([id, device]) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="device-icon ${getDeviceIcon(device.deviceName).toLowerCase().replace(' ', '-')}"></span>
            <span class="device-name">${device.deviceName}</span>
            <span class="device-info"><i class="fas fa-info-circle"></i></span>
        `;
        li.addEventListener('click', () => {
            socket.emit('request-device-location', id);
        });
        
        const infoIcon = li.querySelector('.device-info');
        infoIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            showDeviceInfo(device);
        });
        
        deviceList.appendChild(li);
    });
});

function showDeviceInfo(device) {
    const infoContent = createPopupContent(device);
    const infoPopup = L.popup()
        .setLatLng([device.latitude, device.longitude])
        .setContent(infoContent)
        .openOn(map);
}

// Sidebar toggle functionality
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');

sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    sidebarToggle.querySelector('i').classList.toggle('fa-chevron-left');
    sidebarToggle.querySelector('i').classList.toggle('fa-chevron-right');
});

// Implement offline support
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
            console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch((error) => {
            console.error('Service Worker registration failed:', error);
        });
}