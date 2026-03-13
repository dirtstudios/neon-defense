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
    earlyAdvanced: false, // true if wave was advanced by early-wave (skip auto-advance on complete)
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

    _buildSpawnList(waveNum) {
        const def = this.getWaveDef(waveNum);
        const queue = [];
        for (const group of def) {
            for (let i = 0; i < group.count; i++) {
                if (group.type === 'boss') {
                    const bossTypes = ['boss', 'broodBoss'];
                    if (this.currentLevel >= 3) bossTypes.push('warBoss');
                    if (this.currentLevel >= 4) bossTypes.push('voidBoss');
                    if (this.currentLevel >= 5) bossTypes.push('healerBoss');
                    if (this.currentLevel >= 6) bossTypes.push('splitBoss');
                    queue.push(bossTypes[Utils.randInt(0, bossTypes.length - 1)]);
                } else {
                    queue.push(group.type);
                }
            }
        }
        // Shuffle non-boss enemies, keep bosses last
        const bosses = queue.filter(t => t === 'boss' || t === 'broodBoss' || t === 'warBoss' || t === 'voidBoss' || t === 'healerBoss' || t === 'splitBoss');
        const others = queue.filter(t => t !== 'boss' && t !== 'broodBoss' && t !== 'warBoss' && t !== 'voidBoss' && t !== 'healerBoss' && t !== 'splitBoss');
        for (let i = others.length - 1; i > 0; i--) {
            const j = Utils.randInt(0, i);
            [others[i], others[j]] = [others[j], others[i]];
        }
        return [...others, ...bosses];
    },

    startWave() {
        if (this.waveActive) return;
        this.spawnQueue = this._buildSpawnList(this.currentWave);
        this.spawnTimer = 0;
        this.waveActive = true;
        if (this.currentWave >= this.waves.length) this.endless = true;
    },

    // Append next wave's enemies onto the existing spawn queue (wave overlap)
    appendWave() {
        const newEnemies = this._buildSpawnList(this.currentWave);
        // Queue the new wave immediately, ahead of leftover spawns, so overlap feels real.
        this.spawnQueue = [...newEnemies, ...this.spawnQueue];
        this.spawnTimer = 0;
        this.waveActive = true;
        this.earlyAdvanced = true;
        if (this.currentWave >= this.waves.length) this.endless = true;
    },

    update(dt, enemies, speedMult, overlapDepth = 0) {
        if (!this.waveActive || this.spawnQueue.length === 0) return;

        const spawnRateMult = 1 + Math.max(0, overlapDepth) * 1.5;
        this.spawnTimer -= dt * speedMult * spawnRateMult;

        let spawnsThisTick = 0;
        const spawnCap = Math.min(10, 2 + Math.max(0, overlapDepth) * 2);
        while (this.spawnTimer <= 0 && this.spawnQueue.length > 0 && spawnsThisTick < spawnCap) {
            const type = this.spawnQueue.shift();
            enemies.push(createEnemy(type, this.currentWave));
            this.spawnTimer += this.spawnInterval;
            spawnsThisTick++;
        }

        if (this.spawnQueue.length === 0) {
            this.spawnTimer = 0;
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

    // Check if current wave will have a boss
    hasBoss() {
        const def = this.getWaveDef(this.currentWave);
        return def.some(g => g.type === 'boss' || g.type === 'broodBoss' || g.type === 'warBoss' || g.type === 'voidBoss' || g.type === 'healerBoss' || g.type === 'splitBoss');
    },

    // Get boss count for current wave
    getBossCount() {
        const def = this.getWaveDef(this.currentWave);
        let count = 0;
        for (const g of def) {
            if (g.type === 'boss' || g.type === 'broodBoss' || g.type === 'warBoss' || g.type === 'voidBoss' || g.type === 'healerBoss' || g.type === 'splitBoss') {
                count += g.count;
            }
        }
        return count;
    },

    reset() {
        this.currentWave = 0;
        this.spawnQueue = [];
        this.spawnTimer = 0;
        this.waveActive = false;
        this.endless = false;
        this.earlyAdvanced = false;
        this.levelScale = 1;
        this.currentLevel = 1;
    }
};
