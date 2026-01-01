
let audioContext = null;

function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    return audioContext;
}

/**
 * Play notification beep
 */
export function playNotificationBeep() {
    try {
        const ctx = initAudioContext();
        const now = ctx.currentTime;

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, now);
        oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.15);

        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        oscillator.start(now);
        oscillator.stop(now + 0.15);

        console.log('[Sound] Notification beep played');
    } catch (error) {
        console.warn('[Sound] Could not play notification beep:', error);
    }
}

/**
 * Play success sound
 */
export function playSuccessSound() {
    try {
        const ctx = initAudioContext();
        const now = ctx.currentTime;

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, now); // C5
        oscillator.frequency.setValueAtTime(659.25, now + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, now + 0.2); // G5

        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        oscillator.start(now);
        oscillator.stop(now + 0.3);
    } catch (error) {
        console.warn('[Sound] Could not play success sound:', error);
    }
}

/**
 * Play error sound
 */
export function playErrorSound() {
    try {
        const ctx = initAudioContext();
        const now = ctx.currentTime;

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(150, now);

        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        oscillator.start(now);
        oscillator.stop(now + 0.3);
    } catch (error) {
        console.warn('[Sound] Could not play error sound:', error);
    }
}

/**
 * Play call ringing sound
 */
export function playCallRing() {
    try {
        const ctx = initAudioContext();
        const now = ctx.currentTime;

        for (let i = 0; i < 2; i++) {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.value = 440; // A4
            osc2.frequency.value = 480;

            gain.gain.setValueAtTime(0.1, now + i * 0.8);
            gain.gain.setValueAtTime(0, now + i * 0.8 + 0.4);

            osc1.start(now + i * 0.8);
            osc1.stop(now + i * 0.8 + 0.4);
            osc2.start(now + i * 0.8);
            osc2.stop(now + i * 0.8 + 0.4);
        }
    } catch (error) {
        console.warn('[Sound] Could not play call ring:', error);
    }
}
