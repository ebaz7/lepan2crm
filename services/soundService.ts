/**
 * Sound & Audio Service for application notifications and repeating task alerts.
 */

export const playNotificationSound = () => { 
    try { 
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            const ctx = new AudioContextClass();
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.25);
        }
    } catch (e) { 
        // Audio error silently ignored
    } 
};

export const playTaskAlarmSound = () => {
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            const ctx = new AudioContextClass();
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
            // Elegant 4-tone harmonic arpeggio (C5 -> E5 -> G5 -> C6) with warm triangle waves
            const tones = [
                { freq: 523.25, time: 0, duration: 0.18, gain: 0.22 },
                { freq: 659.25, time: 0.14, duration: 0.18, gain: 0.24 },
                { freq: 783.99, time: 0.28, duration: 0.22, gain: 0.26 },
                { freq: 1046.50, time: 0.44, duration: 0.45, gain: 0.30 }
            ];

            tones.forEach(t => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(t.freq, ctx.currentTime + t.time);
                
                gain.gain.setValueAtTime(t.gain, ctx.currentTime + t.time);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t.time + t.duration);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.start(ctx.currentTime + t.time);
                osc.stop(ctx.currentTime + t.time + t.duration);
            });
        }
    } catch (e) {
        // Audio error silently ignored
    }
};
