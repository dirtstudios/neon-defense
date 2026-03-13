// Main game controller
const game = {
    canvas: null,
    ctx: null,
    state: 'menu', // menu, playing, gameover
    gold: 200,
    lives: 20,
    score: 0,
    highScore: parseInt(localStorage.getItem('neonDefenseHighScore') || '0'),
    speed: 1,
    selectedTower: null,
    selectedPlacedTower: null,
    towers: [],
    enemies: [],
    shakeTimer: 0,
    goldFlashTimer: 0,
    waveCompleteTimer: 0,
    shakeIntensity: 0,
    lastTime: 0,
    mouseX: 0,
    mouseY: 0,
    traps: [],
    _floatingTexts: [],
    _lightningBolts: [],
    _powerups: [],
    _activePowerups: { damage: 0, speed: 0, goldMult: 1 },
    level: 1,
    
    // FPS tracking and targeting
    fpsCounter: 0,
    fpsTimer: 0,
    currentFPS: 60,
    targetFPS: 60,
    frameAccumulator: 0,
    fixedTimeStep: 1000 / 60, // 16.67ms
    showFPS: false,

    mapInfo: null,
    bossBannerTimer: 0,
    bossBannerText: '',
    perkChoiceActive: false,
    perkOptions: [],
    perkHistory: [],
    achievements: JSON.parse(localStorage.getItem('neonDefenseAchievements') || '[]'),
    stars: JSON.parse(localStorage.getItem('neonDefenseStars') || '{}'),
    _achievementDefinitions: [
        { id: 'first_blood', name: 'First Blood', desc: 'Kill your first enemy', icon: '🗡️' },
        { id: 'tower_killer', name: 'Tower Killer', desc: 'Kill 100 enemies', icon: '🏰' },
        { id: 'slaughter', name: 'Slaughter', desc: 'Kill 500 enemies', icon: '💀' },
        { id: 'boss_slayer', name: 'Boss Slayer', desc: 'Defeat your first boss', icon: '👹' },
        { id: 'boss_hunter', name: 'Boss Hunter', desc: 'Defeat 10 bosses', icon: '🎯' },
        { id: 'wave_5', name: 'Rising Tide', desc: 'Complete wave 5', icon: '🌊' },
        { id: 'wave_10', name: 'Unstoppable', desc: 'Complete wave 10', icon: '🚀' },
        { id: 'wave_25', name: 'Legend', desc: 'Complete wave 25', icon: '👑' },
        { id: 'perfect_wave', name: 'Perfect Defense', desc: 'Complete a wave with no lives lost', icon: '🛡️' },
        { id: 'banker', name: 'Banker', desc: 'Accumulate 1000 gold', icon: '💰' },
        { id: 'rich', name: 'Tycoon', desc: 'Accumulate 5000 gold', icon: '🤑' },
        { id: 'crit_master', name: 'Critical Master', desc: 'Land 50 critical hits', icon: '⚡' }
    ],
    perkState: {
        globalDamageMult: 1,
        blasterDamageMult: 1,
        sniperDamageMult: 1,
        aoeDamageMult: 1,
        boatDamageMult: 1,
        trapDamageMult: 1,
        sentinelBonusCount: 0,
        sentinelHpMult: 1,
        economyBonusGold: 0,
        waveBonusMult: 1,
        healAfterLevel: 0,
        sellValueMult: 1,
        fireRateMult: 1,
        // New perk states
        goldBonusChance: 0,
        lifeOnKill: false,
        chainLightning: false,
        critChance: 0,
        vampirism: 0,
        frostChance: 0,
        multishotChance: 0,
        berserker: false
    },
    enemySpatial: new Map(),
    enemyCellSize: 64,
    
    getCanvasPoint(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    },

    rebuildEnemySpatial() {
        this.enemySpatial.clear();
        const cs = this.enemyCellSize;
        for (const e of this.enemies) {
            if (!e.alive) continue;
            const cx = Math.floor(e.x / cs);
            const cy = Math.floor(e.y / cs);
            const key = `${cx},${cy}`;
            let bucket = this.enemySpatial.get(key);
            if (!bucket) {
                bucket = [];
                this.enemySpatial.set(key, bucket);
            }
            bucket.push(e);
        }
    },

    getNearbyEnemies(x, y, radius) {
        const cs = this.enemyCellSize;
        const minX = Math.floor((x - radius) / cs);
        const maxX = Math.floor((x + radius) / cs);
        const minY = Math.floor((y - radius) / cs);
        const maxY = Math.floor((y + radius) / cs);
        const out = [];
        for (let cy = minY; cy <= maxY; cy++) {
            for (let cx = minX; cx <= maxX; cx++) {
                const bucket = this.enemySpatial.get(`${cx},${cy}`);
                if (bucket) out.push(...bucket);
            }
        }
        return out;
    },

    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        ParticlePool.init();
        ProjectilePool.init();
        
        // Load sprites, then generate map
        Sprites.load(() => {
            console.log('Sprites loaded:', Sprites.loaded);
            Terrain._cacheDirty = true; // Re-render terrain with sprites
        });
        
        // Generate first map
        this.mapInfo = Path.generate();
        Terrain.generate(this.mapInfo.seed);
        this._updateMapDisplay();

        // Pointer/touch-safe input mapping
        this.canvas.addEventListener('pointermove', (e) => {
            const pos = this.getCanvasPoint(e);
            this.mouseX = pos.x;
            this.mouseY = pos.y;
        });

        this.canvas.addEventListener('pointerdown', (e) => {
            const pos = this.getCanvasPoint(e);
            const mx = pos.x;
            const my = pos.y;
            if (this.levelTransition) {
                this._confirmLevelAdvance();
                return;
            }
            if (this.perkChoiceActive) {
                this.handlePerkClick(mx, my);
                return;
            }
            if (this.state !== 'playing') return;
            this.handleClick(mx, my);
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            // FPS toggle works in any state
            if (e.key === 'f' || e.key === 'F') {
                this.toggleFPSDisplay();
                return;
            }
            
            if (this.levelTransition && (e.key === ' ' || e.key === 'Enter')) {
                e.preventDefault();
                this._confirmLevelAdvance();
                return;
            }
            if (this.perkChoiceActive) {
                if (e.key === '1') this.choosePerk(0);
                else if (e.key === '2') this.choosePerk(1);
                else if (e.key === '3') this.choosePerk(2);
                return;
            }
            if (this.state !== 'playing') return;
            if (e.key === '1') this.selectTower('blaster');
            else if (e.key === '2') this.selectTower('sniper');
            else if (e.key === '3') this.selectTower('aoe');
            else if (e.key === '4') this.selectTower('boat');
            else if (e.key === '5') this.selectTower('mine');
            else if (e.key === '6') this.selectTower('poison');
            else if (e.key === '7') this.selectTower('ice');
            else if (e.key === '8') this.selectTower('sentinel');
            else if (e.key === 's' || e.key === 'S') this.selectTower('sell');
            else if (e.key === ' ') { e.preventDefault(); this.startWave(); }
            else if (e.key === 'p' || e.key === 'P') this.togglePause();
            else if (e.key === 'u' || e.key === 'U') {
                // Upgrade selected tower
                if (this.selectedPlacedTower) {
                    const t = this.selectedPlacedTower;
                    const cost = t.getUpgradeCost();
                    if (cost !== null && this.gold >= cost) {
                        this.gold -= cost;
                        t.upgrade();
                        Audio.place();
                        this._floatingTexts.push({
                            text: `⬆ Tier ${t.tier}`,
                            x: t.x, y: t.y - 20,
                            life: 1.2, maxLife: 1.2,
                            color: t.tier === 3 ? '#ffdd00' : '#ffffff'
                        });
                        ParticlePool.spawn(t.x, t.y, t.color, t.tier === 3 ? 18 : 10);
                        this.shake(t.tier === 3 ? 3 : 1.5);
                        this.updateUI();
                    } else if (cost !== null) {
                        Audio.noMoney();
                    }
                }
            }
            else if (e.key === 'Escape') { this.selectedTower = null; this.selectedPlacedTower = null; this.towers.forEach(tw => tw.selected = false); UI.setTowerActive(null); Fortification.placementMode = null; UI.setFortificationActive(null); }
        });

        UI.showMenu();
        this.loop(0);
    },

    startGame() {
        if (this.state !== 'menu') return;
        Audio.init();
        this.reset();
        Fortification.onLevelStart(this.level);
        this._buildLevelWaves();
        this.setState('playing');
        UI.hideMenu();
        this.updateUI();
    },
    
    rerollMap() {
        this.mapInfo = Path.generate();
        Terrain.generate(this.mapInfo.seed);
        this._updateMapDisplay();
        if (this.state === 'menu') {
            this.draw();
        }
    },
    
    loadSeed() {
        const input = document.getElementById('seed-input');
        const val = parseInt(input.value, 10);
        if (!isNaN(val) && val > 0) {
            this.mapInfo = Path.generate(val);
            Terrain.generate(this.mapInfo.seed);
            this._updateMapDisplay();
            input.value = '';
            if (this.state === 'menu') this.draw();
        }
    },
    
    _updateMapDisplay() {
        const nameEl = document.getElementById('map-name');
        const seedEl = document.getElementById('map-seed');
        if (nameEl && this.mapInfo) {
            nameEl.textContent = `Map: ${this.mapInfo.name}`;
            seedEl.textContent = `Seed: ${this.mapInfo.seed}`;
        }
        // Show/hide boat button based on water
        const boatBtn = document.getElementById('boat-btn');
        if (boatBtn) {
            boatBtn.style.display = (this.mapInfo && this.mapInfo.hasWater) ? '' : 'none';
        }
    },

    reset() {
        this.gold = 200;
        this.lives = 20;
        this.score = 0;
        this.speed = 1;
        this.towers = [];
        this.enemies = [];
        this.traps = [];
        this._floatingTexts = [];
        this._lightningBolts = [];
        this._powerups = [];
        this._activePowerups = { damage: 0, speed: 0, goldMult: 1 };
        this.selectedTower = null;
        this.selectedPlacedTower = null;
        this.shakeTimer = 0;
        this.wavesStacked = 0;
        this.levelTransition = false;
        this.levelStats = null;
        this.bossBannerTimer = 0;
        this.bossBannerText = '';
        this.perkChoiceActive = false;
        this.perkOptions = [];
        this.perkHistory = [];
        // Keep achievements across games (load from localStorage in init)
        this._killCount = 0;
        this._critCount = 0;
        this._killStreak = 0;
        this._livesAtWaveStart = 20;
        this.perkState = {
            globalDamageMult: 1,
            blasterDamageMult: 1,
            sniperDamageMult: 1,
            aoeDamageMult: 1,
            boatDamageMult: 1,
            trapDamageMult: 1,
            sentinelBonusCount: 0,
            sentinelHpMult: 1,
            economyBonusGold: 0,
            waveBonusMult: 1,
            healAfterLevel: 0,
            sellValueMult: 1,
            fireRateMult: 1,
            goldBonusChance: 0,
            lifeOnKill: false,
            chainLightning: false,
            critChance: 0
        };
        this._killStreak = 0;
        ParticlePool.active = [];
        ProjectilePool.active = [];
        ProjectilePool.rings = [];
        this.enemySpatial.clear();
        WaveManager.reset();
        Fortification.reset();
        SentinelManager.reset();
        UI.updateActivePerks(this.perkState, this.perkHistory);
    },

    restart() {
        if (this.state !== 'gameover') return;
        this.level = 1;
        this.mapInfo = Path.generate(this.mapInfo.seed);
        Terrain.generate(this.mapInfo.seed);
        this.reset();
        this._buildLevelWaves();
        this.setState('playing');
        document.getElementById('game-over-screen').style.display = 'none';
        this.updateUI();
    },
    
    restartNewMap() {
        if (this.state !== 'gameover') return;
        this.level = 1;
        this.mapInfo = Path.generate();
        Terrain.generate(this.mapInfo.seed);
        this.reset();
        this._buildLevelWaves();
        this.setState('playing');
        document.getElementById('game-over-screen').style.display = 'none';
        this.updateUI();
    },
    
    // Color themes per level
    colorThemes: [
        { bg: '#050510', path: 'rgba(0, 243, 255,', enemy: '#ff0055', name: 'Neon' },        // Level 1: classic
        { bg: '#0a0505', path: 'rgba(255, 100, 50,', enemy: '#ff8800', name: 'Inferno' },     // Level 2: fire
        { bg: '#050a05', path: 'rgba(80, 255, 80,', enemy: '#cc00ff', name: 'Toxic' },         // Level 3: poison
        { bg: '#05050a', path: 'rgba(120, 100, 255,', enemy: '#ff3366', name: 'Void' },        // Level 4: purple
        { bg: '#0a0a05', path: 'rgba(255, 220, 50,', enemy: '#ff2200', name: 'Solar' },        // Level 5: gold
        { bg: '#050808', path: 'rgba(0, 255, 200,', enemy: '#ff4488', name: 'Deep Sea' },      // Level 6: teal
    ],
    
    getCurrentTheme() {
        const idx = (this.level - 1) % this.colorThemes.length;
        return this.colorThemes[idx];
    },
    
    // Level transition state
    levelTransition: false,
    levelTransitionTimer: 0,
    levelStats: null,

    _advanceLevel() {
        try {
            // Capture stats before advancing
            this.levelStats = {
                level: this.level,
                score: this.score,
                gold: this.gold,
                towersPlaced: this.towers.length,
                wavesCleared: WaveManager.waves.length
            };
            this.levelTransition = true;
            this.levelTransitionTimer = 0;
        } catch(e) { console.error('Level advance error:', e); }
    },

    _confirmLevelAdvance() {
        if (!this.perkChoiceActive) {
            this.levelTransition = false;
            this.perkChoiceActive = true;
            this.perkOptions = this._generatePerkOptions();
            return;
        }
    },

    _allPerks() {
        return [
            { id: 'kinetic_boost', name: 'Kinetic Overdrive', desc: '+20% Blaster and Boat damage', tag: 'DAMAGE', color: '#00f3ff', apply: () => { this.perkState.blasterDamageMult *= 1.2; this.perkState.boatDamageMult *= 1.2; } },
            { id: 'sniper_focus', name: 'Sniper Focus', desc: '+35% Sniper damage', tag: 'DAMAGE', color: '#aa88ff', apply: () => { this.perkState.sniperDamageMult *= 1.35; } },
            { id: 'reactor_core', name: 'Reactor Core', desc: '+25% AOE damage', tag: 'DAMAGE', color: '#ff9a3d', apply: () => { this.perkState.aoeDamageMult *= 1.25; } },
            { id: 'sentinel_drill', name: 'Sentinel Drill', desc: '+1 sentinel per barracks', tag: 'SUMMON', color: '#44ffbb', apply: () => { this.perkState.sentinelBonusCount += 1; } },
            { id: 'reinforced_armor', name: 'Reinforced Armor', desc: '+25% sentinel HP', tag: 'DEFENSE', color: '#7dd3fc', apply: () => { this.perkState.sentinelHpMult *= 1.25; } },
            { id: 'trap_engineering', name: 'Trap Engineering', desc: '+25% trap damage', tag: 'UTILITY', color: '#ffd166', apply: () => { this.perkState.trapDamageMult *= 1.25; } },
            { id: 'war_chest', name: 'War Chest', desc: '+75 gold now and +25 each level', tag: 'ECON', color: '#facc15', apply: () => { this.gold += 75; this.perkState.economyBonusGold += 25; } },
            { id: 'blood_sport', name: 'Blood Sport', desc: '+30% early-wave bonus gold', tag: 'ECON', color: '#fb7185', apply: () => { this.perkState.waveBonusMult *= 1.3; } },
            { id: 'field_repairs', name: 'Field Repairs', desc: '+3 lives after each level', tag: 'DEFENSE', color: '#4ade80', apply: () => { this.perkState.healAfterLevel += 3; } },
            { id: 'scavenger', name: 'Scavenger', desc: '+25% sell value', tag: 'ECON', color: '#f59e0b', apply: () => { this.perkState.sellValueMult *= 1.25; } },
            { id: 'quick_reflexes', name: 'Quick Reflexes', desc: '+15% attack speed all towers', tag: 'DAMAGE', color: '#60a5fa', apply: () => { this.perkState.fireRateMult *= 1.15; } },
            { id: 'glass_cannon', name: 'Glass Cannon', desc: '+40% all damage, -10 starting lives', tag: 'RISK', color: '#ff6677', apply: () => { this.perkState.globalDamageMult *= 1.4; this.lives = Math.max(1, this.lives - 10); } },
            // New perks for replayability
            { id: 'last_stand', name: 'Last Stand', desc: '+1 life for every 5 kills', tag: 'DEFENSE', color: '#22d3d3', apply: () => { this.perkState.lifeOnKill = true; } },
            { id: 'golden_touch', name: 'Golden Touch', desc: '15% chance for 2x gold on kills', tag: 'ECON', color: '#ffd700', apply: () => { this.perkState.goldBonusChance = 0.15; } },
            { id: 'chain_lightning', name: 'Chain Lightning', desc: 'AOE towers chain to nearby enemies', tag: 'DAMAGE', color: '#a855f7', apply: () => { this.perkState.chainLightning = true; } },
            { id: 'critical_strike', name: 'Critical Strike', desc: '10% chance for 2x damage', tag: 'DAMAGE', color: '#f43f5e', apply: () => { this.perkState.critChance = 0.10; } },
            { id: 'vampirism', name: 'Vampirism', desc: '15% chance to heal 5 HP when killing an enemy', tag: 'DEFENSE', color: '#dc2626', apply: () => { this.perkState.vampirism = 0.15; } },
            { id: 'frost_nova', name: 'Frost Nova', desc: '15% chance to slow enemies by 30%', tag: 'UTILITY', color: '#38bdf8', apply: () => { this.perkState.frostChance = 0.15; } },
            { id: 'multishot', name: 'Multishot', desc: '10% chance for extra projectile', tag: 'DAMAGE', color: '#fb923c', apply: () => { this.perkState.multishotChance = 0.10; } },
            { id: 'berserker', name: 'Berserker', desc: '+50% damage when below 5 lives', tag: 'RISK', color: '#ef4444', apply: () => { this.perkState.berserker = true; } }
        ];
    },

    _generatePerkOptions() {
        const used = new Set(this.perkHistory);
        const pool = this._allPerks().filter(p => !used.has(p.id));
        const source = pool.length >= 3 ? pool : this._allPerks();
        const shuffled = [...source];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Utils.randInt(0, i);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, 3);
    },

    choosePerk(index) {
        const perk = this.perkOptions[index];
        if (!perk) return;
        perk.apply();
        this.perkHistory.push(perk.id);
        this.perkChoiceActive = false;
        this.perkOptions = [];
        UI.updateActivePerks(this.perkState, this.perkHistory);
        try { this.__doAdvanceLevel(); } catch(e) { console.error('Level advance error:', e); }
    },

    _checkAchievement(id) {
        if (this.achievements.includes(id)) return false;
        const ach = this._achievementDefinitions.find(a => a.id === id);
        if (!ach) return false;
        this.achievements.push(id);
        // Save to localStorage
        try { localStorage.setItem('neonDefenseAchievements', JSON.stringify(this.achievements)); } catch(e) {}
        // Show achievement popup
        this._floatingTexts.push({
            text: `${ach.icon} ${ach.name}!`,
            x: this.canvas.width / 2,
            y: this.canvas.height / 2 - 60,
            life: 2.5,
            maxLife: 2.5,
            color: '#ffd700'
        });
        console.log('Achievement unlocked:', ach.name);
        return true;
    },

    _onEnemyKilled(e) {
        // Track kills for achievements
        this._killCount = (this._killCount || 0) + 1;
        if (this._killCount === 1) this._checkAchievement('first_blood');
        if (this._killCount >= 100) this._checkAchievement('tower_killer');
        if (this._killCount >= 500) this._checkAchievement('slaughter');
        // Track crits
        if (e.critHit) {
            this._critCount = (this._critCount || 0) + 1;
            if (this._critCount >= 50) this._checkAchievement('crit_master');
        }
    },

    _onWaveComplete(waveNum) {
        if (waveNum >= 5) this._checkAchievement('wave_5');
        if (waveNum >= 10) this._checkAchievement('wave_10');
        if (waveNum >= 25) this._checkAchievement('wave_25');
        // Perfect wave (no lives lost this wave)
        const livesBefore = this._livesAtWaveStart || this.lives;
        if (this.lives >= livesBefore) this._checkAchievement('perfect_wave');
        this._livesAtWaveStart = this.lives;
    },

    _onGoldChange() {
        if (this.gold >= 1000) this._checkAchievement('banker');
        if (this.gold >= 5000) this._checkAchievement('rich');
    },

    _calculateStars() {
        // 3 stars: 10+ lives, 2 stars: 5+ lives, 1 star: completed
        if (this.lives >= 10) return 3;
        if (this.lives >= 5) return 2;
        return 1;
    },

    _activatePowerup(type, targetTower) {
        const duration = 10; // 10 seconds
        let msg = '';
        if (type === 'damage') {
            this._activePowerups.damage = duration;
            msg = '⚔️ DAMAGE BOOST!';
        } else if (type === 'speed') {
            this._activePowerups.speed = duration;
            msg = '⚡ SPEED BOOST!';
        } else if (type === 'gold') {
            this._activePowerups.goldMult = duration;
            this.gold += 50;
            msg = '💰 +50 GOLD!';
        } else if (type === 'shield') {
            this.lives += 1;
            UI.updateLives(this.lives);
            msg = '🛡️ +1 LIFE!';
        }
        // Show floating text
        if (targetTower) {
            this._floatingTexts.push({
                text: msg,
                x: targetTower.x,
                y: targetTower.y - 30,
                life: 1.5,
                maxLife: 1.5,
                color: type === 'damage' ? '#ff4444' : (type === 'speed' ? '#ffdd44' : (type === 'gold' ? '#ffd700' : '#4488ff'))
            });
        }
        // Play powerup sound
        Audio.powerup();
    },

    applyPerkModifiersToTower(tower) {
        // Global damage bonus (from Glass Cannon perk)
        tower.damage *= this.perkState.globalDamageMult;
        if (tower.type === 'blaster') tower.damage *= this.perkState.blasterDamageMult;
        if (tower.type === 'sniper') tower.damage *= this.perkState.sniperDamageMult;
        if (tower.type === 'aoe') tower.damage *= this.perkState.aoeDamageMult;
        if (tower.type === 'boat') tower.damage *= this.perkState.boatDamageMult;
        // Powerup: Damage boost
        if (this._activePowerups.damage > 0) tower.damage *= 1.5;
        // Fire rate bonus (from Quick Reflexes perk)
        tower.fireRate *= this.perkState.fireRateMult;
        // Powerup: Speed boost
        if (this._activePowerups.speed > 0) tower.fireRate *= 1.4;
        // Sell value bonus (from Scavenger perk)
        tower.sellValue = Math.round(tower.sellValue * this.perkState.sellValueMult);
        if (tower.type === 'sentinel') {
            tower.maxSentinels += this.perkState.sentinelBonusCount;
            tower.sentinelHp = Math.round(tower.sentinelHp * this.perkState.sentinelHpMult);
        }
        tower.damage = Math.round(tower.damage || 0);
    },
    
    // Waves per level: 5, 10, 15, 20, 20, 20...
    getWavesForLevel(level) {
        return Math.min(20, 5 + (level - 1) * 5);
    },

    __doAdvanceLevel() {
        this.level++;
        
        // Save stars for completed level (based on lives remaining)
        const stars = this._calculateStars();
        const prevStars = this.stars[this.level - 1] || 0;
        if (stars > prevStars) {
            this.stars[this.level - 1] = stars;
            try { localStorage.setItem('neonDefenseStars', JSON.stringify(this.stars)); } catch(e) {}
            // Show star achievement
            this._floatingTexts.push({
                text: `⭐ ${stars} STAR${stars > 1 ? 'S' : ''}!`,
                x: 400, y: 200,
                life: 3, maxLife: 3,
                color: '#ffd700'
            });
        }
        
        // Level bonus: +50 gold per level cleared
        const levelBonus = 50 * (this.level - 1) + this.perkState.economyBonusGold;
        this.gold += levelBonus;
        this.goldFlashTimer = 0.5;
        if (this.perkState.healAfterLevel > 0) {
            this.lives += this.perkState.healAfterLevel;
        }
        
        // Full reset — new map, clear towers, fresh start
        this.towers = [];
        this.traps = [];
        this.enemies = [];
        this._floatingTexts = [];
        this._lightningBolts = [];
        this.selectedTower = null;
        this.selectedPlacedTower = null;
        ParticlePool.active = [];
        ProjectilePool.active = [];
        ProjectilePool.rings = [];
        SentinelManager.reset();
        
        // New map
        this.mapInfo = Path.generate();
        Terrain.generate(this.mapInfo.seed);
        this._updateMapDisplay();
        
        // Init fortifications for new level
        Fortification.onLevelStart(this.level);
        
        // Reset wave manager for new level
        WaveManager.currentWave = 0;
        WaveManager.waveActive = false;
        WaveManager.spawnQueue = [];
        WaveManager.endless = false;
        WaveManager.currentLevel = this.level;
        WaveManager.levelScale = 1 + (this.level - 1) * 0.5;
        
        // Update wave definitions for this level's wave count
        this._buildLevelWaves();
        
        // Level transition floating text
        const theme = this.getCurrentTheme();
        const wavesThisLevel = this.getWavesForLevel(this.level);
        this._floatingTexts.push({
            text: `LEVEL ${this.level} — ${theme.name.toUpperCase()}`,
            x: 400, y: 230,
            life: 4, maxLife: 4,
            color: '#ffffff'
        });
        this._floatingTexts.push({
            text: `${wavesThisLevel} WAVES · NEW MAP`,
            x: 400, y: 260,
            life: 4, maxLife: 4,
            color: '#00f3ff'
        });
        this._floatingTexts.push({
            text: `+${levelBonus}💰 level bonus`,
            x: 400, y: 290,
            life: 4, maxLife: 4,
            color: '#ffdd00'
        });
        this._floatingTexts.push({
            text: 'Place towers, then press SPACE',
            x: 400, y: 330,
            life: 5, maxLife: 5,
            color: '#888888'
        });
        
        Audio.levelUp();
        this.updateUI();
    },
    
    // Build wave definitions based on current level's wave count
    _buildLevelWaves() {
        const totalWaves = this.getWavesForLevel(this.level);
        const level = this.level;
        const waves = [];
        
        for (let w = 0; w < totalWaves; w++) {
            const progress = w / (totalWaves - 1); // 0 to 1 within this level
            const wave = this._generateWaveForProgress(progress, level);
            waves.push(wave);
        }
        
        WaveManager.waves = waves;
    },
    
    // Generate a wave definition based on progress within level (0=easy, 1=boss)
    _generateWaveForProgress(progress, level) {
        const s = level; // level scaling factor
        const p = progress; // 0 = start of level, 1 = final wave
        
        const wave = [];
        
        // Basics — always present, decrease proportion as progress increases
        wave.push({ type: 'basic', count: Math.floor((8 + s * 3) * (1.2 - p * 0.4)) });
        
        // Fast — from 10% progress
        if (p >= 0.1) wave.push({ type: 'fast', count: Math.floor((3 + s * 2) * p) });
        
        // Swarm — from 15% progress
        if (p >= 0.15) wave.push({ type: 'swarm', count: Math.floor((4 + s * 2) * p) });
        
        // Tank — from 25% progress
        if (p >= 0.25) wave.push({ type: 'tank', count: Math.floor((2 + s) * p) });
        
        // Shield — from 35%
        if (p >= 0.35) wave.push({ type: 'shield', count: Math.floor((2 + s * 0.8) * p) });
        
        // Healer — from 50%
        if (p >= 0.5) wave.push({ type: 'healer', count: Math.max(1, Math.floor(s * 0.5 * p)) });
        
        // Stealth — from 60%
        if (p >= 0.6) wave.push({ type: 'stealth', count: Math.floor((1 + s * 0.6) * p) });
        
        // Boss — final wave only
        if (p >= 0.95) wave.push({ type: 'boss', count: Math.max(1, Math.floor(s * 0.5)) });
        
        return wave.filter(g => g.count > 0);
    },

    backToMenu() {
        this.level = 1;
        this.reset();
        this.mapInfo = Path.generate();
        Terrain.generate(this.mapInfo.seed);
        this._updateMapDisplay();
        this.setState('menu');
        document.getElementById('game-over-screen').style.display = 'none';
        UI.showMenu();
    },
    
    // State management with validation
    setState(newState) {
        const validStates = ['menu', 'playing', 'gameover'];
        if (!validStates.includes(newState)) {
            console.error(`Invalid state: ${newState}`);
            return false;
        }
        
        const prevState = this.state;
        this.state = newState;
        
        // State transition logic
        if (prevState !== newState) {
            this.onStateChange(prevState, newState);
        }
        
        return true;
    },
    
    // Handle state change events
    onStateChange(fromState, toState) {
        console.log(`State transition: ${fromState} -> ${toState}`);
        
        if (toState === 'playing') {
            this.lastTime = performance.now(); // Reset timing on game start
        }
        
        if (toState === 'gameover') {
            // Any cleanup needed on game over
        }
        
        if (toState === 'menu') {
            // Any cleanup needed on menu return
        }
    },

    selectTower(type) {
        Fortification.placementMode = null;
        UI.setFortificationActive(null);
        if (type === this.selectedTower) {
            this.selectedTower = null;
            UI.setTowerActive(null);
        } else {
            this.selectedTower = type;
            this.selectedPlacedTower = null;
            UI.setTowerActive(type);
        }
    },
    
    selectFortification(mode) {
        // Barricades/fortifications removed.
        Fortification.placementMode = null;
        UI.setFortificationActive(null);
    },

    setSpeed(s) {
        this.speed = s;
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`speed${s}`).classList.add('active');
    },

    showBossBanner(text = 'BOSS INCOMING') {
        this.bossBannerText = text;
        this.bossBannerTimer = 2.6;
        this.shake(3);
        if (Audio.bossAlert) Audio.bossAlert();
    },

    wavesStacked: 0,

    startWave() {
        // Don't allow early-calling during the last wave of a level — must beat it
        if (WaveManager.waveActive && WaveManager.currentWave >= WaveManager.waves.length - 1 && !WaveManager.endless) {
            return; // Must finish the boss wave naturally
        }
        
        // No wave cap — stack as many as you dare
        
        const nextWaveDef = WaveManager.getWaveDef(WaveManager.currentWave);
        const hasBossNext = nextWaveDef.some(g => g.type === 'boss' && g.count > 0);

        if (WaveManager.waveActive) {
            // Early wave! Enemies still alive + still spawning from current wave
            const aliveEnemies = this.enemies.filter(e => e.alive).length;
            const unspawned = WaveManager.spawnQueue.length;
            const totalRemaining = aliveEnemies + unspawned;
            if (totalRemaining > 0) {
                // Bigger bonus when called during spawning (more risk = more reward)
                const bonus = Math.floor((totalRemaining * 5 + (unspawned > 0 ? unspawned * 3 : 0)) * this.perkState.waveBonusMult);
                this.gold += bonus;
                this.score += bonus;
                this.goldFlashTimer = 0.35;
                const label = unspawned > 0 ? 'WAVE OVERLAP!' : 'EARLY WAVE!';
                this._floatingTexts.push({
                    text: `+${bonus}💰 ${label}`,
                    x: 400, y: 280,
                    life: 1.5, maxLife: 1.5,
                    color: unspawned > 0 ? '#ff6600' : '#ffdd00'
                });
                Audio.earlyWave();
            }
            // Advance wave counter, append next wave's enemies to spawn queue
            WaveManager.currentWave++;
            WaveManager.appendWave();
            this.wavesStacked++;
        } else {
            WaveManager.startWave();
            this.wavesStacked = 0;
        }
        
        Audio.waveStart();
        if (hasBossNext) this.showBossBanner(`BOSS WAVE ${WaveManager.currentWave + 1}`);
        UI.updateWavePreview('');
        this.updateUI();
    },

    handleClick(mx, my) {
        const snap = Utils.snapToGrid(mx, my);
        const gridKey = Utils.gridKey(mx, my);
        const gx = Math.floor(mx / Utils.GRID);
        const gy = Math.floor(my / Utils.GRID);

        // Check if clicking existing tower
        for (const t of this.towers) {
            if (Utils.dist(mx, my, t.x, t.y) < Utils.GRID * 1.5) {
                if (this.selectedTower === 'sell') {
                    // Sell tower
                    if (t.isSentinel) SentinelManager.unregisterTower(t);
                    this.gold += t.sellValue;
                    this.towers = this.towers.filter(tw => tw !== t);
                    Audio.sell();
                    this.selectedPlacedTower = null;
                    this.updateUI();
                    return;
                }
                
                // If clicking the same selected tower, try to upgrade it
                if (this.selectedPlacedTower === t && t.selected) {
                    const upgradeCost = t.getUpgradeCost();
                    if (upgradeCost !== null && this.gold >= upgradeCost) {
                        this.gold -= upgradeCost;
                        t.upgrade();
                        Audio.place(); // reuse place sound for upgrade
                        this._floatingTexts.push({
                            text: `⬆ Tier ${t.tier}`,
                            x: t.x, y: t.y - 20,
                            life: 1.2, maxLife: 1.2,
                            color: t.tier === 3 ? '#ffdd00' : '#ffffff'
                        });
                        ParticlePool.spawn(t.x, t.y, t.color, t.tier === 3 ? 18 : 10);
                        this.shake(t.tier === 3 ? 3 : 1.5);
                        this.updateUI();
                        return;
                    } else if (upgradeCost !== null) {
                        Audio.noMoney();
                        return;
                    }
                    // Max tier — deselect
                    t.selected = false;
                    this.selectedPlacedTower = null;
                    this.updateUI();
                    return;
                }
                
                // Select tower to view range + upgrade info
                this.towers.forEach(tw => tw.selected = false);
                t.selected = true;
                this.selectedPlacedTower = t;
                this.selectedTower = null;
                UI.setTowerActive(null);
                this.updateUI();
                return;
            }
        }

        // Place tower (only if it's a tower type, not a trap)
        const isTowerType = this.selectedTower && TowerTypes[this.selectedTower];
        const isTrapType = this.selectedTower && typeof TrapTypes !== 'undefined' && TrapTypes[this.selectedTower];
        
        if (isTowerType) {
            const def = TowerTypes[this.selectedTower];

            // Check affordable
            if (this.gold < def.cost) {
                Audio.noMoney();
                return;
            }

            // Check terrain — must be buildable (grass) or water for boats
            const terrainType = Terrain.getType(snap.x, snap.y);
            if (def.water) {
                if (terrainType !== 'water') return; // Boat needs water
            } else {
                if (!Terrain.canBuild(snap.x, snap.y)) return; // Land towers need grass
            }

            // Check not on existing tower
            for (const t of this.towers) {
                if (Utils.dist(snap.x, snap.y, t.x, t.y) < Utils.GRID * 2.5) return;
            }

            // Check bounds
            const padding = Utils.GRID * 2;
            if (snap.x < padding || snap.x > 800 - padding || snap.y < padding || snap.y > 600 - padding) return;

            // Place it
            const tower = createTower(this.selectedTower, snap.x, snap.y);
            this.towers.push(tower);
            this.gold -= def.cost;
            Audio.place();
            // Register sentinel units
            if (tower.isSentinel) {
                SentinelManager.registerTower(tower);
            }
            this.updateUI();
        }
        
        // Place trap (must be ON the path)
        if (isTrapType) {
            const trapDef = TrapTypes[this.selectedTower];
            if (this.gold < trapDef.cost) {
                Audio.noMoney();
                return;
            }
            
            // Must be on path terrain
            if (Terrain.getType(snap.x, snap.y) !== 'path') return;
            
            // Check not on existing trap
            for (const t of this.traps) {
                if (t.alive && Utils.dist(snap.x, snap.y, t.x, t.y) < 16) return; // min spacing between traps
            }
            
            const trap = createTrap(this.selectedTower, snap.x, snap.y);
            this.traps.push(trap);
            this.gold -= trapDef.cost;
            Audio.trapPlace();
            this.updateUI();
            return;
        }
        
        // If sentinel tower is selected and clicking on path, set rally point
        if (this.selectedPlacedTower && this.selectedPlacedTower.isSentinel) {
            const pathBlocked = Path.getBlocked();
            if (pathBlocked.has(gridKey)) {
                SentinelManager.setRallyPoint(this.selectedPlacedTower, snap.x, snap.y);
                this._floatingTexts.push({
                    text: '🚩 RALLY SET',
                    x: snap.x, y: snap.y - 15,
                    life: 1, maxLife: 1,
                    color: '#00ff88'
                });
                Audio.place();
                return;
            }
        }
        
        // Clicked empty space — deselect any selected tower
        if (this.selectedPlacedTower) {
            this.towers.forEach(tw => tw.selected = false);
            this.selectedPlacedTower = null;
        }
    },

    handlePerkClick(mx, my) {
        const cards = [
            { x: 110, y: 210, w: 180, h: 150 },
            { x: 310, y: 210, w: 180, h: 150 },
            { x: 510, y: 210, w: 180, h: 150 }
        ];
        for (let i = 0; i < cards.length; i++) {
            const c = cards[i];
            if (mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h) {
                this.choosePerk(i);
                return;
            }
        }
    },

    shake(intensity) {
        this.shakeTimer = 0.15;
        this.shakeIntensity = intensity;
    },

    updateUI() {
        UI.updateGold(this.gold, this.goldFlashTimer > 0);
        if (this.goldFlashTimer > 0) this.goldFlashTimer -= 0.016;
        UI.updateWave(WaveManager.currentWave, WaveManager.waves.length, WaveManager.endless);
        UI.updateLives(this.lives);
        UI.updateScore(this.score);
        UI.updateTowerAffordability(this.gold);
        if (!WaveManager.waveActive) {
            UI.updateWavePreview(WaveManager.getPreviewText());
        }
        // Start wave always enabled — player can overlap waves at will
        const isLastWave = WaveManager.waveActive && WaveManager.currentWave >= WaveManager.waves.length - 1 && !WaveManager.endless;
        UI.setStartWaveEnabled(!isLastWave);
    },

    update(dt) {
        if (this.state !== 'playing' || this.levelTransition || this.perkChoiceActive) return;

        const speedMult = this.speed;

        // Spawn enemies
        WaveManager.update(dt, this.enemies, speedMult, this.wavesStacked);

        // Update enemies
        for (const e of this.enemies) {
            e.update(dt, speedMult);
            if (!e.alive && e.reachedEnd) {
                this.lives--;
                e.reachedEnd = false;
                this.shake(4); // Screen shake when enemy reaches end
                if (this.lives <= 0) {
                    // Save high score
                    if (this.score > this.highScore) {
                        this.highScore = this.score;
                        localStorage.setItem('neonDefenseHighScore', this.highScore.toString());
                    }
                    this.setState('gameover');
                    Audio.gameOver();
                    UI.showGameOver(false, this.score, WaveManager.currentWave);
                    return;
                }
                UI.updateLives(this.lives);
            }
            if (!e.alive && !e.scored && !e.reachedEnd) {
                // Golden Touch perk: 15% chance for 2x gold
                let goldEarned = e.gold;
                // Gold powerup multiplier
                if (this._activePowerups.goldMult > 1) goldEarned *= 2;
                if (this.perkState.goldBonusChance && Math.random() < this.perkState.goldBonusChance) {
                    goldEarned *= 2;
                    this._floatingTexts.push({
                        text: `+${goldEarned}💰 GOLDEN!`,
                        x: e.x,
                        y: e.y - 44,
                        life: 1.0,
                        maxLife: 1.0,
                        color: '#ffd700'
                    });
                }
                this.gold += goldEarned;
                this.score += goldEarned;
                // Kill streak combo counter (visible for all players)
                this._killCombo = (this._killCombo || 0) + 1;
                if (this._killCombo >= 3) {
                    this._floatingTexts.push({
                        text: `${this._killCombo}x COMBO!`,
                        x: e.x,
                        y: e.y - 55,
                        life: 0.8,
                        maxLife: 0.8,
                        color: this._killCombo >= 10 ? '#ff44ff' : (this._killCombo >= 7 ? '#ff8800' : '#ffff44')
                    });
                }
                // Reset combo after delay
                clearTimeout(this._comboTimeout);
                this._comboTimeout = setTimeout(() => { this._killCombo = 0; }, 2000);
                // Last Stand perk: +1 life every 5 kills
                if (this.perkState.lifeOnKill) {
                    this._killStreak = (this._killStreak || 0) + 1;
                    if (this._killStreak >= 5) {
                        this.lives += 1;
                        this._killStreak = 0;
                        UI.updateLives(this.lives);
                        this._floatingTexts.push({
                            text: `+1 LIFE!`,
                            x: e.x,
                            y: e.y - 66,
                            life: 1.0,
                            maxLife: 1.0,
                            color: '#22d3d3'
                        });
                    }
                }
                // Vampirism perk: chance to heal tower on kill
                if (this.perkState.vampirism && Math.random() < this.perkState.vampirism) {
                    // Find a random tower to heal
                    const towers = this.towers.filter(t => t.hp < t.maxHp);
                    if (towers.length > 0) {
                        const tower = towers[Math.floor(Math.random() * towers.length)];
                        const healAmt = 5;
                        tower.hp = Math.min(tower.maxHp, tower.hp + healAmt);
                        this._floatingTexts.push({
                            text: `+${healAmt} HP 💉`,
                            x: tower.x,
                            y: tower.y - 20,
                            life: 0.8,
                            maxLife: 0.8,
                            color: '#dc2626'
                        });
                    }
                }
                e.scored = true;
                Audio.kill();
                ParticlePool.explosion(e.x, e.y, e.color, e.type === 'boss');
                // Gold earned floating text
                this._floatingTexts.push({
                    text: `+${goldEarned}💰`,
                    x: e.x,
                    y: e.y - 22,
                    life: 0.7,
                    maxLife: 0.7,
                    color: '#ffdd44'
                });
                // Gold flash effect on HUD
                this.goldFlashTimer = 0.35;
                this._floatingTexts.push({
                    text: `-${e.lastDamage || 0}`,
                    x: e.x,
                    y: e.y - 10,
                    life: 0.45,
                    maxLife: 0.45,
                    color: '#ffffff'
                });
                if (e.type === 'boss') {
                    this.shake(5);
                    Audio.bossKill();
                    this.showBossBanner('BOSS DESTROYED');
                    // Boss kill achievements
                    this._bossKills = (this._bossKills || 0) + 1;
                    if (this._bossKills === 1) this._checkAchievement('boss_slayer');
                    if (this._bossKills >= 10) this._checkAchievement('boss_hunter');
                }
                // Split boss: spawn minions on death
                if (e.bossRole === 'split' && e.splitCount > 0) {
                    for (let i = 0; i < e.splitCount; i++) {
                        const minion = createEnemy(e.splitMinionType || 'swarm', WaveManager.currentWave);
                        // Position minions around the boss with some spread
                        const angle = (i / e.splitCount) * Math.PI * 2;
                        const spread = 40 + Math.random() * 20;
                        minion.x = e.x + Math.cos(angle) * spread;
                        minion.y = e.y + Math.sin(angle) * spread;
                        minion.alive = true;
                        minion.scored = false;
                        this.enemies.push(minion);
                    }
                    // Show floating text about split
                    this._floatingTexts.push({
                        text: `SPLIT!`,
                        x: e.x,
                        y: e.y - 44,
                        life: 1.0,
                        maxLife: 1.0,
                        color: '#ff44aa'
                    });
                }
                // Track achievements
                this._onEnemyKilled(e);
                this._onGoldChange();
                // Powerup drop chance (5% for normal, 15% for bosses)
                const dropChance = e.type === 'boss' ? 0.15 : 0.05;
                if (Math.random() < dropChance) {
                    const powerups = ['damage', 'speed', 'gold', 'shield'];
                    const type = powerups[Math.floor(Math.random() * powerups.length)];
                    const colors = { damage: '#ff4444', speed: '#ffdd44', gold: '#ffd700', shield: '#4488ff' };
                    const symbols = { damage: '⚔️', speed: '⚡', gold: '💰', shield: '🛡️' };
                    this._powerups.push({
                        x: e.x,
                        y: e.y,
                        type: type,
                        color: colors[type],
                        symbol: symbols[type],
                        life: 8, // 8 seconds to pick up
                        vx: (Math.random() - 0.5) * 30,
                        vy: -60 // pop upward
                    });
                }
                this.updateUI();
            }
        }

        // Clean dead enemies
        this.enemies = this.enemies.filter(e => e.alive || (!e.scored && e.reachedEnd));
        this.rebuildEnemySpatial();

        // Update towers
        for (const t of this.towers) {
            t.update(dt, this.enemies, speedMult);
        }

        // Update traps
        for (const trap of this.traps) {
            trap.update(dt, this.enemies, speedMult);
        }
        this.traps = this.traps.filter(t => t.alive);

        // Update sentinels
        SentinelManager.update(dt, this.enemies, speedMult);

        // Update projectiles
        ProjectilePool.update(dt, this.enemies);

        // Update particles
        ParticlePool.update(dt * speedMult);
        
        // Update floating texts
        for (let i = this._floatingTexts.length - 1; i >= 0; i--) {
            const ft = this._floatingTexts[i];
            ft.life -= dt;
            ft.y -= 30 * dt; // Float upward
            if (ft.life <= 0) this._floatingTexts.splice(i, 1);
        }

        // Update lightning bolts
        for (let i = this._lightningBolts.length - 1; i >= 0; i--) {
            const lb = this._lightningBolts[i];
            lb.life -= dt;
            if (lb.life <= 0) this._lightningBolts.splice(i, 1);
        }
        
        // Update powerups
        for (let i = this._powerups.length - 1; i >= 0; i--) {
            const p = this._powerups[i];
            p.life -= dt;
            p.vy += 200 * dt; // gravity
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            // Bounce off ground
            if (p.y > 520) {
                p.y = 520;
                p.vy *= -0.5;
                p.vx *= 0.8;
            }
            // Check pickup (touching any tower or player position)
            let pickedUp = false;
            for (const t of this.towers) {
                if (Math.hypot(p.x - t.x, p.y - t.y) < 30) {
                    pickedUp = true;
                    this._activatePowerup(p.type, t);
                    break;
                }
            }
            if (!pickedUp && p.life <= 0) {
                this._powerups.splice(i, 1);
            }
        }
        
        // Update active powerup timers
        if (this._activePowerups.damage > 0) this._activePowerups.damage -= dt;
        if (this._activePowerups.speed > 0) this._activePowerups.speed -= dt;
        if (this._activePowerups.goldMult > 1) this._activePowerups.goldMult -= dt;

        if (this.bossBannerTimer > 0) this.bossBannerTimer -= dt;

        // Screen shake
        if (this.shakeTimer > 0) this.shakeTimer -= dt;

        // Update wave remaining display
        if (WaveManager.waveActive) {
            UI.updateWaveRemaining(this.enemies);
        }

        // Wave complete check
        if (WaveManager.isWaveComplete(this.enemies)) {
            const bonus = 50 + WaveManager.currentWave * 10;
            this.gold += bonus;
            this.score += bonus;
            this.goldFlashTimer = 0.5;
            
            // Wave complete celebration
            this._floatingTexts.push({
                text: `✅ WAVE ${WaveManager.currentWave + 1} COMPLETE!`,
                x: 400, y: 280,
                life: 2.0, maxLife: 2.0,
                color: '#44ff88'
            });
            this._floatingTexts.push({
                text: `+${bonus}💰`,
                x: 400, y: 310,
                life: 1.5, maxLife: 1.5,
                color: '#ffdd44'
            });
            this.waveCompleteTimer = 1.5;
            
            if (!WaveManager.earlyAdvanced) {
                WaveManager.currentWave++;
            }
            WaveManager.earlyAdvanced = false;
            WaveManager.waveActive = false;
            this.wavesStacked = 0;
            
            // Check wave achievements
            this._onWaveComplete(WaveManager.currentWave);

            // Level progression: after all waves for this level, advance
            if (WaveManager.currentWave >= WaveManager.waves.length && !WaveManager.endless) {
                this._advanceLevel();
            }

            this.updateUI();
        }
    },

    draw() {
        const ctx = this.ctx;

        // Screen shake offset
        let sx = 0, sy = 0;
        if (this.shakeTimer > 0) {
            sx = Utils.rand(-this.shakeIntensity, this.shakeIntensity);
            sy = Utils.rand(-this.shakeIntensity, this.shakeIntensity);
        }

        ctx.save();
        ctx.translate(sx, sy);

        // Draw terrain (cached offscreen canvas + water animation + flow arrows)
        const theme = this.getCurrentTheme();
        Terrain.draw(ctx, theme);

        // Wave complete celebration flash
        if (this.waveCompleteTimer > 0) {
            const flashAlpha = Math.min(0.25, this.waveCompleteTimer * 0.2);
            ctx.fillStyle = `rgba(68, 255, 136, ${flashAlpha})`;
            ctx.fillRect(0, 0, 800, 600);
            this.waveCompleteTimer -= 0.016;
        }

        // Water zone indicator - highlight when placing boat or hovering water
        if (this.state === 'playing') {
            const snap = Utils.snapToGrid(this.mouseX, this.mouseY);
            const isWater = Terrain.isWaterTile(snap.x, snap.y);
            const isBoatSelected = this.selectedTower === 'boat';
            if (isWater && (isBoatSelected || this.selectedTower === null)) {
                ctx.save();
                ctx.fillStyle = 'rgba(0, 136, 255, 0.12)';
                ctx.strokeStyle = 'rgba(0, 200, 255, 0.4)';
                ctx.lineWidth = 2;
                // Draw subtle highlight over water area
                const ts = Terrain.TILE_SIZE;
                for (let r = 0; r < Terrain.ROWS; r++) {
                    for (let c = 0; c < Terrain.COLS; c++) {
                        if (Terrain.grid[r][c] === 'water') {
                            const wx = c * ts;
                            const wy = r * ts;
                            // Highlight water tiles near mouse
                            if (Utils.dist(this.mouseX, this.mouseY, wx + ts/2, wy + ts/2) < 80) {
                                ctx.fillRect(wx + 2, wy + 2, ts - 4, ts - 4);
                                ctx.strokeRect(wx + 2, wy + 2, ts - 4, ts - 4);
                            }
                        }
                    }
                }
                // Show "BOAT ZONE" text when placing boat
                if (isBoatSelected) {
                    ctx.font = 'bold 11px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = '#00ccff';
                    ctx.shadowColor = '#00ccff';
                    ctx.shadowBlur = 8;
                    ctx.fillText('🚢 BOAT ZONE', this.mouseX, this.mouseY - 25);
                }
                ctx.restore();
            }
        }

        // Tower/trap placement preview
        if (this.state === 'playing' && this.selectedTower && this.selectedTower !== 'sell') {
            const snap = Utils.snapToGrid(this.mouseX, this.mouseY);
            const terrType = Terrain.getType(snap.x, snap.y);
            const isTrap = TrapTypes && TrapTypes[this.selectedTower];
            
            if (isTrap) {
                // Show valid trap path cells while placing
                const ts = Terrain.TILE_SIZE;
                ctx.save();
                for (let r = 0; r < Terrain.ROWS; r++) {
                    for (let c = 0; c < Terrain.COLS; c++) {
                        if (Terrain.grid[r][c] !== 'path') continue;
                        const x = c * ts;
                        const y = r * ts;
                        ctx.strokeStyle = 'rgba(255, 200, 80, 0.18)';
                        ctx.strokeRect(x + 5.5, y + 5.5, ts - 11, ts - 11);
                    }
                }
                ctx.restore();

                // Trap preview — must be ON path
                const trapDef = TrapTypes[this.selectedTower];
                const canAfford = this.gold >= trapDef.cost;
                const occupied = this.traps.some(t => t.alive && Utils.dist(snap.x, snap.y, t.x, t.y) < Utils.GRID * 0.6);
                const onPath = terrType === 'path';
                const valid = onPath && canAfford && !occupied;
                
                ctx.globalAlpha = 0.4;
                ctx.fillStyle = valid ? trapDef.color : '#ff0033';
                ctx.beginPath();
                ctx.arc(snap.x, snap.y, 8, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(snap.x, snap.y, trapDef.radius, 0, Math.PI * 2);
                ctx.strokeStyle = `${trapDef.color}33`;
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.globalAlpha = 1;
            } else {
                const def = TowerTypes[this.selectedTower];
                if (def) {
                    const ts = Terrain.TILE_SIZE;
                    const needsWater = !!def.water;

                    // Show valid build cells while placing towers
                    ctx.save();
                    for (let r = 0; r < Terrain.ROWS; r++) {
                        for (let c = 0; c < Terrain.COLS; c++) {
                            const tileType = Terrain.grid[r][c];
                            const validTile = needsWater ? tileType === 'water' : tileType === 'grass';
                            if (!validTile) continue;
                            const cx = c * ts + ts / 2;
                            const cy = r * ts + ts / 2;
                            const occupied = this.towers.some(t => Utils.dist(cx, cy, t.x, t.y) < Utils.GRID * 0.8);
                            if (occupied) continue;
                            const x = c * ts;
                            const y = r * ts;
                            ctx.strokeStyle = needsWater ? 'rgba(80, 180, 255, 0.22)' : 'rgba(80, 255, 140, 0.20)';
                            ctx.strokeRect(x + 4.5, y + 4.5, ts - 9, ts - 9);
                        }
                    }
                    ctx.restore();

                    const canAfford = this.gold >= def.cost;
                    const occupied = this.towers.some(t => Utils.dist(snap.x, snap.y, t.x, t.y) < Utils.GRID * 0.8);
                    const validTerrain = def.water ? (terrType === 'water') : (terrType === 'grass');

                    ctx.globalAlpha = 0.4;
                    ctx.fillStyle = (!validTerrain || occupied || !canAfford) ? '#ff0033' : def.color;
                    ctx.beginPath();
                    ctx.arc(snap.x, snap.y, 12, 0, Math.PI * 2);
                    ctx.fill();

                    // Snap box so target cell is obvious
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = (!validTerrain || occupied || !canAfford) ? 'rgba(255,0,51,0.8)' : 'rgba(255,255,255,0.7)';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(snap.x - ts / 2 + 2, snap.y - ts / 2 + 2, ts - 4, ts - 4);

                    // Range preview (skip for sentinel — no range)
                    if (def.range > 0) {
                        ctx.beginPath();
                        ctx.arc(snap.x, snap.y, def.range, 0, Math.PI * 2);
                        ctx.strokeStyle = `${def.color}33`;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                }
            }
        }

        // Traps (below towers, on path)
        for (const trap of this.traps) trap.draw(ctx);

        // Towers
        for (const t of this.towers) t.draw(ctx);

        // Enemies
        for (const e of this.enemies) e.draw(ctx);

        // Sentinels (above enemies)
        SentinelManager.draw(ctx);

        // Projectiles
        ProjectilePool.draw(ctx);

        // Particles
        ParticlePool.draw(ctx);

        // Floating texts
        for (const ft of this._floatingTexts) {
            const alpha = ft.life / ft.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = ft.color;
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.shadowColor = ft.color;
            ctx.shadowBlur = 10;
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
            ctx.textAlign = 'start';
        }

        // Lightning bolts (Chain Lightning perk)
        for (const lb of this._lightningBolts) {
            const alpha = lb.life / lb.maxLife;
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = lb.color;
            ctx.lineWidth = 3;
            ctx.shadowColor = lb.color;
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.moveTo(lb.sx, lb.sy);
            // Jagged lightning path
            const segments = 5;
            const dx = (lb.tx - lb.sx) / segments;
            const dy = (lb.ty - lb.sy) / segments;
            for (let i = 1; i < segments; i++) {
                const jag = (Math.random() - 0.5) * 20;
                ctx.lineTo(lb.sx + dx * i + jag, lb.sy + dy * i + jag);
            }
            ctx.lineTo(lb.tx, lb.ty);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }

        // Powerup drops
        for (const p of this._powerups) {
            const pulse = 1 + Math.sin(performance.now() * 0.01) * 0.15;
            const alpha = Math.min(1, p.life);
            ctx.globalAlpha = alpha;
            // Glow
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 15;
            // Orb
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 12 * pulse, 0, Math.PI * 2);
            ctx.fill();
            // Symbol
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.symbol, p.x, p.y);
            ctx.globalAlpha = 1;
        }
        
        // Active powerup indicators (on HUD)
        if (this._activePowerups.damage > 0 || this._activePowerups.speed > 0 || this._activePowerups.goldMult > 1) {
            let indicatorX = 90;
            if (this._activePowerups.damage > 0) {
                ctx.fillStyle = '#ff4444';
                ctx.fillRect(indicatorX, 52, 60, 8);
                ctx.fillStyle = '#fff';
                ctx.font = '8px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(`⚔️ ${this._activePowerups.damage.toFixed(1)}s`, indicatorX + 2, 58);
                indicatorX += 65;
            }
            if (this._activePowerups.speed > 0) {
                ctx.fillStyle = '#ffdd44';
                ctx.fillRect(indicatorX, 52, 60, 8);
                ctx.fillStyle = '#fff';
                ctx.font = '8px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(`⚡ ${this._activePowerups.speed.toFixed(1)}s`, indicatorX + 2, 58);
                indicatorX += 65;
            }
            if (this._activePowerups.goldMult > 1) {
                ctx.fillStyle = '#ffd700';
                ctx.fillRect(indicatorX, 52, 60, 8);
                ctx.fillStyle = '#fff';
                ctx.font = '8px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(`💰 ${this._activePowerups.goldMult.toFixed(1)}s`, indicatorX + 2, 58);
            }
        }

        // Tower info tooltip (when a placed tower is selected)
        if (this.selectedPlacedTower) {
            const t = this.selectedPlacedTower;
            
            // Build tooltip text lines
            const tierName = (TowerUpgrades[t.type] && TowerUpgrades[t.type][t.tier - 1])
                ? TowerUpgrades[t.type][t.tier - 1].name
                : t.type.charAt(0).toUpperCase() + t.type.slice(1);
            const displayName = t.tier === 1 ? `${t.type.charAt(0).toUpperCase() + t.type.slice(1)} ★` : tierName + ' ' + '★'.repeat(t.tier);
            const statsText = `DMG ${t.damage}  RNG ${t.range}  SPD ${t.fireRate.toFixed(1)}`;
            const dmgType = DamageTypes[t.type] || 'kinetic';
            const dmgTypeNames = { kinetic: 'KINETIC', pierce: 'PIERCE', fire: 'FIRE' };
            const typeText = `TYPE: ${dmgTypeNames[dmgType] || dmgType.toUpperCase()}`;
            const sellText = `Sell: $${t.sellValue}`;
            
            let upgradeText = '';
            let upgradeColor = '#ffdd00';
            if (t.tier < 3) {
                const upgradeCost = t.getUpgradeCost();
                if (upgradeCost !== null) {
                    const canAfford = this.gold >= upgradeCost;
                    upgradeColor = canAfford ? '#ffdd00' : '#ff4444';
                    upgradeText = `Click to upgrade — $${upgradeCost}`;
                }
            } else {
                upgradeText = '✦ MAX TIER ✦';
            }
            
            // Measure text widths to size box properly
            ctx.font = 'bold 12px monospace';
            const nameW = ctx.measureText(displayName).width;
            ctx.font = '10px monospace';
            const statsW = ctx.measureText(statsText).width;
            const sellW = ctx.measureText(sellText).width;
            ctx.font = 'bold 10px monospace';
            const typeW = ctx.measureText(typeText).width;
            const upgradeW = upgradeText ? ctx.measureText(upgradeText).width : 0;
            
            const padding = 20;
            const maxTextW = Math.max(nameW, statsW, sellW, upgradeW, typeW);
            // Cap width and enable wrapping for long text
            const boxW = Math.min(maxTextW + padding * 2, 250);
            const lineH = 16;
            const lines = upgradeText ? 5 : 4;
            const boxH = lines * lineH + 12;
            
            // Position tooltip intelligently so it never hides the selected tower
            const margin = 10;
            const towerPad = 28;
            let bx = t.x - boxW / 2;
            let by = t.y - boxH - towerPad;

            // Prefer above; if not enough room, try below
            if (by < margin) {
                by = t.y + towerPad;
            }

            // If still overlapping the tower vertically, try the side with more space
            const overlapsTower = !(by + boxH < t.y - 18 || by > t.y + 18 || bx + boxW < t.x - 18 || bx > t.x + 18);
            if (overlapsTower) {
                const roomRight = 800 - (t.x + towerPad);
                const roomLeft = t.x - towerPad;
                if (roomRight >= boxW + margin) {
                    bx = t.x + towerPad;
                    by = Math.max(margin, Math.min(600 - boxH - margin, t.y - boxH / 2));
                } else if (roomLeft >= boxW + margin) {
                    bx = t.x - towerPad - boxW;
                    by = Math.max(margin, Math.min(600 - boxH - margin, t.y - boxH / 2));
                }
            }

            // Final clamp to screen
            bx = Math.max(margin, Math.min(800 - boxW - margin, bx));
            by = Math.max(margin, Math.min(600 - boxH - margin, by));
            const tx = bx + boxW / 2;
            
            // Background with rounded feel + glow
            ctx.shadowColor = t.color;
            ctx.shadowBlur = 12;
            ctx.fillStyle = 'rgba(5, 5, 20, 0.92)';
            ctx.strokeStyle = t.color;
            ctx.lineWidth = 1.5;
            ctx.fillRect(bx, by, boxW, boxH);
            ctx.strokeRect(bx, by, boxW, boxH);
            ctx.shadowBlur = 0;
            
            // Accent line at top with glow
            ctx.shadowColor = t.color;
            ctx.shadowBlur = 8;
            ctx.fillStyle = t.color;
            ctx.fillRect(bx + 1, by + 1, boxW - 2, 2);
            ctx.shadowBlur = 0;
            
            ctx.textAlign = 'center';
            let curY = by + 18;
            
            // Tower name
            ctx.fillStyle = t.color;
            ctx.font = 'bold 12px monospace';
            ctx.fillText(displayName, tx, curY);
            curY += lineH;
            
            // Stats
            ctx.fillStyle = '#aaa';
            ctx.font = '10px monospace';
            ctx.fillText(statsText, tx, curY);
            curY += lineH;
            
            // Damage type
            const typeColors = { KINETIC: '#00f3ff', PIERCE: '#aa88ff', FIRE: '#ff8800' };
            ctx.fillStyle = typeColors[dmgTypeNames[dmgType]] || '#aaa';
            ctx.font = 'bold 10px monospace';
            ctx.fillText(typeText, tx, curY);
            curY += lineH;
            
            // Sell value
            ctx.fillStyle = '#888';
            ctx.fillText(sellText, tx, curY);
            curY += lineH;
            
            // Upgrade info
            if (upgradeText) {
                ctx.fillStyle = upgradeColor;
                ctx.font = 'bold 10px monospace';
                ctx.fillText(upgradeText, tx, curY);
            }
            
            ctx.textAlign = 'start';
        }

        ctx.restore();
        
        // Level transition overlay
        if (this.levelTransition && this.levelStats) {
            ctx.fillStyle = 'rgba(2, 2, 8, 0.85)';
            ctx.fillRect(0, 0, 800, 600);
            
            const s = this.levelStats;
            const theme = this.getCurrentTheme();
            
            ctx.textAlign = 'center';
            
            // Title
            ctx.fillStyle = '#00ff66';
            ctx.font = 'bold 28px monospace';
            ctx.shadowColor = '#00ff66';
            ctx.shadowBlur = 20;
            ctx.fillText(`LEVEL ${s.level} COMPLETE`, 400, 200);
            ctx.shadowBlur = 0;
            
            // Stats
            ctx.fillStyle = '#ffffff';
            ctx.font = '16px monospace';
            ctx.fillText(`Waves Cleared: ${s.wavesCleared}`, 400, 260);
            ctx.fillText(`Score: ${s.score}`, 400, 290);
            ctx.fillText(`Gold Banked: ${s.gold}`, 400, 320);
            ctx.fillText(`Towers Active: ${s.towersPlaced}`, 400, 350);
            
            // Next level hint
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 14px monospace';
            const nextTheme = this.colorThemes[this.level % this.colorThemes.length];
            const nextWaves = this.getWavesForLevel(s.level + 1);
            ctx.fillText(`Next: Level ${s.level + 1} — ${nextTheme.name} (${nextWaves} waves)`, 400, 400);
            
            // Prompt
            this.levelTransitionTimer += 1/60;
            const blink = Math.sin(this.levelTransitionTimer * 4) > 0;
            if (blink) {
                ctx.fillStyle = '#888888';
                ctx.font = '13px monospace';
                ctx.fillText('Press SPACE or click to continue', 400, 460);
            }
            
            ctx.textAlign = 'start';
        }

        if (this.bossBannerTimer > 0) {
            const alpha = Math.min(1, this.bossBannerTimer / 0.4, (2.6 - this.bossBannerTimer) / 0.4);
            const pulse = 1 + Math.sin(performance.now() * 0.015) * 0.08;
            ctx.save();
            ctx.globalAlpha = Math.max(0, alpha);
            // Dramatic gradient background
            const grad = ctx.createLinearGradient(200, 548, 600, 548);
            grad.addColorStop(0, 'rgba(60, 0, 15, 0.9)');
            grad.addColorStop(0.5, 'rgba(100, 0, 20, 0.92)');
            grad.addColorStop(1, 'rgba(60, 0, 15, 0.9)');
            ctx.fillStyle = grad;
            ctx.fillRect(200, 548, 400, 32);
            // Glowing border
            ctx.strokeStyle = `rgba(255, 80, 110, ${0.7 + Math.sin(performance.now() * 0.01) * 0.3})`;
            ctx.lineWidth = 3;
            ctx.strokeRect(200, 548, 400, 32);
            // Pulsing text
            ctx.fillStyle = '#ffaabb';
            ctx.font = `bold ${16 * pulse}px monospace`;
            ctx.textAlign = 'center';
            ctx.shadowColor = '#ff3355';
            ctx.shadowBlur = 20;
            ctx.fillText(this.bossBannerText, 400, 571);
            ctx.restore();
            ctx.textAlign = 'start';
        }

        if (this.perkChoiceActive) {
            ctx.fillStyle = 'rgba(2, 2, 8, 0.9)';
            ctx.fillRect(0, 0, 800, 600);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#00ffcc';
            ctx.font = 'bold 28px monospace';
            ctx.fillText('CHOOSE A PERK', 400, 120);
            ctx.fillStyle = '#aab7c7';
            ctx.font = '13px monospace';
            ctx.fillText('Pick 1 reward to carry into the next level', 400, 150);
            const cards = [110, 310, 510];
            for (let i = 0; i < this.perkOptions.length; i++) {
                const perk = this.perkOptions[i];
                const x = cards[i];
                const y = 210;
                const perkColor = perk.color || '#00f3ff';
                const perkTag = perk.tag || 'BOOST';
                ctx.shadowColor = perkColor;
                ctx.shadowBlur = 12;
                ctx.fillStyle = 'rgba(10, 16, 30, 0.96)';
                ctx.strokeStyle = `${perkColor}88`;
                ctx.lineWidth = 2;
                ctx.fillRect(x, y, 180, 150);
                ctx.strokeRect(x, y, 180, 150);
                ctx.shadowBlur = 0;

                ctx.fillStyle = `${perkColor}22`;
                ctx.fillRect(x + 1, y + 1, 178, 24);
                ctx.fillStyle = perkColor;
                ctx.font = 'bold 10px monospace';
                ctx.fillText(perkTag, x + 90, y + 17);

                ctx.fillStyle = perkColor;
                ctx.font = 'bold 14px monospace';
                ctx.fillText(`${i + 1}. ${perk.name}`, x + 90, y + 46);
                ctx.fillStyle = '#d9e6f2';
                ctx.font = '12px monospace';
                const words = perk.desc.split(' ');
                let line = '';
                let cy = y + 82;
                for (const word of words) {
                    const test = line ? `${line} ${word}` : word;
                    if (ctx.measureText(test).width > 150) {
                        ctx.fillText(line, x + 90, cy);
                        line = word;
                        cy += 18;
                    } else {
                        line = test;
                    }
                }
                if (line) ctx.fillText(line, x + 90, cy);
            }
            ctx.fillStyle = '#778899';
            ctx.font = '12px monospace';
            ctx.fillText('Press 1 / 2 / 3 or click a card', 400, 405);
            ctx.textAlign = 'start';
        }

        // FPS counter (outside of shake transform)
        if (this.showFPS) {
            ctx.fillStyle = '#00f3ff';
            ctx.font = '14px monospace';
            ctx.fillText(`FPS: ${this.currentFPS}`, 10, 25);
        }
    },

    loop(timestamp) {
        // Calculate delta time with proper capping
        const rawDelta = timestamp - this.lastTime;
        const dt = Math.min(rawDelta / 1000, 1/30); // Cap at 30fps minimum (33.33ms max)
        this.lastTime = timestamp;
        
        // FPS tracking
        this.fpsCounter++;
        this.fpsTimer += rawDelta;
        if (this.fpsTimer >= 1000) {
            this.currentFPS = Math.round(this.fpsCounter * 1000 / this.fpsTimer);
            this.fpsCounter = 0;
            this.fpsTimer = 0;
        }
        
        // Fixed timestep accumulator for stable 60fps updates
        this.frameAccumulator += rawDelta;
        
        // Process updates in fixed timesteps
        while (this.frameAccumulator >= this.fixedTimeStep) {
            this.update(this.fixedTimeStep / 1000);
            this.frameAccumulator -= this.fixedTimeStep;
        }
        
        // Always draw at display refresh rate
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    },
    
    // Toggle FPS display (for debugging)
    toggleFPSDisplay() {
        this.showFPS = !this.showFPS;
    }
};

// Start
game.init();
