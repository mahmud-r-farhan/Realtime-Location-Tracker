import { focusMapOnDevice, openDevicePopup, showDeviceInfo, markers } from './map.js';
import { emitRequestDeviceLocation } from './socket.js';
import { getDeviceIcon } from './device.js';
import { escapeHtml } from './utils.js';

export function showNamePopup() {
    document.getElementById('name-popup')?.classList.remove('hidden');
}

export function hideNamePopup() {
    document.getElementById('name-popup')?.classList.add('hidden');
}

export function getUserNameInput() {
    return document.getElementById('user-name-input')?.value.trim() || '';
}

export function getOrgInput() {
    return document.getElementById('org-input')?.value.trim() || '';
}

export function updateDeviceList(devices, currentSocketId) {
    const deviceList = document.getElementById('device-list');
    if (!deviceList || !Array.isArray(devices)) return;

    deviceList.innerHTML = '';
    devices.forEach(([id, device]) => {
        if (!device || typeof device !== 'object') return;

        const li = document.createElement('li');
        const iconKey = getDeviceIcon(device.deviceName);
        const isCurrentUser = id === currentSocketId;
        li.innerHTML = `
            <span class="device-icon ${iconKey.toLowerCase().replace(' ', '-')}"></span>
            <span class="device-name">${escapeHtml(device.deviceName)}${isCurrentUser ? ' (You)' : ''}</span>
            <span class="device-info"><i class="fas fa-info-circle"></i></span>
        `;
        li.addEventListener('click', () => {
            focusMapOnDevice(device.latitude, device.longitude);
            emitRequestDeviceLocation(id);
        });
        const infoIcon = li.querySelector('.device-info');
        if (infoIcon) {
            infoIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                if (markers[id]) {
                    openDevicePopup(id);
                } else {
                    console.warn(`Marker not found for ${device.deviceName}.`);
                    showDeviceInfo(device);
                }
            });
        }
        deviceList.appendChild(li);
    });
}

export function updateUserCount(count) {
    const el = document.getElementById('user-count');
    if (el && Number.isFinite(count)) {
        el.textContent = count;
    }
}

export function initSidebar() {
    const toggle = document.getElementById('sidebar-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        sidebar.classList.toggle('collapsed');
        const icon = sidebar.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-chevron-left');
            icon.classList.toggle('fa-chevron-right');
        }
    });
}

export function setupContinueButton(callback) {
    const continueBtn = document.getElementById('continue-btn');
    if (!continueBtn) return;

    continueBtn.addEventListener('click', () => {
        // Prevent double-submit: a second click would re-run initialization
        if (continueBtn.disabled) return;
        continueBtn.disabled = true;
        callback();
    });
}

export function initInviteLink() {
    const copyBtn = document.getElementById('copy-invite-btn');
    if (!copyBtn) return;

    async function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }
        // Fallback for non-secure contexts (e.g. plain HTTP LAN deployments)
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            if (!document.execCommand('copy')) {
                throw new Error('execCommand copy failed');
            }
        } finally {
            textarea.remove();
        }
    }

    copyBtn.addEventListener('click', async () => {
        const org = localStorage.getItem('orgName') || 'public';
        const url = new URL(window.location.href);
        url.searchParams.set('room', org);

        try {
            await copyText(url.toString());
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            copyBtn.style.borderColor = 'var(--success-color)';
            copyBtn.style.color = 'var(--success-color)';

            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.style.borderColor = 'var(--primary-color)';
                copyBtn.style.color = 'var(--primary-color)';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy: ', err);
            window.prompt('Copy the invite link:', url.toString());
        }
    });
}
