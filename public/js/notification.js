import { MAX_NOTIFICATIONS, NOTIFICATION_ACTIVE_TIMEOUT } from './config.js';
import { playNotificationBeep } from './sounds.js';

const activeNotifications = new Map();
let unreadActivity = 0;

function updateActivityBadge() {
    const badge = document.getElementById('activity-unread');
    if (!badge) return;
    badge.textContent = unreadActivity > 99 ? '99+' : String(unreadActivity);
    badge.classList.toggle('hidden', unreadActivity === 0);
    badge.setAttribute('aria-label', `${unreadActivity} unread activity updates`);
}

function clearActivity() {
    document.getElementById('notification-list')?.replaceChildren();
    document.getElementById('activity-empty')?.classList.remove('hidden');
    activeNotifications.forEach(clearTimeout);
    activeNotifications.clear();
    unreadActivity = 0;
    updateActivityBadge();
}

export function addNotification(message) {
    if (activeNotifications.has(message)) return;

    // Play sound
    playNotificationBeep();

    const list = document.getElementById('notification-list');
    if (!list) return;

    // Build with textContent so dynamic parts (device names, server messages)
    // can never be interpreted as HTML.
    const time = new Date().toLocaleTimeString();
    const li = document.createElement('li');

    const timeSpan = document.createElement('span');
    timeSpan.className = 'notification-time';
    timeSpan.textContent = `[${time}] `;

    li.appendChild(timeSpan);
    li.appendChild(document.createTextNode(message));

    list.insertBefore(li, list.firstChild);
    document.getElementById('activity-empty')?.classList.add('hidden');
    if (document.getElementById('notification-panel')?.classList.contains('minimized')) {
        unreadActivity++;
        updateActivityBadge();
    }
    if (list.children.length > MAX_NOTIFICATIONS) {
        list.removeChild(list.lastChild);
    }
    const timer = setTimeout(() => activeNotifications.delete(message), NOTIFICATION_ACTIVE_TIMEOUT);
    activeNotifications.set(message, timer);
}

export function initNotificationPanel() {
    const toggleBtn = document.getElementById('notification-toggle');
    const panel = document.getElementById('notification-panel');
    if (!toggleBtn || !panel) return;

    toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('minimized');
        const expanded = !panel.classList.contains('minimized');
        if (expanded) { unreadActivity = 0; updateActivityBadge(); }
        toggleBtn.textContent = expanded ? '−' : '+';
        toggleBtn.setAttribute('aria-expanded', String(expanded));
        toggleBtn.setAttribute('aria-label', expanded ? 'Hide activity' : 'Show activity');
        requestAnimationFrame(() => clampPanel(panel));
    });
    document.getElementById('clear-activity')?.addEventListener('click', clearActivity);
    window.addEventListener('tracker-room-changing', clearActivity);
    setupDraggable(panel, panel.querySelector('.drag-handle'));
}

function clampPanel(element) {
    const bounds = element.getBoundingClientRect();
    const dx = Math.min(0, window.innerWidth - bounds.right) + Math.max(0, -bounds.left);
    const dy = Math.min(0, window.innerHeight - bounds.bottom) + Math.max(0, -bounds.top);
    if (!dx && !dy) return;
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform === 'none' ? '' : getComputedStyle(element).transform);
    element.style.transform = `translate3d(${matrix.m41 + dx}px, ${matrix.m42 + dy}px, 0)`;
}

function setupDraggable(element, handle) {
    if (!handle || !element) return;
    let startX, startY, baseLeft, baseTop, xOffset = 0, yOffset = 0, pointerId = null;
    handle.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest('button')) return;
        const transform = getComputedStyle(element).transform;
        const matrix = new DOMMatrixReadOnly(transform === 'none' ? '' : transform);
        xOffset = matrix.m41;
        yOffset = matrix.m42;
        const bounds = element.getBoundingClientRect();
        baseLeft = bounds.left - xOffset;
        baseTop = bounds.top - yOffset;
        startX = event.clientX - xOffset;
        startY = event.clientY - yOffset;
        pointerId = event.pointerId;
        handle.setPointerCapture(pointerId);
        handle.style.cursor = 'grabbing';
    });
    handle.addEventListener('pointermove', event => {
        if (event.pointerId !== pointerId) return;
        const maxX = Math.max(-baseLeft, window.innerWidth - element.offsetWidth - baseLeft);
        const maxY = Math.max(-baseTop, window.innerHeight - element.offsetHeight - baseTop);
        xOffset = Math.min(maxX, Math.max(-baseLeft, event.clientX - startX));
        yOffset = Math.min(maxY, Math.max(-baseTop, event.clientY - startY));
        element.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
    });
    const end = event => {
        if (event.pointerId !== pointerId) return;
        pointerId = null;
        handle.style.cursor = 'grab';
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    handle.addEventListener('lostpointercapture', end);
    window.addEventListener('resize', () => {
        element.style.transform = '';
        xOffset = 0;
        yOffset = 0;
    });
}
