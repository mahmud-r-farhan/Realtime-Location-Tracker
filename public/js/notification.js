import { MAX_NOTIFICATIONS, NOTIFICATION_ACTIVE_TIMEOUT } from './config.js';
import { playNotificationBeep } from './sounds.js';

let activeNotifications = new Set();

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
    if (list.children.length > MAX_NOTIFICATIONS) {
        list.removeChild(list.lastChild);
    }
    activeNotifications.add(message);
    setTimeout(() => activeNotifications.delete(message), NOTIFICATION_ACTIVE_TIMEOUT);
}

export function initNotificationPanel() {
    const toggleBtn = document.getElementById('notification-toggle');
    const panel = document.getElementById('notification-panel');
    if (!toggleBtn || !panel) return;

    toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('minimized');
        toggleBtn.textContent = panel.classList.contains('minimized') ? '+' : '-';
    });
    setupDraggable(panel, panel.querySelector('.drag-handle'));
}

function setupDraggable(element, handle) {
    let isDragging = false, initialX, initialY, xOffset = 0, yOffset = 0;
    if (!handle || !element) return console.error("Draggable setup failed.");
    handle.style.cursor = 'grab';
    handle.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.parentElement?.tagName === 'BUTTON') return;
        const style = window.getComputedStyle(element);
        const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? '' : style.transform);
        xOffset = matrix.m41;
        yOffset = matrix.m42;
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        isDragging = true;
        handle.style.cursor = 'grabbing';
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
    });
    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            const currentX = e.clientX - initialX;
            const currentY = e.clientY - initialY;
            element.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        }
    }
    function dragEnd() {
        if (isDragging) {
            isDragging = false;
            handle.style.cursor = 'grab';
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', dragEnd);
        }
    }
}
