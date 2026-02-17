// Main game controller
const game = {
    canvas: null,
    ctx: null,
    state: 'menu', // menu, playing, gameover
    gold: 200,
    lives: 20,
    score: 0,
    speed: 1,
    selectedTower: null,
    selectedPlacedTower: null,
    towers: [],
    enemies: [],
    shakeTimer: 0,
    shakeIntensity: 0,
    lastTime: 0,
    mouseX: 0,
    mouseY: 0,
    traps: [],
    _floatingTexts: [],
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

        // Mouse tracking
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        });

        this.canvas.addEventListener('click', (e) => {
            if (this.levelTransition) {
                this._confirmLevelAdvance();
                return;
            }
            if (this.state !== 'playing') return;
            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
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
            if (this.state !== 'playing') return;
            if (e.key === '1') this.selectTower('blaster');
            else if (e.key === '2') this.selectTower('sniper');
            else if (e.key === '3') this.selectTower('aoe');
            else if (e.key === '4') this.selectTower('boat');
            else if (e.key === '5') this.selectTower('mine');
            else if (e.key === '6') this.selectTower('poison');
            else if (e.key === '7') this.selectTower('ice');
            else if (e.key === '8') this.selectTower('sentinel');
            else if (e.key === '9') this.selectFortification('barricade');
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
        this.selectedTower = null;
        this.selectedPlacedTower = null;
        this.shakeTimer = 0;
        this.wavesStacked = 0;
        this.levelTransition = false;
        this.levelStats = null;
        ParticlePool.active = [];
        ProjectilePool.active = [];
        ProjectilePool.rings = [];
        WaveManager.reset();
        Fortification.reset();
        SentinelManager.reset();
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
        this.levelTransition = false;
        this.levelStats = null;
        try { this.__doAdvanceLevel(); } catch(e) { console.error('Level advance error:', e); }
    },
    
    // Waves per level: 5, 10, 15, 20, 20, 20...
    getWavesForLevel(level) {
        return Math.min(20, 5 + (level - 1) * 5);
    },

    __doAdvanceLevel() {
        this.level++;
        
        // Level bonus: +50 gold per level cleared
        const levelBonus = 50 * (this.level - 1);
        this.gold += levelBonus;
        
        // Full reset — new map, clear towers, fresh start
        this.towers = [];
        this.traps = [];
        this.enemies = [];
        this._floatingTexts = [];
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
        if (!Fortification.unlocked && mode === 'wall') {
            this._floatingTexts.push({
                text: 'Walls unlock at level 2!',
                x: 400, y: 280,
                life: 1.5, maxLife: 1.5,
                color: '#ff4444'
            });
            return;
        }
        this.selectedTower = null;
        this.selectedPlacedTower = null;
        this.towers.forEach(tw => tw.selected = false);
        UI.setTowerActive(null);
        
        if (Fortification.placementMode === mode) {
            Fortification.placementMode = null;
            UI.setFortificationActive(null);
        } else {
            Fortification.placementMode = mode;
            UI.setFortificationActive(mode);
        }
    },

    setSpeed(s) {
        this.speed = s;
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`speed${s}`).classList.add('active');
    },

    wavesStacked: 0,

    startWave() {
        // Don't allow early-calling during the last wave of a level — must beat it
        if (WaveManager.waveActive && WaveManager.currentWave >= WaveManager.waves.length - 1 && !WaveManager.endless) {
            return; // Must finish the boss wave naturally
        }
        
        // Reset barricade stock for new wave
        Fortification.onWaveStart();
        
        // No wave cap — stack as many as you dare
        
        if (WaveManager.waveActive) {
            // Early wave! Enemies still alive + still spawning from current wave
            const aliveEnemies = this.enemies.filter(e => e.alive).length;
            const unspawned = WaveManager.spawnQueue.length;
            const totalRemaining = aliveEnemies + unspawned;
            if (totalRemaining > 0) {
                // Bigger bonus when called during spawning (more risk = more reward)
                const bonus = totalRemaining * 5 + (unspawned > 0 ? unspawned * 3 : 0);
                this.gold += bonus;
                this.score += bonus;
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
        UI.updateWavePreview('');
        this.updateUI();
    },

    handleClick(mx, my) {
        const snap = Utils.snapToGrid(mx, my);
        const gridKey = Utils.gridKey(mx, my);
        const gx = Math.floor(mx / Utils.GRID);
        const gy = Math.floor(my / Utils.GRID);

        // Fortification placement
        if (Fortification.placementMode === 'barricade') {
            if (!WaveManager.waveActive) {
                this._floatingTexts.push({
                    text: 'Barricades during waves only!',
                    x: mx, y: my - 15,
                    life: 1, maxLife: 1,
                    color: '#ff4444'
                });
                return;
            }
            if (this.gold < Fortification.BARRICADE_COST) {
                Audio.noMoney();
                return;
            }
            const result = Fortification.placeBarricade(gx, gy);
            if (result.ok) {
                this.gold -= Fortification.BARRICADE_COST;
                Audio.trapPlace();
                this.updateUI();
            } else {
                this._floatingTexts.push({
                    text: result.reason,
                    x: mx, y: my - 15,
                    life: 1, maxLife: 1,
                    color: '#ff4444'
                });
            }
            return;
        }
        
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

    shake(intensity) {
        this.shakeTimer = 0.15;
        this.shakeIntensity = intensity;
    },

    updateUI() {
        UI.updateGold(this.gold);
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
        if (this.state !== 'playing' || this.levelTransition) return;

        const speedMult = this.speed;

        // Spawn enemies
        WaveManager.update(dt, this.enemies, speedMult);

        // Update enemies
        for (const e of this.enemies) {
            e.update(dt, speedMult);
            if (!e.alive && e.reachedEnd) {
                this.lives--;
                e.reachedEnd = false;
                if (this.lives <= 0) {
                    this.setState('gameover');
                    Audio.gameOver();
                    UI.showGameOver(false, this.score, WaveManager.currentWave);
                    return;
                }
                UI.updateLives(this.lives);
            }
            if (!e.alive && !e.scored && !e.reachedEnd) {
                this.gold += e.gold;
                this.score += e.gold;
                e.scored = true;
                Audio.kill();
                ParticlePool.spawn(e.x, e.y, e.color, e.type === 'boss' ? 25 : 10);
                if (e.type === 'boss') {
                    this.shake(5);
                    Audio.bossKill();
                }
                this.updateUI();
            }
        }

        // Clean dead enemies
        this.enemies = this.enemies.filter(e => e.alive || (!e.scored && e.reachedEnd));

        // Update towers
        for (const t of this.towers) {
            t.update(dt, this.enemies, speedMult);
        }

        // Update traps
        for (const trap of this.traps) {
            trap.update(dt, this.enemies, speedMult);
        }
        this.traps = this.traps.filter(t => t.alive);

        // Update fortifications
        Fortification.update(dt, this.enemies, speedMult);

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
            if (!WaveManager.earlyAdvanced) {
                WaveManager.currentWave++;
            }
            WaveManager.earlyAdvanced = false;
            WaveManager.waveActive = false;
            this.wavesStacked = 0;

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

        // Draw fortifications (walls + barricades)
        Fortification.draw(ctx, theme);
        
        // Fortification placement preview
        if (this.state === 'playing' && Fortification.placementMode) {
            Fortification.drawPreview(ctx, this.mouseX, this.mouseY, theme);
        }

        // Tower/trap placement preview
        if (this.state === 'playing' && this.selectedTower && this.selectedTower !== 'sell') {
            const snap = Utils.snapToGrid(this.mouseX, this.mouseY);
            const terrType = Terrain.getType(snap.x, snap.y);
            const isTrap = TrapTypes && TrapTypes[this.selectedTower];
            
            if (isTrap) {
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
                    const canAfford = this.gold >= def.cost;
                    const occupied = this.towers.some(t => Utils.dist(snap.x, snap.y, t.x, t.y) < Utils.GRID * 0.8);
                    const validTerrain = def.water ? (terrType === 'water') : (terrType === 'grass');

                    ctx.globalAlpha = 0.4;
                    ctx.fillStyle = (!validTerrain || occupied || !canAfford) ? '#ff0033' : def.color;
                    ctx.beginPath();
                    ctx.arc(snap.x, snap.y, 12, 0, Math.PI * 2);
                    ctx.fill();

                    // Range preview (skip for sentinel — no range)
                    if (def.range > 0) {
                        ctx.beginPath();
                        ctx.arc(snap.x, snap.y, def.range, 0, Math.PI * 2);
                        ctx.strokeStyle = `${def.color}33`;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                    ctx.globalAlpha = 1;
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
            
            // Position tooltip above tower, within bounds
            let tx = t.x;
            let ty = t.y - 40;
            
            // Clamp x position to keep box on screen
            tx = Math.max(boxW / 2 + 10, Math.min(800 - boxW / 2 - 10, tx));
            // If too close to top, show below tower
            if (ty - boxH < 10) ty = t.y + 30;
            const bx = tx - boxW / 2;
            const by = ty - boxH;
            
            // Background with rounded feel
            ctx.fillStyle = 'rgba(5, 5, 20, 0.92)';
            ctx.strokeStyle = t.color;
            ctx.lineWidth = 1.5;
            ctx.fillRect(bx, by, boxW, boxH);
            ctx.strokeRect(bx, by, boxW, boxH);
            
            // Accent line at top
            ctx.fillStyle = t.color;
            ctx.fillRect(bx + 1, by + 1, boxW - 2, 2);
            
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
