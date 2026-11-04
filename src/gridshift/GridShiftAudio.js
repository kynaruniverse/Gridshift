export class GridShiftAudio {
    constructor() {
        this._music = null;
        this._musicLoaded = false;
        this._context = null;
        this._muted = false;
        this._musicStarted = false;
        this._intensity = 0;
        this._master = null;
        this._heat = 1;
        this._duck = 1;
        this._voices = 0;
        this._noise = null;
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
            // Ogg where the browser plays it, otherwise the AAC copy.
            const oggOk = !this._music.canPlayType || this._music.canPlayType('audio/ogg; codecs="vorbis"') !== '';
            this._music.src = oggOk ? './assets/gridshift_theme.ogg' : './assets/gridshift_theme.m4a';
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

    // Heat lifts the music: a little louder and a little faster as the multiplier climbs.
    setHeat(heat) {
        this._heat = Math.max(1, Math.min(8, Number(heat) || 1));
        this._applyMusic();
    }

    setComboIntensity(comboCount) {
        this._intensity = Math.max(0, Math.min(Number(comboCount) || 0, 5));
        this._applyMusic();
    }

    // The single writer of music volume and speed, so call order can never fight.
    _applyMusic() {
        if (!this._music) return;
        const combo = this._intensity >= 4 ? 0.05 : this._intensity >= 2 ? 0.02 : 0;
        this._music.volume = Math.min(1, (0.15 + (this._heat - 1) * 0.012 + combo) * this._duck);
        try { this._music.playbackRate = 1 + (this._heat - 1) * 0.015; } catch (error) { /* unsupported */ }
    }

    // Drops the music 6 dB for a quarter second so a clear cuts through.
    duckMusic() {
        this._duck = 0.5;
        this._applyMusic();
        clearTimeout(this._duckTimer);
        this._duckTimer = setTimeout(() => { this._duck = 1; this._applyMusic(); }, 250);
    }

    playPlacement() { this._playTone(554.37, 0.07, 0.24, 720); }
    playInvalid() { this._playTone(190, 0.11, 0.20, 150); }
    playUndo() { this._playTone(246.94, 0.16, 0.25, 493.88); }
    playButton() { this._playTone(440, 0.05, 0.14, 523.25); }

    playContract() {
        this._playTone(659.25, 0.16, 0.2, 783.99);
        this._playTone(987.77, 0.24, 0.16, 1174.66);
    }

    playClear(comboCount, lines) {
        const index = Math.min(Math.max((Number(comboCount) || 1) - 1, 0), this.CLEAR_NOTES.length - 1);
        const note = this.CLEAR_NOTES[index];
        this._playNoise(0.12, 0.16, 1800, 5200);
        this._playTone(note, 0.20, 0.24, note * 1.01);
        // Each extra line climbs one more step of the scale.
        for (let i = 1; i < Math.min(lines, 4); i++) {
            this._playTone(this.CLEAR_NOTES[Math.min(index + i * 2, 4)], 0.18 + i * 0.03, 0.14);
        }
        this.setComboIntensity(comboCount);
        this.duckMusic();
    }

    playSlide() {
        this._playNoise(0.07, 0.1, 900, 400);
        this._playTone(700, 0.06, 0.12, 480);
    }

    // Riser into an impact.
    playSurge() {
        this._playNoise(0.4, 0.14, 300, 3200);
        this._playTone(200, 0.4, 0.14, 1200);
        this._playTone(120, 0.35, 0.3, 40);
    }

    _playNoise(duration, peakGain, startHz, endHz) {
        if (this._muted) return;
        const context = this._ensureContext();
        if (!context || !this._master || this._voices >= 8) return;
        if (!this._noise) {
            const length = Math.floor(context.sampleRate * 0.5);
            this._noise = context.createBuffer(1, length, context.sampleRate);
            const data = this._noise.getChannelData(0);
            for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
        }
        const now = context.currentTime;
        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();
        source.buffer = this._noise;
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(startHz, now);
        filter.frequency.exponentialRampToValueAtTime(Math.max(40, endHz), now + duration);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peakGain), now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this._master);
        this._voices++;
        source.onended = () => { this._voices--; };
        source.start(now);
        source.stop(now + duration + 0.02);
    }

    // iOS can leave the context "interrupted" after a call or app switch, and resume()
    // only works inside a user gesture, so main.js calls this on every touch release.
    resumeContext() {
        const context = this._context;
        if (!context || this._muted) return;
        if (context.state === 'suspended' || context.state === 'interrupted') context.resume().catch(() => {});
    }

    _playTone(startFrequency, duration, peakGain, endFrequency = startFrequency) {
        if (this._muted) return;
        const context = this._ensureContext();
        if (!context || !this._master || this._voices >= 8) return;
        if (context.state === 'suspended') context.resume().catch(() => {});
        const jitter = 1 + (Math.random() - 0.5) * 0.06; // +/-3% so repeats never sound identical
        startFrequency *= jitter;
        endFrequency *= jitter;
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
        this._voices++;
        oscillator.onended = () => { this._voices--; };
        oscillator.start(now);
        oscillator.stop(now + duration + 0.015);
    }
}
