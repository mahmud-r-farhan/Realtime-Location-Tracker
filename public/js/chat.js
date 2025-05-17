import { addNotification } from './notification.js';
import { socket } from './socket.js';
import { getDeviceName } from './device.js';

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
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    if (!isSent && document.getElementById('chat-panel').classList.contains('hidden')) {
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

export function initChat() {
    setCurrentChatUser(localStorage.getItem('userName') || getDeviceName());
    document.getElementById('chat-fab').addEventListener('click', () => {
        const chatPanel = document.getElementById('chat-panel');
        chatPanel.classList.toggle('hidden');
        if (!chatPanel.classList.contains('hidden')) {
            unreadMessages = 0;
            updateChatNotification();
            document.getElementById('message-input').focus();
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
        const messageData = {
            text: messageText,
            sender: currentUserName,
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