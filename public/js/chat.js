import { addNotification } from './notification.js';
import { socket } from './socket.js';
import { getDeviceName } from './device.js';
import { playNotificationBeep } from './sounds.js';
import { focusMapOnDevice, markers } from './map.js';

let unreadMessages = 0;
let currentUserName = '';
let chatGeneration = 0;

// Keep the DOM bounded during long sessions
const MAX_CHAT_MESSAGES = 200;

export function setCurrentChatUser(name) {
    currentUserName = name;
}

export function addMessageToChat(messageData, isSent) {
    const { text, sender, timestamp } = messageData;
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', isSent ? 'sent' : 'received');
    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content');
    const messageText = document.createElement('div');
    messageText.classList.add('message-text');
    messageText.textContent = text; // textContent: never interpreted as HTML
    const messageInfo = document.createElement('div');
    messageInfo.classList.add('message-info');

    const senderSpan = document.createElement('span');
    senderSpan.classList.add('message-sender');
    senderSpan.textContent = isSent ? 'You' : sender;

    const timeStamp = document.createElement('span');
    timeStamp.classList.add('message-time');
    timeStamp.textContent = new Date(timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageInfo.appendChild(senderSpan);
    messageInfo.appendChild(document.createTextNode(' • '));
    messageInfo.appendChild(timeStamp);

    messageContent.appendChild(messageText);
    messageContent.appendChild(messageInfo);
    messageElement.appendChild(messageContent);

    // Add click listener to focus on sender location
    if (!isSent && messageData.senderId) {
        messageElement.style.cursor = 'pointer';
        messageElement.title = 'Click to view sender location';
        messageElement.tabIndex = 0;
        messageElement.setAttribute('role', 'button');
        messageElement.setAttribute('aria-label', `Show ${sender}'s location on map`);
        const focusSender = () => {
            const marker = markers[messageData.senderId];
            if (marker) {
                const latLng = marker.getLatLng();
                focusMapOnDevice(latLng.lat, latLng.lng, 18); // Zoom nicely
                marker.openPopup();

                // On mobile, close chat to show map
                setChatOpen(false);
            } else {
                addNotification('🚫 Sender location not available');
            }
        };
        messageElement.addEventListener('click', focusSender);
        messageElement.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); focusSender(); }
        });
    }

    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    document.getElementById('chat-empty')?.remove();
    chatMessages.appendChild(messageElement);
    while (chatMessages.children.length > MAX_CHAT_MESSAGES) {
        chatMessages.removeChild(chatMessages.firstChild);
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (!isSent) {
        const isPanelHidden = document.getElementById('chat-panel')?.classList.contains('hidden');
        if (isPanelHidden) {
            unreadMessages++;
            updateChatNotification();
            // addNotification plays the beep for the new message
            addNotification(`New message from ${sender}`);
        } else {
            // Panel is open - audible feedback without a log entry
            playNotificationBeep();
        }
    }
}

function updateChatNotification() {
    const notification = document.querySelector('.chat-notification');
    if (!notification) return;
    if (unreadMessages > 0) {
        notification.classList.remove('hidden');
        notification.textContent = unreadMessages;
    } else {
        notification.classList.add('hidden');
    }
}

function setChatOpen(open) {
    const panel = document.getElementById('chat-panel');
    const button = document.getElementById('chat-fab');
    if (!panel || !button) return;
    panel.classList.toggle('hidden', !open);
    panel.inert = !open;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close room chat' : 'Open room chat');
    if (open) {
        unreadMessages = 0;
        updateChatNotification();
        document.getElementById('message-input')?.focus();
    }
}

export function initChat() {
    const chatFab = document.getElementById('chat-fab');
    const chatPanel = document.getElementById('chat-panel');
    const closeChatBtn = document.getElementById('close-chat');
    const sendBtn = document.getElementById('send-message');
    const messageInput = document.getElementById('message-input');
    if (!chatFab || !chatPanel || !sendBtn || !messageInput) return;

    setCurrentChatUser(localStorage.getItem('userName') || getDeviceName());

    chatPanel.inert = chatPanel.classList.contains('hidden');
    window.addEventListener('tracker-sidebar-open', () => setChatOpen(false));
    window.addEventListener('tracker-room-changing', () => {
        chatGeneration++;
        unreadMessages = 0;
        updateChatNotification();
        messageInput.value = '';
        sendBtn.disabled = false;
        const messages = document.getElementById('chat-messages');
        if (messages) {
            messages.replaceChildren();
            const empty = document.createElement('div');
            empty.className = 'chat-empty';
            empty.id = 'chat-empty';
            empty.innerHTML = '<i class="far fa-comment-dots" aria-hidden="true"></i><strong>Say hello</strong><span>Messages from your room will appear here.</span>';
            messages.appendChild(empty);
        }
    });
    chatFab.addEventListener('click', () => setChatOpen(chatPanel.classList.contains('hidden')));
    closeChatBtn?.addEventListener('click', () => { setChatOpen(false); chatFab.focus(); });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !chatPanel.classList.contains('hidden') &&
            document.getElementById('sos-modal')?.classList.contains('hidden')) {
            setChatOpen(false);
            chatFab.focus();
        }
    });

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    function sendMessage() {
        const messageText = messageInput.value.trim();
        if (!messageText || sendBtn.disabled) return;
        if (!socket.connected) {
            addNotification('Message not sent: disconnected.');
            return;
        }
        sendBtn.disabled = true;
        const generation = chatGeneration;
        const messageData = {
            text: messageText,
            sender: localStorage.getItem('userName') || currentUserName || 'Unknown',
            timestamp: Date.now()
        };
        socket.timeout(5000).emit('chat-message', messageData, (error, response) => {
            if (generation !== chatGeneration) return;
            sendBtn.disabled = false;
            if (error || response?.error) {
                addNotification(`Message not confirmed: ${response?.error || 'connection timed out'}`);
                return;
            }
            if (messageInput.value.trim() === messageText) messageInput.value = '';
            addMessageToChat(messageData, true);
        });
    }
}
