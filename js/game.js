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
        
        // Generate first map
        this.mapInfo = Path.generate();
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
            else if (e.key === 'Escape') { this.selectedTower = null; this.selectedPlacedTower = null; this.towers.forEach(tw => tw.selected = false); UI.setTowerActive(null); }
        });

        UI.showMenu();
        this.loop(0);
    },

    startGame() {
        if (this.state !== 'menu') return;
        Audio.init();
        this.reset();
        this.setState('playing');
        UI.hideMenu();
        this.updateUI();
    },
    
    rerollMap() {
        this.mapInfo = Path.generate();
        this._updateMapDisplay();
        // Redraw preview
        if (this.state === 'menu') {
            this.draw();
        }
    },
    
    loadSeed() {
        const input = document.getElementById('seed-input');
        const val = parseInt(input.value, 10);
        if (!isNaN(val) && val > 0) {
            this.mapInfo = Path.generate(val);
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
        ParticlePool.active = [];
        ProjectilePool.active = [];
        ProjectilePool.rings = [];
        WaveManager.reset();
    },

    restart() {
        if (this.state !== 'gameover') return;
        this.level = 1;
        this.mapInfo = Path.generate(this.mapInfo.seed);
        this.reset();
        this.setState('playing');
        document.getElementById('game-over-screen').style.display = 'none';
        this.updateUI();
    },
    
    restartNewMap() {
        if (this.state !== 'gameover') return;
        this.level = 1;
        this.mapInfo = Path.generate();
        this.reset();
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
    
    __doAdvanceLevel() {
        this.level++;
        
        // Save old blocked cells to detect new path zones
        const oldBlocked = new Set(Path.getBlocked());
        
        // EXTEND path instead of replacing — towers persist!
        Path.extend(this.level * 7919); // deterministic seed per level
        
        // Auto-sell towers that now overlap with new path (100% refund)
        const newBlocked = Path.getBlocked();
        const towersToRemove = [];
        for (const t of this.towers) {
            const gx = Math.floor(t.x / Utils.GRID);
            const gy = Math.floor(t.y / Utils.GRID);
            const key = `${gx},${gy}`;
            if (newBlocked.has(key) && !oldBlocked.has(key)) {
                this.gold += t.sellValue || 0;
                towersToRemove.push(t);
            }
        }
        for (const t of towersToRemove) {
            this.towers = this.towers.filter(tw => tw !== t);
        }
        
        // Clear enemies, projectiles, particles (but NOT towers)
        this.enemies = [];
        this._floatingTexts = [];
        ParticlePool.active = [];
        ProjectilePool.active = [];
        ProjectilePool.rings = [];
        
        // Remove dead traps
        this.traps = this.traps.filter(t => t.alive);
        
        this._updateMapDisplay();
        
        // Reset wave manager for new level (scale difficulty)
        WaveManager.currentWave = 0;
        WaveManager.waveActive = false;
        WaveManager.spawnQueue = [];
        WaveManager.endless = false;
        WaveManager.currentLevel = this.level;
        WaveManager.levelScale = 1 + (this.level - 1) * 0.5;
        
        // Level transition floating text
        const theme = this.getCurrentTheme();
        this._floatingTexts.push({
            text: `LEVEL ${this.level} — ${theme.name.toUpperCase()}`,
            x: 400, y: 240,
            life: 4, maxLife: 4,
            color: '#ffffff'
        });
        this._floatingTexts.push({
            text: 'PATH EXTENDED — TOWERS PERSIST',
            x: 400, y: 270,
            life: 4, maxLife: 4,
            color: '#00ff66'
        });
        if (towersToRemove.length > 0) {
            const refund = towersToRemove.reduce((sum, t) => sum + (t.sellValue || 0), 0);
            this._floatingTexts.push({
                text: `${towersToRemove.length} tower${towersToRemove.length > 1 ? 's' : ''} relocated (+${refund}💰)`,
                x: 400, y: 300,
                life: 4, maxLife: 4,
                color: '#ffdd00'
            });
        }
        this._floatingTexts.push({
            text: 'Place towers, then press SPACE',
            x: 400, y: 330,
            life: 5, maxLife: 5,
            color: '#888888'
        });
        
        Audio.levelUp();
        this.updateUI();
    },

    backToMenu() {
        this.level = 1;
        this.reset();
        this.mapInfo = Path.generate();
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
        if (type === this.selectedTower) {
            this.selectedTower = null;
            UI.setTowerActive(null);
        } else {
            this.selectedTower = type;
            this.selectedPlacedTower = null;
            UI.setTowerActive(type);
        }
    },

    setSpeed(s) {
        this.speed = s;
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`speed${s}`).classList.add('active');
    },

    startWave() {
        // Allow starting next wave even if current wave enemies still alive
        // But only if spawning is done (no double-spawn)
        if (WaveManager.waveActive && WaveManager.spawnQueue.length > 0) return; // Still spawning
        
        // Don't allow early-calling during the last wave of a level — must beat it
        if (WaveManager.waveActive && WaveManager.currentWave >= WaveManager.waves.length - 1 && !WaveManager.endless) {
            return; // Must finish the boss wave naturally
        }
        
        if (WaveManager.waveActive) {
            // Early wave! Enemies still alive from current wave
            const aliveEnemies = this.enemies.filter(e => e.alive).length;
            if (aliveEnemies > 0) {
                const bonus = aliveEnemies * 5;
                this.gold += bonus;
                this.score += bonus;
                this._floatingTexts.push({
                    text: `+${bonus}💰 EARLY WAVE!`,
                    x: 400, y: 280,
                    life: 1.5, maxLife: 1.5,
                    color: '#ffdd00'
                });
                Audio.earlyWave();
            }
            // Advance wave counter, start next
            WaveManager.currentWave++;
            WaveManager.waveActive = false;
        }
        
        WaveManager.startWave();
        Audio.waveStart();
        UI.updateWavePreview('');
        this.updateUI();
    },

    handleClick(mx, my) {
        const snap = Utils.snapToGrid(mx, my);
        const gridKey = Utils.gridKey(mx, my);

        // Check if clicking existing tower
        for (const t of this.towers) {
            if (Utils.dist(mx, my, t.x, t.y) < 20) {
                if (this.selectedTower === 'sell') {
                    // Sell tower
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

            // Check not on path
            if (Path.getBlocked().has(gridKey)) return;

            // Check not on existing tower
            for (const t of this.towers) {
                if (Utils.dist(snap.x, snap.y, t.x, t.y) < 28) return; // min spacing between towers
            }

            // Check bounds
            if (snap.x < 20 || snap.x > 780 || snap.y < 20 || snap.y > 580) return;

            // Check water/land placement
            const onWater = Path.isWater(snap.x, snap.y);
            if (def.water && !onWater) return;  // Boat needs water
            if (def.land && onWater) return;     // Land towers can't go in water

            // Place it
            const tower = createTower(this.selectedTower, snap.x, snap.y);
            this.towers.push(tower);
            this.gold -= def.cost;
            Audio.place();
            this.updateUI();
        }
        
        // Place trap (must be ON the path)
        if (isTrapType) {
            const trapDef = TrapTypes[this.selectedTower];
            if (this.gold < trapDef.cost) {
                Audio.noMoney();
                return;
            }
            
            // Must be on path
            if (!Path.getBlocked().has(gridKey)) return;
            
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
        // Start wave always enabled (early wave for bonus)
        const spawning = WaveManager.waveActive && WaveManager.spawnQueue.length > 0;
        UI.setStartWaveEnabled(!spawning);
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
            WaveManager.currentWave++;
            WaveManager.waveActive = false;

            // Level progression: after wave 5, advance to new level
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

        // Clear (themed background)
        const theme = this.getCurrentTheme();
        ctx.fillStyle = theme.bg;
        ctx.fillRect(-10, -10, 820, 620);

        // Grid (subtle, themed — show every other line slightly brighter)
        ctx.lineWidth = 1;
        for (let x = 0; x <= 800; x += Utils.GRID) {
            ctx.strokeStyle = (x % 40 === 0) ? theme.path + '0.04)' : theme.path + '0.02)';
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 600); ctx.stroke();
        }
        for (let y = 0; y <= 600; y += Utils.GRID) {
            ctx.strokeStyle = (y % 40 === 0) ? theme.path + '0.04)' : theme.path + '0.02)';
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(800, y); ctx.stroke();
        }

        // Path (pass theme)
        Path.draw(ctx, theme);

        // Tower/trap placement preview
        if (this.state === 'playing' && this.selectedTower && this.selectedTower !== 'sell') {
            const snap = Utils.snapToGrid(this.mouseX, this.mouseY);
            const gridKey = Utils.gridKey(this.mouseX, this.mouseY);
            const onPath = Path.getBlocked().has(gridKey);
            const isTrap = TrapTypes && TrapTypes[this.selectedTower];
            
            if (isTrap) {
                // Trap preview — must be ON path
                const trapDef = TrapTypes[this.selectedTower];
                const canAfford = this.gold >= trapDef.cost;
                const occupied = this.traps.some(t => t.alive && Utils.dist(snap.x, snap.y, t.x, t.y) < Utils.GRID * 0.6);
                const valid = onPath && canAfford && !occupied;
                
                ctx.globalAlpha = 0.4;
                ctx.fillStyle = valid ? trapDef.color : '#ff0033';
                ctx.beginPath();
                ctx.arc(snap.x, snap.y, 8, 0, Math.PI * 2);
                ctx.fill();
                
                // Radius preview
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
                    const onWater = Path.isWater(snap.x, snap.y);
                    const wrongTerrain = (def.water && !onWater) || (def.land && onWater);

                    ctx.globalAlpha = 0.4;
                    ctx.fillStyle = (onPath || occupied || !canAfford || wrongTerrain) ? '#ff0033' : def.color;
                    ctx.beginPath();
                    ctx.arc(snap.x, snap.y, 12, 0, Math.PI * 2);
                    ctx.fill();

                    // Range preview
                    ctx.beginPath();
                    ctx.arc(snap.x, snap.y, def.range, 0, Math.PI * 2);
                    ctx.strokeStyle = `${def.color}33`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
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
            const upgradeW = upgradeText ? ctx.measureText(upgradeText).width : 0;
            
            const padding = 20;
            const boxW = Math.max(nameW, statsW, sellW, upgradeW) + padding * 2;
            const lineH = 16;
            const lines = upgradeText ? 4 : 3;
            const boxH = lines * lineH + 12;
            
            const tx = Utils.clamp(t.x, boxW / 2 + 10, 800 - boxW / 2 - 10);
            const ty = t.y - 40;
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
            ctx.fillText(`Next: Level ${s.level + 1} — ${nextTheme.name}`, 400, 400);
            
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
