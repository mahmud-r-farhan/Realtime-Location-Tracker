import { addNotification } from './notification.js';
import { socket } from './socket.js';
import { getDeviceName } from './device.js';
import { playNotificationBeep } from './sounds.js';
import { focusMapOnDevice, markers } from './map.js';

let unreadMessages = 0;
let currentUserName = '';

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
    messageText.textContent = text;
    const messageInfo = document.createElement('div');
    messageInfo.classList.add('message-info');
    messageInfo.textContent = isSent ? 'You' : sender;
    const timeStamp = document.createElement('span');
    timeStamp.classList.add('message-time');
    timeStamp.textContent = new Date(timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    messageContent.appendChild(messageText);
    messageContent.appendChild(messageInfo);
    messageContent.appendChild(timeStamp);
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
                if (window.innerWidth <= 768) {
                    document.getElementById('chat-panel').classList.add('hidden');
                }
            } else {
                addNotification('🚫 Sender location not available');
            }
        });
    }

    const chatMessages = document.getElementById('chat-messages');
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    if (!isSent && document.getElementById('chat-panel').classList.contains('hidden')) {
        unreadMessages++;
        updateChatNotification();
        addNotification(`New message from ${sender}`);
    }
    // Play sound for all incoming messages, even if panel is open (user feedback)
    if (!isSent) {
        playNotificationBeep();
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

export function initChat() {
    setCurrentChatUser(localStorage.getItem('userName') || getDeviceName());
    document.getElementById('chat-fab').addEventListener('click', () => {
        const chatPanel = document.getElementById('chat-panel');
        // If hidden, we are opening it
        if (chatPanel.classList.contains('hidden')) {
            chatPanel.classList.remove('hidden');
            unreadMessages = 0;
            updateChatNotification();
            // Minor delay to ensure visibility before focus
            setTimeout(() => document.getElementById('message-input').focus(), 50);
        } else {
            // Closing it
            chatPanel.classList.add('hidden');
        }
    });
    document.getElementById('close-chat').addEventListener('click', () => {
        document.getElementById('chat-panel').classList.add('hidden');
    });
    document.getElementById('send-message').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    async function sendMessage() {
        const messageText = document.getElementById('message-input').value.trim();
        if (!messageText) return;
        document.getElementById('message-input').value = '';
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
                addNotification('Failed to send message.');
            }
        });
    }
}