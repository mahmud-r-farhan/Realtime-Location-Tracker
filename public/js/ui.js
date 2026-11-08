import { focusMapOnDevice, openDevicePopup, showDeviceInfo, markers, fitVisibleDevices } from './map.js';
import { emitRequestDeviceLocation, getJoinedRoom } from './socket.js';
import { getDeviceIcon, getDeviceSymbol } from './device.js';
import { formatFixAge, isValidLatLng } from './utils.js';

export function showNamePopup() {
    document.getElementById('name-popup')?.classList.remove('hidden');
    document.getElementById('user-name-input')?.focus();
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

const deviceListMessages = {
    connecting: ['Connecting', 'Waiting for the room’s location list.'],
    offline: ['Locations unavailable', 'Reconnect to see devices sharing in this room.'],
    ready: ['No locations yet', 'Devices will appear when they share a location.']
};

let currentDeviceListState = null;

export function setDeviceListState(state) {
    if (state === currentDeviceListState) return;
    currentDeviceListState = state;
    const [title, description] = deviceListMessages[state] || deviceListMessages.connecting;
    const titleElement = document.getElementById('device-empty-title');
    const descriptionElement = document.getElementById('device-empty-description');
    if (titleElement) titleElement.textContent = title;
    if (descriptionElement) descriptionElement.textContent = description;
    const count = document.getElementById('user-count');
    if (count && state !== 'ready') count.textContent = '—';
    const invite = document.getElementById('copy-invite-btn');
    const inviteStatus = document.getElementById('invite-status');
    if (invite) invite.disabled = state !== 'ready';
    if (inviteStatus) inviteStatus.textContent = state === 'ready'
        ? 'Anyone with the room name can join.' : 'Connect to share a room invite.';
}

function updateDeviceFocusLabel(row) {
    const device = row._device;
    if (!device) return;
    const name = device.deviceName || 'Unknown device';
    const type = getDeviceIcon(device.deviceInfo?.deviceType || device.deviceName);
    const accuracy = Number.isFinite(device.accuracy) ? `, estimated accuracy ${Math.round(device.accuracy)} meters` : '';
    row.querySelector('.device-focus')?.setAttribute('aria-label',
        `Show ${name}${row._isSelf ? ' (you)' : ''} on map. ${type}. Fix ${formatFixAge(device.capturedAt)}${accuracy}.`);
}

export function updateDeviceList(devices, currentSocketId) {
    const deviceList = document.getElementById('device-list');
    if (!deviceList || !Array.isArray(devices)) return;

    const valid = devices.filter(entry => Array.isArray(entry) && typeof entry[0] === 'string' &&
        entry[1] && isValidLatLng(entry[1].latitude, entry[1].longitude));
    document.getElementById('device-empty')?.classList.toggle('hidden', valid.length > 0);
    const fitButton = document.getElementById('fit-devices-btn');
    if (fitButton) fitButton.disabled = valid.length === 0;

    // Reuse rows during frequent location updates: replacing the entire list
    // interrupts focus, pointer interaction and screen-reader navigation.
    const activeControl = deviceList.contains(document.activeElement) ? document.activeElement : null;
    const existing = new Map(Array.from(deviceList.children, row => [row.dataset.deviceId, row]));
    const remaining = new Set(valid.map(([id]) => id));
    let lostFocus = false;
    existing.forEach((row, id) => {
        if (!remaining.has(id)) {
            if (row.contains(document.activeElement)) lostFocus = true;
            row.remove();
            existing.delete(id);
        }
    });
    valid.forEach(([id, device], index) => {
        let row = existing.get(id);
        if (!row) {
            row = document.createElement('li');
            row.dataset.deviceId = id;
            existing.set(id, row);
            row.innerHTML = `
                <button class="device-focus" type="button">
                    <span class="device-icon" aria-hidden="true"><i class="fas"></i></span>
                    <span class="device-copy">
                        <span class="device-title"><span class="device-name"></span><span class="device-self-badge" hidden>You</span></span>
                        <span class="device-type"></span>
                        <span class="device-fix"><span data-fix-time></span><span class="device-accuracy"></span></span>
                    </span>
                </button>
                <button class="device-info" type="button"><i class="fas fa-info-circle" aria-hidden="true"></i></button>`;
            row.querySelector('.device-focus').addEventListener('click', () => {
                const current = row._device;
                focusMapOnDevice(current.latitude, current.longitude);
                emitRequestDeviceLocation(id);
                window.dispatchEvent(new Event('tracker-show-map'));
            });
            row.querySelector('.device-info').addEventListener('click', () => {
                if (markers[id]) openDevicePopup(id);
                else showDeviceInfo(row._device);
                window.dispatchEvent(new Event('tracker-show-map'));
            });
        }
        row._device = device;
        const iconKey = getDeviceIcon(device.deviceInfo?.deviceType || device.deviceName);
        const isCurrentUser = id === currentSocketId;
        const name = device.deviceName || 'Unknown device';
        row._isSelf = isCurrentUser;
        updateDeviceFocusLabel(row);
        const focusButton = row.querySelector('.device-focus');
        focusButton.title = 'Show on map';
        const infoButton = row.querySelector('.device-info');
        infoButton.setAttribute('aria-label', `Show details for ${name}${isCurrentUser ? ' (you)' : ''}`);
        infoButton.title = 'Show device details';
        row.querySelector('.device-icon i').className = `fas ${getDeviceSymbol(iconKey)}`;
        row.querySelector('.device-name').textContent = name;
        row.querySelector('.device-self-badge').hidden = !isCurrentUser;
        const typeLabel = row.querySelector('.device-type');
        typeLabel.textContent = iconKey === 'Unknown Device' ? 'Device type unavailable' : iconKey;
        typeLabel.hidden = typeLabel.textContent.toLowerCase() === String(name).toLowerCase();
        const fixTime = row.querySelector('[data-fix-time]');
        fixTime.dataset.fixTime = device.capturedAt || '';
        fixTime.textContent = `Fix: ${formatFixAge(device.capturedAt)}`;
        row.querySelector('.device-accuracy').textContent = Number.isFinite(device.accuracy) ? ` · ±${Math.round(device.accuracy)} m` : '';
        if (deviceList.children[index] !== row) deviceList.insertBefore(row, deviceList.children[index] || null);
    });
    if (lostFocus) (fitButton && !fitButton.disabled ? fitButton : document.getElementById('sidebar-toggle'))?.focus({ preventScroll: true });
    else if (activeControl?.isConnected && document.activeElement !== activeControl) activeControl.focus({ preventScroll: true });
}

export function updateUserCount(count) {
    const el = document.getElementById('user-count');
    if (el && Number.isFinite(count)) {
        el.textContent = count;
    }
}

export function initSidebar() {
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const panel = document.getElementById('info-panel');
    if (!toggle || !sidebar || !panel) return;
    document.getElementById('fit-devices-btn')?.addEventListener('click', () => {
        if (fitVisibleDevices()) window.dispatchEvent(new Event('tracker-show-map'));
    });
    // Keep age labels useful even when no fresh packets arrive.
    setInterval(() => {
        document.querySelectorAll('[data-fix-time]').forEach(element => {
            element.textContent = `Fix: ${formatFixAge(element.dataset.fixTime)}`;
            const row = element.closest('#device-list li');
            if (row) updateDeviceFocusLabel(row);
        });
    }, 30_000);
    function setOpen(open) {
        sidebar.classList.toggle('collapsed', !open);
        document.body.classList.toggle('sidebar-open', open);
        if (open && window.matchMedia('(max-width: 768px)').matches) {
            window.dispatchEvent(new Event('tracker-sidebar-open'));
        }
        panel.inert = !open;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', `${open ? 'Close' : 'Open'} devices panel`);
        const icon = toggle.querySelector('i');
        icon?.classList.toggle('fa-chevron-left', !open);
        icon?.classList.toggle('fa-chevron-right', open);
    }
    toggle.addEventListener('click', () => setOpen(sidebar.classList.contains('collapsed')));
    window.addEventListener('tracker-show-map', () => {
        if (window.matchMedia('(max-width: 768px)').matches) {
            setOpen(false);
            document.getElementById('map')?.focus({ preventScroll: true });
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !sidebar.classList.contains('collapsed') &&
            document.getElementById('sos-modal')?.classList.contains('hidden') &&
            document.getElementById('name-popup')?.classList.contains('hidden')) {
            setOpen(false);
            toggle.focus();
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
    const originalText = copyBtn.innerHTML;
    let resetTimer;
    let copying = false;
    function resetCopyFeedback() {
        clearTimeout(resetTimer);
        copyBtn.innerHTML = originalText;
        copyBtn.style.removeProperty('border-color');
        copyBtn.style.removeProperty('color');
    }
    window.addEventListener('tracker-room-changing', resetCopyFeedback);

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
        const org = getJoinedRoom();
        if (!org || copying) return;
        const url = new URL(window.location.href);
        url.searchParams.set('room', org);
        copying = true;
        try {
            await copyText(url.toString());
            const status = document.getElementById('invite-status');
            if (getJoinedRoom() !== org) {
                if (status) status.textContent = 'Copied the previous room. Copy again for the current room.';
                return;
            }
            if (status) status.textContent = 'Invite copied. Anyone with the room name can join.';
            copyBtn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Copied!';
            copyBtn.style.borderColor = 'var(--success-color)';
            copyBtn.style.color = 'var(--success-color)';
            clearTimeout(resetTimer);
            resetTimer = setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.style.removeProperty('border-color');
                copyBtn.style.removeProperty('color');
                if (status && getJoinedRoom() === org) status.textContent = 'Anyone with the room name can join.';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy: ', err);
            window.prompt('Copy the invite link:', url.toString());
        } finally {
            copying = false;
        }
    });
}
