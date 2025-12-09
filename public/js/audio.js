import { WEBRTC_CONFIGURATION } from './config.js';
import { socket, emitJoinAudio, emitLeaveAudio } from './socket.js';
import { addNotification } from './notification.js';

// Audio state management
let localStream = null;
let audioEnabled = false;
let speakerEnabled = true;
let isInCall = false;

// Store peer connections and audio elements
export const peerConnections = {};
const remoteAudioElements = {};
const pendingCandidates = {};

// Create UI elements for call status
let callStatusElement = null;
let activeUsersElement = null;

/**
 * Creates a peer connection for a specific peer
 */
export function createPeerConnection(peerId) {
    // Close existing connection if any
    if (peerConnections[peerId]) {
        closePeerConnection(peerId);
    }

    console.log(`Creating peer connection for: ${peerId}`);
    const pc = new RTCPeerConnection(WEBRTC_CONFIGURATION);

    // Initialize pending candidates array
    pendingCandidates[peerId] = [];

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                target: peerId,
                candidate: event.candidate
            });
        }
    };

    // Handle incoming tracks
    pc.ontrack = (event) => {
        console.log(`Received track from ${peerId}`);
        if (event.streams && event.streams[0]) {
            handleRemoteStream(peerId, event.streams[0]);
        }
    };

    // Monitor ICE connection state
    pc.oniceconnectionstatechange = () => {
        console.log(`ICE state for ${peerId}: ${pc.iceConnectionState}`);
        if (['failed', 'disconnected', 'closed'].includes(pc.iceConnectionState)) {
            handlePeerDisconnected(peerId);
        } else if (pc.iceConnectionState === 'connected') {
            addNotification(`Audio connected with a peer`);
            updateCallUI();
        }
    };

    // Monitor connection state
    pc.onconnectionstatechange = () => {
        console.log(`Connection state for ${peerId}: ${pc.connectionState}`);
        if (pc.connectionState === 'connected') {
            updateCallUI();
        }
    };

    peerConnections[peerId] = pc;
    return pc;
}

/**
 * Handle remote audio stream
 */
function handleRemoteStream(peerId, stream) {
    // Remove existing audio element for this peer
    if (remoteAudioElements[peerId]) {
        remoteAudioElements[peerId].remove();
    }

    const audio = document.createElement('audio');
    audio.id = `remote-audio-${peerId}`;
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.muted = !speakerEnabled;

    // Add to document (hidden)
    audio.style.display = 'none';
    document.body.appendChild(audio);

    remoteAudioElements[peerId] = audio;

    // Try to play
    audio.play().catch(e => {
        console.error("Error playing audio:", e);
        // Show user interaction prompt if needed
        showPlaybackPrompt();
    });

    updateCallUI();
}

/**
 * Show playback prompt for browsers that require user interaction
 */
