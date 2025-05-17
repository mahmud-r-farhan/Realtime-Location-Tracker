import { WEBRTC_CONFIGURATION } from './config.js';
import { socket, emitJoinAudio, emitLeaveAudio } from './socket.js';

let localStream;
let audioEnabled = false;
let speakerEnabled = true;
export const peerConnections = {};

export function createPeerConnection(peerId) {
    const pc = new RTCPeerConnection(WEBRTC_CONFIGURATION);
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { target: peerId, candidate: event.candidate });
        }
    };
    pc.ontrack = (event) => {
        if (speakerEnabled && event.streams && event.streams[0]) {
            const audio = new Audio();
            audio.srcObject = event.streams[0];
            audio.play().catch(e => console.error("Error playing audio:", e));
        }
    };
    pc.oniceconnectionstatechange = () => {
        if (['failed', 'disconnected', 'closed'].includes(pc.iceConnectionState)) {
            console.log(`ICE state for ${peerId}: ${pc.iceConnectionState}`);
        }
    };
    peerConnections[peerId] = pc;
    return pc;
}

export async function handleOffer(peerId, description) {
    const pc = createPeerConnection(peerId);
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(description));
        if (localStream && audioEnabled) {
            localStream.getTracks().forEach(track => {
                if (!pc.getSenders().find(sender => sender.track === track)) {
                    pc.addTrack(track, localStream);
                }
            });
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { target: peerId, description: answer });
    } catch (error) {
        console.error("Error handling offer:", error);
    }
}

export async function handleAnswer(peerId, description) {
    if (peerConnections[peerId]) {
        try {
            await peerConnections[peerId].setRemoteDescription(new RTCSessionDescription(description));
        } catch (error) {
            console.error("Error handling answer:", error);
        }
    }
}

export async function handleIceCandidate(peerId, candidate) {
    if (peerConnections[peerId]) {
        try {
            await peerConnections[peerId].addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
            console.error('Error adding ICE candidate:', e);
        }
    }
}

export function closePeerConnection(peerId) {
    if (peerConnections[peerId]) {
        peerConnections[peerId].close();
        delete peerConnections[peerId];
    }
}

export function initAudioControls() {
    document.getElementById('mic-btn').addEventListener('click', async () => {
        try {
            if (!audioEnabled) {
                localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioEnabled = true;
                document.querySelector('#mic-btn img').src = '/assets/microphone-on-icon.png';
                emitJoinAudio();
                Object.values(peerConnections).forEach(pc => {
                    localStream.getTracks().forEach(track => {
                        if (!pc.getSenders().find(sender => sender.track === track)) {
                            pc.addTrack(track, localStream);
                        }
                    });
                });
            } else {
                localStream.getTracks().forEach(track => track.stop());
                localStream = null;
                audioEnabled = false;
                document.querySelector('#mic-btn img').src = '/assets/microphone-muted-icon.png';
                emitLeaveAudio();
            }
        } catch (err) {
            console.error('Error accessing microphone:', err);
            addNotification('Failed to access microphone.');
        }
    });

    document.getElementById('speaker-btn').addEventListener('click', () => {
        speakerEnabled = !speakerEnabled;
        document.querySelector('#speaker-btn img').src = speakerEnabled ? '/assets/speaker-on-icon.png' : '/assets/speaker-off-icon.png';
        // Note: Removed 'toggle-speaker' emit as it's not supported by server
    });
}