import { addNotification } from './notification.js';
import { socket } from './socket.js';
import { getDeviceName } from './device.js';
import { playNotificationBeep } from './sounds.js';
import { focusMapOnDevice, markers } from './map.js';

let unreadMessages = 0;
let currentUserName = '';

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
        messageElement.addEventListener('click', () => {
            const marker = markers[messageData.senderId];
            if (marker) {
                const latLng = marker.getLatLng();
                focusMapOnDevice(latLng.lat, latLng.lng, 18); // Zoom nicely
                marker.openPopup();

                // On mobile, close chat to show map
                document.getElementById('chat-panel')?.classList.add('hidden');
            } else {
                addNotification('🚫 Sender location not available');
            }
        });
    }

    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

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

export function initChat() {
    const chatFab = document.getElementById('chat-fab');
    const chatPanel = document.getElementById('chat-panel');
    const closeChatBtn = document.getElementById('close-chat');
    const sendBtn = document.getElementById('send-message');
    const messageInput = document.getElementById('message-input');
    if (!chatFab || !chatPanel || !sendBtn || !messageInput) return;

    setCurrentChatUser(localStorage.getItem('userName') || getDeviceName());

    chatFab.addEventListener('click', () => {
        // If hidden, we are opening it
        if (chatPanel.classList.contains('hidden')) {
            chatPanel.classList.remove('hidden');
            unreadMessages = 0;
            updateChatNotification();
            // Minor delay to ensure visibility before focus
            setTimeout(() => messageInput.focus(), 50);
        } else {
            // Closing it
            chatPanel.classList.add('hidden');
        }
    });

    if (closeChatBtn) {
        closeChatBtn.addEventListener('click', () => {
            chatPanel.classList.add('hidden');
        });
    }

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    function sendMessage() {
        const messageText = messageInput.value.trim();
        if (!messageText) return;
        messageInput.value = '';
        const currentName = localStorage.getItem('userName') || currentUserName || 'Unknown';
        const messageData = {
            text: messageText,
            sender: currentName,
            timestamp: Date.now()
        };
        addMessageToChat(messageData, true);
        socket.emit('chat-message', messageData, (response) => {
            if (response?.error) {
                console.error('Error sending message:', response.error);
                addNotification(`Failed to send message: ${response.error}`);
            }
        });
    }
}
