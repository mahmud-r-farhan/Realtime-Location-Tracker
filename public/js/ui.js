import { focusMapOnDevice, openDevicePopup, showDeviceInfo } from './map.js';
import { emitRequestDeviceLocation } from './socket.js';
import { getDeviceIcon } from './device.js';

export function showNamePopup() {
    document.getElementById('name-popup').classList.remove('hidden');
}

export function hideNamePopup() {
    document.getElementById('name-popup').classList.add('hidden');
}

export function getUserNameInput() {
    return document.getElementById('user-name-input').value.trim();
}

export function updateDeviceList(devices, currentSocketId) {
    const deviceList = document.getElementById('device-list');
    deviceList.innerHTML = '';
    devices.forEach(([id, device]) => {
        const li = document.createElement('li');
        const iconKey = getDeviceIcon(device.deviceName);
        const isCurrentUser = id === currentSocketId;
        li.innerHTML = `
            <span class="device-icon ${iconKey.toLowerCase().replace(' ', '-')}"></span>
            <span class="device-name">${device.deviceName}${isCurrentUser ? ' (You)' : ''}</span>
            <span class="device-info"><i class="fas fa-info-circle"></i></span>
        `;
        li.addEventListener('click', () => {
            focusMapOnDevice(device.latitude, device.longitude);
            emitRequestDeviceLocation(id);
        });
        const infoIcon = li.querySelector('.device-info');
        infoIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            if (markers[id]) {
                openDevicePopup(id);
            } else {
                console.warn(`Marker not found for ${device.deviceName}.`);
                showDeviceInfo(device);
            }
        });
        deviceList.appendChild(li);
    });
}

export function updateUserCount(count) {
    document.getElementById('user-count').textContent = count;
}

export function initSidebar() {
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        const icon = sidebar.querySelector('i');
        icon.classList.toggle('fa-chevron-left');
        icon.classList.toggle('fa-chevron-right');
    });
}

export function setupContinueButton(callback) {
    document.getElementById('continue-btn').addEventListener('click', callback);
}