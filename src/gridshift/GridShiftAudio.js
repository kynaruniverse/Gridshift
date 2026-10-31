export class GridShiftAudio {
    constructor() {
        this._music = null;
        this._musicLoaded = false;
        this._context = null;
        this._muted = false;
        this._musicStarted = false;
        this._intensity = 0;
        this._master = null;
        this.CLEAR_NOTES = [261.63, 329.63, 392.00, 493.88, 523.25];
    }

    init(parentElement) {
        if (this._music) return;
        this._music = document.createElement('audio');
        this._music.loop = true;
        this._music.preload = 'none';
        this._music.volume = 0.15;
        this._music.setAttribute('aria-hidden', 'true');
        if (parentElement) parentElement.appendChild(this._music);
    }

    _ensureContext() {
        if (this._context) return this._context;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;
        this._context = new AudioContextClass();
        this._master = this._context.createGain();
        this._master.gain.value = this._muted ? 0 : 0.18;
        this._master.connect(this._context.destination);
        return this._context;
    }

    unlockAndPlay() {
        if (this._muted) return;
        const context = this._ensureContext();
        if (context?.state === 'suspended') context.resume().catch(() => {});
        if (!this._music) return;
        if (!this._musicLoaded) {
            this._music.src = './assets/gridshift_theme.ogg';
            this._music.load();
            this._musicLoaded = true;
        }
        this._music.muted = false;
        if (this._music.paused) {
            this._music.play().then(() => { this._musicStarted = true; }).catch(() => {});
        }
    }

    pauseMusic() {
        if (this._music) this._music.pause();
    }

    setMuted(value) {
        this._muted = Boolean(value);
        if (this._music) this._music.muted = this._muted;
        if (this._master) this._master.gain.value = this._muted ? 0 : 0.18;
        if (!this._muted && this._musicStarted) this.unlockAndPlay();
    }

    setComboIntensity(comboCount) {
        this._intensity = Math.max(0, Math.min(Number(comboCount) || 0, 5));
        if (!this._music) return;
        const target = this._intensity >= 4 ? 0.23 : this._intensity >= 2 ? 0.19 : 0.15;
        this._music.volume = target;
    }

    playPlacement() { this._playTone(554.37, 0.07, 0.24, 720); }
    playInvalid() { this._playTone(190, 0.11, 0.20, 150); }
    playUndo() { this._playTone(246.94, 0.16, 0.25, 493.88); }
    playButton() { this._playTone(440, 0.05, 0.14, 523.25); }

    playSpecial(specialId) {
        if (specialId === 1) {
            this._playTone(130.81, 0.18, 0.24, 65.41);
            this._playTone(392, 0.12, 0.14, 523.25);
        } else if (specialId === 2) {
            this._playTone(783.99, 0.15, 0.18, 1046.5);
        } else if (specialId === 3) {
            this._playTone(659.25, 0.19, 0.18, 1046.5);
        }
    }

    playClear(comboCount, lines) {
        const index = Math.min(Math.max((Number(comboCount) || 1) - 1, 0), this.CLEAR_NOTES.length - 1);
        const note = this.CLEAR_NOTES[index];
        this._playTone(note, 0.20, 0.24, note * 1.01);
        if (lines >= 2) this._playTone(this.CLEAR_NOTES[Math.min(index + 2, 4)], 0.23, 0.15);
        this.setComboIntensity(comboCount);
    }

    _playTone(startFrequency, duration, peakGain, endFrequency = startFrequency) {
        if (this._muted) return;
        const context = this._ensureContext();
        if (!context || !this._master) return;
        if (context.state === 'suspended') context.resume().catch(() => {});
        const now = context.currentTime;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(startFrequency, now);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peakGain), now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        oscillator.connect(gain);
        gain.connect(this._master);
        oscillator.start(now);
        oscillator.stop(now + duration + 0.015);
    }
}