function showPlaybackPrompt() {
    if (document.getElementById('audio-playback-prompt')) return;

    const prompt = document.createElement('div');
    prompt.id = 'audio-playback-prompt';
    prompt.innerHTML = `
        <div class="audio-prompt-content">
            <p>🔊 Click to enable audio playback</p>
            <button id="enable-audio-btn">Enable Audio</button>
        </div>
    `;
    prompt.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        z-index: 9999;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        animation: slideUp 0.3s ease;
    `;
    document.body.appendChild(prompt);

    document.getElementById('enable-audio-btn').addEventListener('click', () => {
        Object.values(remoteAudioElements).forEach(audio => {
            audio.play().catch(console.error);
        });
        prompt.remove();
    });
}

/**
 * Handle when a peer disconnects
 */
function handlePeerDisconnected(peerId) {
    closePeerConnection(peerId);
    updateCallUI();
}

/**
 * Handle incoming offer
 */
export async function handleOffer(peerId, description) {
    console.log(`Handling offer from ${peerId}`);

    let pc = peerConnections[peerId];
    if (!pc) {
        pc = createPeerConnection(peerId);
    }

    try {
        // Set remote description
        await pc.setRemoteDescription(new RTCSessionDescription(description));

        // Add local tracks if we have them
        if (localStream && audioEnabled) {
            localStream.getTracks().forEach(track => {
                const senders = pc.getSenders();
                if (!senders.find(sender => sender.track === track)) {
                    pc.addTrack(track, localStream);
                }
            });
        }

        // Create and send answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('answer', {
            target: peerId,
            description: pc.localDescription
        });

        // Process any pending ICE candidates
        if (pendingCandidates[peerId]) {
            for (const candidate of pendingCandidates[peerId]) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
            pendingCandidates[peerId] = [];
        }

    } catch (error) {
        console.error("Error handling offer:", error);
        addNotification('Failed to establish audio connection');
    }
}

/**
 * Handle incoming answer
 */
export async function handleAnswer(peerId, description) {
    const pc = peerConnections[peerId];
    if (!pc) {
        console.warn(`No peer connection for answer from ${peerId}`);
        return;
    }

    try {
        if (pc.signalingState !== 'have-local-offer') {
            console.warn(`Unexpected signaling state: ${pc.signalingState}`);
            return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(description));

        // Process any pending ICE candidates
        if (pendingCandidates[peerId]) {
            for (const candidate of pendingCandidates[peerId]) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
            pendingCandidates[peerId] = [];
        }

    } catch (error) {
        console.error("Error handling answer:", error);
    }
}

/**
 * Handle incoming ICE candidate
 */
export async function handleIceCandidate(peerId, candidate) {
    const pc = peerConnections[peerId];

    if (!pc || !pc.remoteDescription) {
        // Queue the candidate for later
        if (!pendingCandidates[peerId]) {
            pendingCandidates[peerId] = [];
        }
        pendingCandidates[peerId].push(candidate);
        return;
    }

    try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
        console.error('Error adding ICE candidate:', e);
    }
}

/**
 * Close a peer connection and cleanup
 */
export function closePeerConnection(peerId) {
    if (peerConnections[peerId]) {
        peerConnections[peerId].close();
        delete peerConnections[peerId];
    }

    if (remoteAudioElements[peerId]) {
        remoteAudioElements[peerId].remove();
        delete remoteAudioElements[peerId];
    }

    if (pendingCandidates[peerId]) {
        delete pendingCandidates[peerId];
    }

    updateCallUI();
}

/**
 * Initiate a call to a specific peer (send offer)
 */
async function initiateCall(peerId) {
    console.log(`Initiating call to ${peerId}`);

    const pc = createPeerConnection(peerId);

    // Add local tracks
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }

    try {
        const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false
        });
        await pc.setLocalDescription(offer);

        socket.emit('offer', {
            target: peerId,
            description: pc.localDescription
        });
    } catch (error) {
        console.error('Error creating offer:', error);
        addNotification('Failed to initiate call');
    }
}

/**
 * Join the audio call
 */
async function joinCall() {
    try {
        // Get microphone access
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        audioEnabled = true;
        isInCall = true;

        // Update UI
        updateMicButton(true);
        updateCallUI();

        // Emit join audio event
        emitJoinAudio();

        addNotification('Joined audio call - waiting for peers...');

    } catch (err) {
        console.error('Error accessing microphone:', err);

        if (err.name === 'NotAllowedError') {
            addNotification('Microphone access denied. Please enable it in browser settings.');
        } else if (err.name === 'NotFoundError') {
            addNotification('No microphone found. Please connect one and try again.');
        } else {
            addNotification('Failed to access microphone.');
        }
    }
}

/**
 * Leave the audio call
 */
function leaveCall() {
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    // Close all peer connections
    Object.keys(peerConnections).forEach(peerId => {
        closePeerConnection(peerId);
    });

    audioEnabled = false;
    isInCall = false;

    // Update UI
    updateMicButton(false);
    updateCallUI();

    // Emit leave audio event
    emitLeaveAudio();

    addNotification('Left audio call');
}

/**
 * Toggle microphone mute/unmute while in call
 */
function toggleMic() {
    if (!isInCall) {
        // Not in call, join call
        joinCall();
    } else {
        // Already in call
        if (audioEnabled && localStream) {
            // Mute (stop tracks but stay in call)
            localStream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });
            audioEnabled = false;
            updateMicButton(false);
            addNotification('Microphone muted');
        } else if (!audioEnabled && localStream) {
            // Unmute
            localStream.getAudioTracks().forEach(track => {
                track.enabled = true;
            });
            audioEnabled = true;
            updateMicButton(true);
            addNotification('Microphone unmuted');
        }
    }
}

/**
 * Update microphone button state
 */
function updateMicButton(enabled) {
    const micBtn = document.getElementById('mic-btn');
    if (micBtn) {
        const img = micBtn.querySelector('img');
        if (img) {
            img.src = enabled ? '/assets/microphone-on-icon.png' : '/assets/microphone-muted-icon.png';
        }
        micBtn.classList.toggle('active', enabled);
    }
}

/**
 * Toggle speaker on/off
 */
function toggleSpeaker() {
    speakerEnabled = !speakerEnabled;

    // Update all remote audio elements
    Object.values(remoteAudioElements).forEach(audio => {
        audio.muted = !speakerEnabled;
    });

    const speakerBtn = document.getElementById('speaker-btn');
    if (speakerBtn) {
        const img = speakerBtn.querySelector('img');
        if (img) {
            img.src = speakerEnabled ? '/assets/speaker-on-icon.png' : '/assets/speaker-off-icon.png';
        }
        speakerBtn.classList.toggle('active', speakerEnabled);
    }

    addNotification(speakerEnabled ? 'Speaker enabled' : 'Speaker disabled');
}

/**
 * Create and update call status UI
 */
function updateCallUI() {
    const audioControls = document.getElementById('audio-controls');
    if (!audioControls) return;

    // Create or update call status element
    if (!callStatusElement) {
        callStatusElement = document.createElement('div');
        callStatusElement.id = 'call-status';
        callStatusElement.className = 'call-status';
        audioControls.parentNode.insertBefore(callStatusElement, audioControls);
    }

    const peerCount = Object.keys(peerConnections).length;
    const connectedPeers = Object.values(peerConnections).filter(
        pc => pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed'
    ).length;

    if (isInCall) {
        callStatusElement.innerHTML = `
            <div class="call-status-content">
                <span class="call-indicator ${connectedPeers > 0 ? 'active' : 'waiting'}"></span>
                <span class="call-text">
                    ${connectedPeers > 0
                ? `In call with ${connectedPeers} peer${connectedPeers > 1 ? 's' : ''}`
                : 'Waiting for peers...'}
                </span>
            </div>
        `;
        callStatusElement.classList.add('visible');
    } else {
        callStatusElement.classList.remove('visible');
    }
}

/**
 * Handle when another user connects to audio
 */
export function handleUserConnectedToAudio(peerId, userName) {
    if (isInCall && localStream) {
        // Initiate call to the new peer
        initiateCall(peerId);
    }
    updateCallUI();
}

/**
 * Handle when a user disconnects from audio
 */
export function handleUserDisconnectedFromAudio(peerId) {
    closePeerConnection(peerId);
    updateCallUI();
}

/**
 * Get list of current audio peers
 */
export function handleAudioPeersList(peers) {
    console.log('Received audio peers list:', peers);

    // Initiate calls to all existing peers
    if (isInCall && localStream) {
        peers.forEach(peer => {
            if (!peerConnections[peer.peerId]) {
                initiateCall(peer.peerId);
            }
        });
    }
}

/**
 * Initialize audio controls and event listeners
 */
export function initAudioControls() {
    const micBtn = document.getElementById('mic-btn');
    const speakerBtn = document.getElementById('speaker-btn');

    if (micBtn) {
        micBtn.addEventListener('click', toggleMic);

        // Add long press to leave call
        let pressTimer;
        micBtn.addEventListener('mousedown', () => {
            if (isInCall) {
                pressTimer = setTimeout(() => {
                    leaveCall();
                }, 1000);
            }
        });
        micBtn.addEventListener('mouseup', () => clearTimeout(pressTimer));
        micBtn.addEventListener('mouseleave', () => clearTimeout(pressTimer));
        micBtn.addEventListener('touchstart', () => {
            if (isInCall) {
                pressTimer = setTimeout(() => {
                    leaveCall();
                }, 1000);
            }
        });
        micBtn.addEventListener('touchend', () => clearTimeout(pressTimer));
    }

    if (speakerBtn) {
        speakerBtn.addEventListener('click', toggleSpeaker);
    }

    // Add call button next to audio controls
    addJoinCallButton();

    // Add CSS for call status
    addCallStatusStyles();
}

/**
 * Add a dedicated join/leave call button
 */
function addJoinCallButton() {
    const audioControls = document.getElementById('audio-controls');
    if (!audioControls || document.getElementById('call-btn')) return;

    const callBtn = document.createElement('button');
    callBtn.id = 'call-btn';
    callBtn.innerHTML = `<i class="fas fa-phone"></i>`;
    callBtn.title = 'Join/Leave Audio Call';
    callBtn.style.cssText = `
        padding: 12px;
        background: rgba(76, 175, 80, 0.6);
        border: none;
        border-radius: 50%;
        cursor: pointer;
        margin: 0 8px;
        transition: all 0.3s ease;
        backdrop-filter: blur(10px);
        width: 52px;
        height: 52px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 20px;
    `;

    callBtn.addEventListener('click', () => {
        if (isInCall) {
            leaveCall();
            callBtn.style.background = 'rgba(76, 175, 80, 0.6)';
            callBtn.innerHTML = `<i class="fas fa-phone"></i>`;
            callBtn.title = 'Join Audio Call';
        } else {
            joinCall();
            callBtn.style.background = 'rgba(244, 67, 54, 0.6)';
            callBtn.innerHTML = `<i class="fas fa-phone-slash"></i>`;
            callBtn.title = 'Leave Audio Call';
        }
    });

    // Insert before mic button
    const micBtn = document.getElementById('mic-btn');
    if (micBtn) {
        audioControls.insertBefore(callBtn, micBtn);
    } else {
        audioControls.appendChild(callBtn);
    }
}

/**
 * Add styles for call status indicator
 */
function addCallStatusStyles() {
    if (document.getElementById('call-status-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'call-status-styles';
    styles.textContent = `
        .call-status {
            position: absolute;
            bottom: 90px;
            left: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            padding: 12px 16px;
            opacity: 0;
            transform: translateY(10px);
            transition: all 0.3s ease;
            pointer-events: none;
        }
        
        .call-status.visible {
            opacity: 1;
            transform: translateY(0);
        }
        
        .call-status-content {
            display: flex;
            align-items: center;
            gap: 10px;
            color: white;
            font-size: 14px;
        }
        
        .call-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        
        .call-indicator.active {
            background: #4CAF50;
            box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
        }
        
        .call-indicator.waiting {
            background: #FFC107;
            box-shadow: 0 0 10px rgba(255, 193, 7, 0.5);
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translate(-50%, 20px);
            }
            to {
                opacity: 1;
                transform: translate(-50%, 0);
            }
        }
        
        #audio-controls button.active {
            background: rgba(76, 175, 80, 0.4) !important;
        }
        
        .audio-prompt-content {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .audio-prompt-content button {
            background: white;
            color: #667eea;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s ease;
        }
        
        .audio-prompt-content button:hover {
            transform: scale(1.05);
        }
        
        #call-btn:hover {
            transform: scale(1.1);
        }
        
        #call-btn:active {
            transform: scale(0.95);
        }
    `;
    document.head.appendChild(styles);
}