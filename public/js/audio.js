import { WEBRTC_CONFIGURATION } from './config.js';
import { socket, emitJoinAudio, emitLeaveAudio } from './socket.js';
import { addNotification } from './notification.js';
import { playCallRing } from './sounds.js';

// Audio state management
let localStream = null;
let audioEnabled = false;
let speakerEnabled = true;
let isInCall = false;
// Set when a long-press leave fires, so the trailing click is ignored once.
let suppressNextMicClick = false;

// Store peer connections and audio elements
export const peerConnections = {};
const remoteAudioElements = {};
const pendingCandidates = {};

// Create UI elements for call status
let callStatusElement = null;

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

    // Monitor ICE connection state.
    // NOTE: 'disconnected' is often transient (network blip) and usually
    // recovers on its own - tearing down the call on it was far too eager.
    pc.oniceconnectionstatechange = () => {
        console.log(`ICE state for ${peerId}: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
            handlePeerDisconnected(peerId);
        } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            addNotification('Audio connected with a peer');
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
 * Perfect negotiation support: when both peers create offers simultaneously
 * (glare), the "polite" peer yields by rolling back and accepting the remote
 * offer; the impolite peer ignores the incoming offer and lets its own
 * proceed. setRemoteDescription(offer) while in 'have-local-offer' performs
 * the implicit rollback per the WebRTC spec.
 */
function isPolitePeer(peerId) {
    return (socket.id || '') < String(peerId);
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
 * Add local tracks to a peer connection (skipping already-attached ones)
 */
function attachLocalTracks(pc) {
    if (!localStream || !audioEnabled) return;
    localStream.getTracks().forEach(track => {
        const alreadyAttached = pc.getSenders().some(sender => sender.track === track);
        if (!alreadyAttached) {
            pc.addTrack(track, localStream);
        }
    });
}

/**
 * Process ICE candidates that arrived before the remote description was set
 */
async function processPendingCandidates(pc, peerId) {
    const queued = pendingCandidates[peerId];
    if (!queued || queued.length === 0) return;

    for (const candidate of queued) {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
            console.error('Error adding queued ICE candidate:', e);
        }
    }
    pendingCandidates[peerId] = [];
}

/**
 * Handle incoming offer
 */
export async function handleOffer(peerId, description) {
    console.log(`Handling offer from ${peerId}`);

    let pc = peerConnections[peerId];
    const isNewConnection = !pc;

    // Glare: we both created offers. The polite peer rolls back and accepts;
    // the impolite peer keeps its own offer and drops this one.
    if (pc && pc.signalingState === 'have-local-offer' && !isPolitePeer(peerId)) {
        console.warn(`Offer glare with ${peerId}; ignoring as impolite peer`);
        return;
    }

    if (isNewConnection) {
        playCallRing(); // Ring only for genuinely new incoming calls
        pc = createPeerConnection(peerId);
    }

    try {
        await pc.setRemoteDescription(new RTCSessionDescription(description));
        attachLocalTracks(pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('answer', {
            target: peerId,
            description: pc.localDescription
        });

        await processPendingCandidates(pc, peerId);
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
        await processPendingCandidates(pc, peerId);
    } catch (error) {
        console.error("Error handling answer:", error);
    }
}

/**
 * Handle incoming ICE candidate
 */
export async function handleIceCandidate(peerId, candidate) {
    if (!peerId || !candidate) return;

    const pc = peerConnections[peerId];

    if (!pc || !pc.remoteDescription) {
        // Queue the candidate for later
        if (!pendingCandidates[peerId]) {
            pendingCandidates[peerId] = [];
        }
        // Bound the queue so a misbehaving peer cannot grow it forever
        if (pendingCandidates[peerId].length < 100) {
            pendingCandidates[peerId].push(candidate);
        }
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
    attachLocalTracks(pc);

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
        closePeerConnection(peerId);
        addNotification('Failed to initiate call');
    }
}

/**
 * Join the audio call.
 * @returns {Promise<boolean>} true when the call was joined successfully
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
        return true;

    } catch (err) {
        console.error('Error accessing microphone:', err);
        localStream = null;

        if (err.name === 'NotAllowedError') {
            addNotification('Microphone access denied. Please enable it in browser settings.');
        } else if (err.name === 'NotFoundError') {
            addNotification('No microphone found. Please connect one and try again.');
        } else {
            addNotification('Failed to access microphone.');
        }
        updateCallUI();
        return false;
    }
}

/**
 * Leave the audio call
 */
function leaveCall() {
    if (!isInCall && !localStream) return;

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
    // A long-press just triggered leaveCall; the synthetic click that follows
    // must not immediately rejoin the call.
    if (suppressNextMicClick) {
        suppressNextMicClick = false;
        return;
    }

    if (!isInCall) {
        // Not in call, join call
        joinCall();
    } else if (localStream) {
        // Toggle mute (stay in the call)
        const mute = audioEnabled;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !mute;
        });
        audioEnabled = !mute;
        updateMicButton(audioEnabled);
        addNotification(audioEnabled ? 'Microphone unmuted' : 'Microphone muted');
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
 * Toggle speaker mute
 */
function toggleSpeaker() {
    speakerEnabled = !speakerEnabled;

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
 * Sync the join/leave call button with the actual call state.
 * The old code set button colors optimistically BEFORE getUserMedia
 * resolved, leaving a red "leave" button after mic-denial failures.
 */
function updateCallButton() {
    const callBtn = document.getElementById('call-btn');
    if (!callBtn) return;

    if (isInCall) {
        callBtn.style.background = 'rgba(244, 67, 54, 0.6)'; // Red
        callBtn.innerHTML = `<i class="fas fa-phone-slash"></i>`;
        callBtn.title = 'Leave Audio Call';
    } else {
        callBtn.style.background = 'rgba(76, 175, 80, 0.6)'; // Green
        callBtn.innerHTML = `<i class="fas fa-phone"></i>`;
        callBtn.title = 'Join/Leave Audio Call';
    }
}

/**
 * Create and update call status UI
 */
function updateCallUI() {
    const audioControls = document.getElementById('audio-controls');
    if (!audioControls) return;

    updateCallButton();

    // Create or update call status element
    if (!callStatusElement) {
        callStatusElement = document.createElement('div');
        callStatusElement.id = 'call-status';
        callStatusElement.className = 'call-status';
        audioControls.parentNode.insertBefore(callStatusElement, audioControls);
    }

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

export function handleUserConnectedToAudio(peerId, userName) {
    if (isInCall && localStream && !peerConnections[peerId]) {
        // Initiate call to the new peer
        initiateCall(peerId);
    }
    updateCallUI();
}

export function handleUserDisconnectedFromAudio(peerId) {
    closePeerConnection(peerId);
    updateCallUI();
}

/**
 * Get list of current audio peers and connect to them
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

        // Long press (1s) leaves the call. The click event that fires on
        // release would otherwise toggle right back into the call, so it is
        // suppressed once via suppressNextMicClick.
        let pressTimer;
        micBtn.addEventListener('mousedown', startPress);
        micBtn.addEventListener('mouseup', cancelPress);
        micBtn.addEventListener('mouseleave', cancelPress);
        micBtn.addEventListener('touchstart', startPress, { passive: true });
        micBtn.addEventListener('touchend', cancelPress);
        micBtn.addEventListener('touchcancel', cancelPress);

        function startPress() {
            if (isInCall) {
                pressTimer = setTimeout(() => {
                    suppressNextMicClick = true;
                    leaveCall();
                }, 1000);
            }
        }
        function cancelPress() {
            clearTimeout(pressTimer);
        }
    }

    if (speakerBtn) {
        speakerBtn.addEventListener('click', toggleSpeaker);
    }

    // Listen for incoming call requests
    socket.on('request-join-call', (data) => {
        console.log('Received call request:', data);
        addNotification(`📞 ${data.senderName} is inviting everyone to join the call!`);
        playCallRing();

        // Optional: Show a more prominent modal/alert if user isn't in call
        if (!isInCall) {
            // Simple visual pulse on the call button
            const callBtn = document.getElementById('call-btn');
            if (callBtn) {
                callBtn.classList.add('pulse-animation');
                callBtn.style.animation = 'pulse 1s infinite';
                setTimeout(() => {
                    callBtn.style.animation = '';
                }, 10000);
            }
        }
    });

    // Add call button next to audio controls
    addJoinCallButton();

    // Add CSS for call status
    addCallStatusStyles();
}

/**
 * Add join/leave and request call buttons
 */
function addJoinCallButton() {
    const audioControls = document.getElementById('audio-controls');
    if (!audioControls || document.getElementById('call-btn')) return;

    // 1. Request All Button
    const requestBtn = document.createElement('button');
    requestBtn.id = 'request-call-btn';
    requestBtn.innerHTML = `<i class="fas fa-bullhorn"></i>`; // Icon for "announce/call all"
    requestBtn.title = 'Request everyone to join call';
    requestBtn.style.cssText = `
        padding: 12px;
        background: rgba(33, 150, 243, 0.6); /* Blue */
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
        font-size: 18px;
    `;

    requestBtn.addEventListener('click', () => {
        // Confirmation
        if (confirm('📢 Send a request for everyone in the room to join the call?')) {
            socket.emit('request-join-call');
            addNotification('📡 Request sent to all users');

            // Visual feedback
            requestBtn.style.transform = 'scale(0.9)';
            setTimeout(() => requestBtn.style.transform = 'scale(1)', 200);
        }
    });


    // 2. Join/Leave Button
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

    callBtn.addEventListener('click', async () => {
        if (isInCall) {
            leaveCall();
        } else {
            await joinCall();
        }
        updateCallButton();
    });

    // Insert before mic button
    const micBtn = document.getElementById('mic-btn');
    if (micBtn) {
        audioControls.insertBefore(requestBtn, micBtn);
        audioControls.insertBefore(callBtn, micBtn);
    } else {
        audioControls.appendChild(requestBtn);
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
