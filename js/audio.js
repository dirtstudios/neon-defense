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
    
    // Tower-specific shoot sounds
    shoot(type) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        
        // Different sound per tower type
        const sounds = {
            blaster: () => { // Quick pew
                this._play(900, 0.04, 'square', 0.025);
            },
            sniper: () => { // Deep boom
                this._play(180, 0.15, 'sine', 0.06);
                this._play(80, 0.2, 'sine', 0.04);
            },
            aoe: () => { // Whoosh explosion
                this._play(400, 0.08, 'sawtooth', 0.03);
                this._play(200, 0.12, 'sine', 0.04);
            },
            boat: () => { // Water splash
                this._play(600, 0.06, 'sine', 0.04);
                this._play(300, 0.08, 'sine', 0.02);
            }
        };
        
        const fn = sounds[type] || sounds.blaster;
        fn();
    },
    
    kill() { this._play(1200, 0.1, 'sine', 0.06); this._play(900, 0.15, 'sine', 0.04); },
    bossAlert() {
        this._play(180, 0.18, 'sawtooth', 0.08);
        setTimeout(() => this._play(140, 0.18, 'sawtooth', 0.07), 120);
        setTimeout(() => this._play(220, 0.22, 'square', 0.05), 240);
    },
    bossKill() {
        this._play(200, 0.3, 'sawtooth', 0.1);
        setTimeout(() => this._play(400, 0.2, 'sine', 0.08), 100);
        setTimeout(() => this._play(800, 0.15, 'sine', 0.06), 200);
    },
    waveStart() { 
        // Dramatic wave stinger
        this._play(200, 0.1, 'sine', 0.06);
        this._play(350, 0.1, 'sine', 0.05);
        this._play(550, 0.15, 'sine', 0.04);
    },
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
    },
    powerup() {
        // Magical chime for powerup pickup
        this._play(880, 0.1, 'sine', 0.08);
        setTimeout(() => this._play(1100, 0.1, 'sine', 0.07), 80);
        setTimeout(() => this._play(1320, 0.15, 'sine', 0.06), 160);
    }
};
