
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
 * Play a single synthesized tone.
 * Reuses one shared AudioContext - browsers cap the number of live contexts
 * (~6), so creating one per alert eventually silences the app permanently.
 *
 * @param {Object} options
 * @param {number} options.frequency  Start frequency in Hz
 * @param {number} [options.endFrequency] Optional ramp target in Hz
 * @param {string} [options.type]     Oscillator type (sine, square, ...)
 * @param {number} [options.duration] Seconds
 * @param {number} [options.volume]   Peak gain (0-1)
 */
export function playTone({ frequency, endFrequency, type = 'sine', duration = 0.15, volume = 0.2 }) {
    try {
        const ctx = initAudioContext();
        const now = ctx.currentTime;

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, now);
        if (endFrequency) {
            oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
        }

        gainNode.gain.setValueAtTime(volume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

        oscillator.start(now);
        oscillator.stop(now + duration);
    } catch (error) {
        console.warn('[Sound] Could not play tone:', error);
    }
}

/**
 * Play notification beep
 */
export function playNotificationBeep() {
    playTone({ frequency: 800, endFrequency: 400, type: 'sine', duration: 0.15, volume: 0.2 });
}

/**
 * Play success sound (C5-E5-G5 arpeggio)
 */
export function playSuccessSound() {
    try {
        const ctx = initAudioContext();
        const now = ctx.currentTime;

        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        notes.forEach((frequency, index) => {
            const start = now + index * 0.1;

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, start);

            gainNode.gain.setValueAtTime(0.2, start);
            gainNode.gain.exponentialRampToValueAtTime(0.01, start + 0.3);

            oscillator.start(start);
            oscillator.stop(start + 0.3);
        });
    } catch (error) {
        console.warn('[Sound] Could not play success sound:', error);
    }
}

/**
 * Play error sound
 */
export function playErrorSound() {
    playTone({ frequency: 150, type: 'square', duration: 0.3, volume: 0.15 });
}

/**
 * Play call ringing sound (dual-tone ring, two pulses)
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

            const start = now + i * 0.8;
            gain.gain.setValueAtTime(0.1, start);
            gain.gain.setValueAtTime(0, start + 0.4);

            osc1.start(start);
            osc1.stop(start + 0.4);
            osc2.start(start);
            osc2.stop(start + 0.4);
        }
    } catch (error) {
        console.warn('[Sound] Could not play call ring:', error);
    }
}
