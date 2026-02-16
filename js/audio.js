// Minimal synth sounds via Web Audio API
const Audio = {
    ctx: null,
    init() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },
    _play(freq, duration, type, vol) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.value = freq;
        gain.gain.value = vol || 0.1;
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    place() { this._play(600, 0.08, 'sine', 0.08); },
    shoot() { this._play(800, 0.04, 'square', 0.03); },
    kill() { this._play(1200, 0.1, 'sine', 0.06); this._play(900, 0.15, 'sine', 0.04); },
    bossKill() {
        this._play(200, 0.3, 'sawtooth', 0.1);
        setTimeout(() => this._play(400, 0.2, 'sine', 0.08), 100);
        setTimeout(() => this._play(800, 0.15, 'sine', 0.06), 200);
    },
    waveStart() { this._play(300, 0.15, 'sine', 0.06); this._play(450, 0.15, 'sine', 0.05); },
    sell() { this._play(400, 0.1, 'triangle', 0.06); },
    noMoney() { this._play(200, 0.15, 'square', 0.05); },
    earlyWave() { this._play(800, 0.1, 'sine', 0.07); this._play(1000, 0.1, 'sine', 0.05); },
    trapPlace() { this._play(500, 0.08, 'triangle', 0.06); },
    trapTrigger() { this._play(300, 0.15, 'sawtooth', 0.07); this._play(600, 0.1, 'sine', 0.05); },
    levelUp() {
        [500, 700, 900, 1100, 1300].forEach((f, i) =>
            setTimeout(() => this._play(f, 0.15, 'sine', 0.07), i * 100));
    },
    gameOver() { this._play(300, 0.3, 'sawtooth', 0.08); this._play(200, 0.4, 'sawtooth', 0.06); },
    win() {
        [600, 800, 1000, 1200].forEach((f, i) =>
            setTimeout(() => this._play(f, 0.2, 'sine', 0.06), i * 120));
    }
};
