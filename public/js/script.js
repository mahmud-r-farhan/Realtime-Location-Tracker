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
    map = L.map('map').setView([0, 0], 3);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://gravatar.com/floawd">Mahmudur Rahman</a>'
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

async function getDeviceInfo() {
    const info = {
        battery: null,
        connection: navigator.connection?.type || 'unknown',
        language: navigator.language,
        platform: navigator.platform,
        orientation: screen.orientation.type
    };

    try {
        const battery = await navigator.getBattery();
        info.battery = {
            level: Math.round(battery.level * 100),
            charging: battery.charging
        };
    } catch (err) {
        console.log('Battery status not available');
    }

    return info;
}

async function sendLocation() {
    if ('geolocation' in navigator) {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                });
            });
            
            const deviceInfo = await getDeviceInfo();
            const { latitude, longitude, accuracy } = position.coords;
            const displayName = userName || deviceName;
            
            socket.emit('send-location', {
                latitude,
                longitude,
                deviceName: displayName,
                accuracy,
                deviceInfo
            });
        } catch (error) {
            console.error('Error getting location:', error);
        }
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
    const { deviceName, latitude, longitude, accuracy, deviceInfo } = data;
    return `
        <div class="device-popup">
            <div class="device-popup-header">
                <img class="device-popup-icon" src="../assets/${getDeviceIcon(deviceName).toLowerCase().replace(' ', '-')}-log.png" alt="Device">
                <span class="device-popup-name">${deviceName}</span>
            </div>
            <div class="device-info-grid">
                <div class="device-info-item">
                    <div class="device-info-label">Battery</div>
                    <div class="device-info-value">
                        ${deviceInfo?.battery ? 
                            `${deviceInfo.battery.level}% ${deviceInfo.battery.charging ? '' : ''}` : 
                            'N/A'}
                    </div>
                </div>
                <div class="device-info-item">
                    <div class="device-info-label">Connection</div>
                    <div class="device-info-value">${deviceInfo?.connection || 'Unknown'}</div>
                </div>
                <div class="device-info-item">
                    <div class="device-info-label">Location Accuracy</div>
                    <div class="device-info-value">${accuracy.toFixed(2)}m</div>
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
            // Update map view immediately with existing device data
            map.setView([device.latitude, device.longitude], 15);
            // Also request latest location update
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
socket.on('receive-location', (data) => {
    updateMarker(data);
    // Add notification for first location received from a device
    if (!markers[data.id]) {
        addNotification(`${data.deviceName} started sharing location`);
    }
});
socket.on('focus-device-location', (data) => {
    updateMarker(data);
    map.setView([data.latitude, data.longitude], 15);
});
socket.on('user-disconnect', (data) => {
    const displayName = data.userName || 'A user';
    addNotification(`${displayName} has disconnected`);
    if (markers[data.peerId]) {
        map.removeLayer(markers[data.peerId]);
        delete markers[data.peerId];
    }
});
socket.on('update-device-list', updateDeviceList);
socket.on('update-user-count', (count) => {
    document.getElementById('user-count').textContent = count;
});

socket.on('user-connected', async ({ peerId, userName }) => {
    const displayName = userName || 'A new user';
    addNotification(`${displayName} has connected`);
    const pc = createPeerConnection(peerId);
    peerConnections[peerId] = pc;

    if (localStream && audioEnabled) {
        try {
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('offer', {
                target: peerId,
                description: offer
            });
        } catch (err) {
            console.error('Error creating offer:', err);
        }
    }
});

socket.on('connect', () => {
    addNotification('Connected to server');
});

socket.on('disconnect', () => {
    addNotification('Disconnected from server');
});

socket.on('reconnect', (attemptNumber) => {
    addNotification(`Reconnected to server after ${attemptNumber} attempts`);
});

let activeNotifications = new Set();

function addNotification(message) {
    if (activeNotifications.has(message)) return;
    
    const list = document.getElementById('notification-list');
    const time = new Date().toLocaleTimeString();
    const li = document.createElement('li');
    li.innerHTML = `<span class="notification-time">[${time}]</span> ${message}`;
    list.insertBefore(li, list.firstChild);
    
    // Keep maximum 50 notifications
    if (list.children.length > 50) {
        list.removeChild(list.lastChild);
    }
    
    activeNotifications.add(message);
    
    // Remove from activeNotifications after 5 seconds
    setTimeout(() => {
        activeNotifications.delete(message);
    }, 5000);
}

document.getElementById('notification-toggle').addEventListener('click', function() {
    const panel = document.getElementById('notification-panel');
    const button = this;
    
    if (panel.classList.contains('minimized')) {
        panel.classList.remove('minimized');
        button.textContent = '-';
    } else {
        panel.classList.add('minimized');
        button.textContent = '+';
    }
});


if (!userName) {
    showNamePopup();
} else {
    initializeApp();
}

// Audio controls
let localStream;
let audioEnabled = false;
let speakerEnabled = true;
const peerConnections = {};

const createPeerConnection = (peerId) => {
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            {
                urls: 'turn:numb.viagenie.ca',
                username: 'webrtc@live.com',
                credential: 'muazkh'
            }
        ]
    };

    const pc = new RTCPeerConnection(configuration);

    pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
            pc.restartIce();
        }
    };

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

socket.on('user-disconnected', (data) => {
    addNotification(`${data.userName || 'A user'} has disconnected`);
    if (peerConnections[data.peerId]) {
        peerConnections[data.peerId].close();
        delete peerConnections[data.peerId];
    }
});

socket.on('user-audio', (data) => {
    if (data.stream && speakerEnabled) {
        const audio = new Audio();
        audio.srcObject = new MediaStream([data.stream]);
        audio.play();
    }
});

// Draggable notification panel
const notificationPanel = document.getElementById('notification-panel');
const dragHandle = document.querySelector('.drag-handle');

let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let xOffset = 0;
let yOffset = 0;

dragHandle.addEventListener('mousedown', dragStart);
document.addEventListener('mousemove', drag);
document.addEventListener('mouseup', dragEnd);

function dragStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    isDragging = true;
}

function drag(e) {
    if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        setTranslate(currentX, currentY, notificationPanel);
    }
}

function dragEnd() {
    isDragging = false;
}

function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
}

// Chat functionality
const chatFab = document.getElementById('chat-fab');
const chatPanel = document.getElementById('chat-panel');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-message');
const chatMessages = document.getElementById('chat-messages');
let unreadMessages = 0;

chatFab.addEventListener('click', () => {
    chatPanel.classList.toggle('hidden');
    unreadMessages = 0;
    updateChatNotification();
});

document.getElementById('close-chat').addEventListener('click', () => {
    chatPanel.classList.add('hidden');
});

let messageQueue = [];
let isSending = false;

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    messageInput.value = '';
    
    // Add message to chat immediately for better UX
    addMessageToChat(message, true);
    
    // Send message to server
    socket.emit('chat-message', {
        text: message,
        sender: userName || deviceName,
        timestamp: Date.now()
    }, (response) => {
        if (response.error) {
            console.error('Error sending message:', response.error);
            // Optionally show error to user
        }
    });
}

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function addMessageToChat(message, isSent = false, sender = '') {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', isSent ? 'sent' : 'received');
    
    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content');
    
    const messageText = document.createElement('div');
    messageText.classList.add('message-text');
    messageText.textContent = isSent ? message : message;
    
    const messageInfo = document.createElement('div');
    messageInfo.classList.add('message-info');
    messageInfo.textContent = isSent ? 'You' : sender;
    
    const timeStamp = document.createElement('span');
    timeStamp.classList.add('message-time');
    timeStamp.textContent = new Date().toLocaleTimeString();
    
    messageContent.appendChild(messageText);
    messageContent.appendChild(messageInfo);
    messageContent.appendChild(timeStamp);
    messageElement.appendChild(messageContent);
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    if (!isSent && chatPanel.classList.contains('hidden')) {
        unreadMessages++;
        updateChatNotification();
        addNotification(`New message from ${sender}`);
    }
}

function updateChatNotification() {
    const notification = document.querySelector('.chat-notification');
    if (unreadMessages > 0) {
        notification.classList.remove('hidden');
        notification.textContent = unreadMessages;
    } else {
        notification.classList.add('hidden');
    }
}


socket.on('chat-message', (data) => {
    if (data.sender !== (userName || deviceName)) {
        addMessageToChat(data.text, false, data.sender);
    }
});

function setupDraggable(element, handle) {
    let pos = { x: 0, y: 0 };
    let isDragging = false;

    const constrainPosition = (x, y) => {
        const rect = element.getBoundingClientRect();
        const parentRect = element.parentElement.getBoundingClientRect();
        
        return {
            x: Math.min(Math.max(x, 0), parentRect.width - rect.width),
            y: Math.min(Math.max(y, 0), parentRect.height - rect.height)
        };
    };

    const onMouseDown = (e) => {
        isDragging = true;
        pos = {
            x: e.clientX - element.offsetLeft,
            y: e.clientY - element.offsetTop
        };
        
        handle.style.cursor = 'grabbing';
        e.preventDefault();
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;

        const newPos = constrainPosition(
            e.clientX - pos.x,
            e.clientY - pos.y
        );

        element.style.transform = `translate(${newPos.x}px, ${newPos.y}px)`;
    };

    const onMouseUp = () => {
        isDragging = false;
        handle.style.cursor = 'grab';
    };

    handle.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// Initialize draggable notification panel
setupDraggable(
    document.getElementById('notification-panel'),
    document.querySelector('.drag-handle')
);