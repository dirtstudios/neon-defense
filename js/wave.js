// Wave definitions and spawner
const WaveManager = {
    waves: [
        // Wave 1: tutorial — just basics
        [{ type: 'basic', count: 10 }],
        // Wave 2: introduce fast enemies
        [{ type: 'basic', count: 12 }, { type: 'fast', count: 4 }],
        // Wave 3: introduce tanks + swarm
        [{ type: 'basic', count: 8 }, { type: 'fast', count: 5 }, { type: 'tank', count: 2 }, { type: 'swarm', count: 8 }],
        // Wave 4: introduce shields + healer
        [{ type: 'basic', count: 10 }, { type: 'fast', count: 6 }, { type: 'tank', count: 3 }, { type: 'shield', count: 4 }, { type: 'healer', count: 2 }],
        // Wave 5: boss + full mix including stealth
        [{ type: 'basic', count: 12 }, { type: 'fast', count: 8 }, { type: 'tank', count: 5 }, { type: 'shield', count: 3 }, { type: 'swarm', count: 10 }, { type: 'stealth', count: 3 }, { type: 'boss', count: 1 }]
    ],

    currentWave: 0,
    spawnQueue: [],
    spawnTimer: 0,
    spawnInterval: 0.6, // seconds between spawns
    waveActive: false,
    endless: false,
    levelScale: 1, // increases each level
    currentLevel: 1, // stored directly to avoid fragile derivation

    getWaveDef(waveNum) {
        const level = this.currentLevel;

        // Level 1: use base wave definitions as-is
        if (level <= 1) {
            if (waveNum < this.waves.length) return this.waves[waveNum];
        }

        // Level 2+: generate waves based on combined difficulty
        // "effective wave" = total waves completed + current wave within level
        // So level 2 wave 1 = effective wave 6, level 3 wave 1 = effective wave 11, etc
        const effectiveWave = (level - 1) * this.waves.length + waveNum;
        return this._generateWave(effectiveWave, waveNum, level);
    },

    // Generate wave composition based on effective difficulty
    _generateWave(effectiveWave, waveInLevel, level) {
        const s = effectiveWave; // shorthand for scaling

        // Base counts scale with effective wave number
        const wave = [];

        // Basics always present but become less dominant
        const basicCount = Math.max(5, Math.floor(10 + s * 1.5));
        wave.push({ type: 'basic', count: basicCount });

        // Fast enemies from effective wave 2+
        if (s >= 2) wave.push({ type: 'fast', count: Math.floor(4 + s * 1.2) });

        // Swarm from effective wave 3+
        if (s >= 3) wave.push({ type: 'swarm', count: Math.floor(6 + s * 1.5) });

        // Tanks from effective wave 3+
        if (s >= 3) wave.push({ type: 'tank', count: Math.floor(2 + s * 0.8) });

        // Shields from effective wave 4+
        if (s >= 4) wave.push({ type: 'shield', count: Math.floor(2 + s * 0.6) });

        // Healers from effective wave 5+
        if (s >= 5) wave.push({ type: 'healer', count: Math.floor(1 + s * 0.3) });

        // Stealth from effective wave 5+
        if (s >= 5) wave.push({ type: 'stealth', count: Math.floor(2 + s * 0.4) });

        // Bosses on wave 5 of each level, plus scattered in later levels
        if (waveInLevel === 4) {
            wave.push({ type: 'boss', count: Math.max(1, level) });
        } else if (level >= 3 && waveInLevel >= 2) {
            // Mini-boss waves in later levels
            wave.push({ type: 'boss', count: Math.floor((level - 1) / 2) });
        }

        return wave.filter(g => g.count > 0);
    },

    startWave() {
        if (this.waveActive) return;
        const def = this.getWaveDef(this.currentWave);
        this.spawnQueue = [];
        for (const group of def) {
            // Count already scaled by getWaveDef/_generateWave for levels 2+
            const scaledCount = group.count;
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
        this.currentLevel = 1;
    }
};
