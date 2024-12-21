const socket = io();

let userName = localStorage.getItem('userName') || '';
const deviceName = getDeviceName();
let map, markers = {};

const icons = {
    "Android Device": L.icon({ iconUrl: '../assets/android-log.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
    "iOS Device": L.icon({ iconUrl: '../assets/ios-log.png', iconSize: [32, 41], iconAnchor: [12, 32] }),
    "Windows PC": L.icon({ iconUrl: '../assets/windows-log.png', iconSize: [25, 25], iconAnchor: [12, 25] }),
    "Mac": L.icon({ iconUrl: '../assets/mac-log.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
    "Unknown Device": L.icon({ iconUrl: '../assets/unknown-log.png', iconSize: [25, 25], iconAnchor: [12, 25] })
};

function initMap() {
    map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://gravatar.com/floawd">Mahmud R. Farhan</a>'
    }).addTo(map);
}

function getDeviceName() {
    const userAgent = navigator.userAgent;
    if (/android/i.test(userAgent)) return 'Android Device';
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) return 'iOS Device';
    if (/Windows NT/i.test(userAgent)) return 'Windows PC';
    if (/Macintosh/i.test(userAgent)) return 'Mac';
    return 'Unknown Device';
}

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

function initializeApp() {
    initMap();
    sendLocation();
    setInterval(sendLocation, 2000);
}

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

function showDeviceInfo(device) {
    const infoContent = createPopupContent(device);
    L.popup()
        .setLatLng([device.latitude, device.longitude])
        .setContent(infoContent)
        .openOn(map);
}

function updateDeviceList(devices) {
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
}

// Event Listeners
document.getElementById('continue-btn').addEventListener('click', () => {
    const inputName = document.getElementById('user-name-input').value.trim();
    if (inputName) {
        userName = inputName;
        localStorage.setItem('userName', userName);
    }
    hideNamePopup();
    initializeApp();
});

document.getElementById('sidebar-toggle').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    const icon = sidebar.querySelector('i');
    icon.classList.toggle('fa-chevron-left');
    icon.classList.toggle('fa-chevron-right');
});

// Socket events
socket.on('receive-location', updateMarker);
socket.on('focus-device-location', (data) => {
    updateMarker(data);
    map.setView([data.latitude, data.longitude], 15);
});
socket.on('user-disconnect', (id) => {
    if (markers[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
    }
});
socket.on('update-device-list', updateDeviceList);
socket.on('update-user-count', (count) => {
    document.getElementById('user-count').textContent = count;
});

// Initialize
if (!userName) {
    showNamePopup();
} else {
    initializeApp();
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => console.log('Service Worker registered:', registration.scope))
        .catch((error) => console.error('Service Worker registration failed:', error));
}

// Audio controls
let localStream;
let audioEnabled = false;
let speakerEnabled = true;
const peerConnections = {};

const createPeerConnection = (peerId) => {
    const pc = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    });

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                target: peerId,
                candidate: event.candidate
            });
        }
    };

    pc.ontrack = (event) => {
        if (speakerEnabled) {
            const audio = new Audio();
            audio.srcObject = event.streams[0];
            audio.play();
        }
    };

    return pc;
};

document.getElementById('mic-btn').addEventListener('click', async () => {
    try {
        if (!audioEnabled) {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioEnabled = true;
            document.querySelector('#mic-btn img').src = '/assets/microphone-on-icon.png';
            
            // Add stream to all existing peer connections
            Object.values(peerConnections).forEach(pc => {
                localStream.getTracks().forEach(track => {
                    pc.addTrack(track, localStream);
                });
            });

            socket.emit('join-audio');
        } else {
            localStream.getTracks().forEach(track => track.stop());
            audioEnabled = false;
            document.querySelector('#mic-btn img').src = '/assets/microphone-muted-icon.png';
        }
    } catch (err) {
        console.error('Error accessing microphone:', err);
    }
});

document.getElementById('speaker-btn').addEventListener('click', () => {
    speakerEnabled = !speakerEnabled;
    document.querySelector('#speaker-btn img').src = speakerEnabled ? '/assets/speaker-on-icon.png' : '/assets/speaker-off-icon.png';
    socket.emit('toggle-speaker', { enabled: speakerEnabled });
});

socket.on('user-connected', async ({ peerId }) => {
    const pc = createPeerConnection(peerId);
    peerConnections[peerId] = pc;

    if (localStream && audioEnabled) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', {
        target: peerId,
        description: offer
    });
});

socket.on('offer', async ({ peerId, description }) => {
    const pc = createPeerConnection(peerId);
    peerConnections[peerId] = pc;

    await pc.setRemoteDescription(description);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('answer', {
        target: peerId,
        description: answer
    });
});

socket.on('answer', async ({ peerId, description }) => {
    if (peerConnections[peerId]) {
        await peerConnections[peerId].setRemoteDescription(description);
    }
});

socket.on('ice-candidate', async ({ peerId, candidate }) => {
    if (peerConnections[peerId]) {
        await peerConnections[peerId].addIceCandidate(candidate);
    }
});

socket.on('user-disconnected', (peerId) => {
    if (peerConnections[peerId]) {
        peerConnections[peerId].close();
        delete peerConnections[peerId];
    }
});

socket.on('user-audio', (data) => {
    if (data.stream && speakerEnabled) {
        const audio = new Audio();
        audio.srcObject = new MediaStream([data.stream]);
        audio.play();
    }
});