// Wave definitions and spawner
const WaveManager = {
    waves: [
        // Wave 1: tutorial
        [{ type: 'basic', count: 10 }],
        // Wave 2
        [{ type: 'basic', count: 15 }, { type: 'fast', count: 3 }],
        // Wave 3
        [{ type: 'basic', count: 10 }, { type: 'fast', count: 5 }, { type: 'tank', count: 2 }],
        // Wave 4
        [{ type: 'basic', count: 15 }, { type: 'fast', count: 8 }, { type: 'tank', count: 5 }],
        // Wave 5: boss
        [{ type: 'basic', count: 20 }, { type: 'fast', count: 10 }, { type: 'tank', count: 8 }, { type: 'boss', count: 1 }]
    ],

    currentWave: 0,
    spawnQueue: [],
    spawnTimer: 0,
    spawnInterval: 0.6, // seconds between spawns
    waveActive: false,
    endless: false,
    levelScale: 1, // increases each level

    getWaveDef(waveNum) {
        if (waveNum < this.waves.length) {
            return this.waves[waveNum];
        }
        // Endless mode: scale previous pattern
        const scale = 1 + (waveNum - 4) * 0.2;
        return [
            { type: 'basic', count: Math.floor(20 * scale) },
            { type: 'fast', count: Math.floor(10 * scale) },
            { type: 'tank', count: Math.floor(8 * scale) },
            { type: 'boss', count: Math.floor(1 + (waveNum - 4) * 0.5) }
        ];
    },

    startWave() {
        if (this.waveActive) return;
        const def = this.getWaveDef(this.currentWave);
        this.spawnQueue = [];
        for (const group of def) {
            const scaledCount = Math.floor(group.count * this.levelScale);
            for (let i = 0; i < scaledCount; i++) {
                this.spawnQueue.push(group.type);
            }
        }
        // Shuffle slightly for variety (keep bosses last)
        const bosses = this.spawnQueue.filter(t => t === 'boss');
        const others = this.spawnQueue.filter(t => t !== 'boss');
        // Simple shuffle of non-boss enemies
        for (let i = others.length - 1; i > 0; i--) {
            const j = Utils.randInt(0, i);
            [others[i], others[j]] = [others[j], others[i]];
        }
        this.spawnQueue = [...others, ...bosses];
        this.spawnTimer = 0;
        this.waveActive = true;
        if (this.currentWave >= this.waves.length) this.endless = true;
    },

    update(dt, enemies, speedMult) {
        if (!this.waveActive || this.spawnQueue.length === 0) return;

        this.spawnTimer -= dt * speedMult;
        if (this.spawnTimer <= 0 && this.spawnQueue.length > 0) {
            const type = this.spawnQueue.shift();
            enemies.push(createEnemy(type, this.currentWave));
            this.spawnTimer = this.spawnInterval;
        }
    },

    isWaveComplete(enemies) {
        return this.waveActive && this.spawnQueue.length === 0 &&
            enemies.every(e => !e.alive);
    },

    getPreviewText() {
        const def = this.getWaveDef(this.currentWave);
        return def.map(g => `${g.count} ${g.type}`).join(' + ');
    },

    reset() {
        this.currentWave = 0;
        this.spawnQueue = [];
        this.spawnTimer = 0;
        this.waveActive = false;
        this.endless = false;
        this.levelScale = 1;
    }
};
