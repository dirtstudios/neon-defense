// Fortification System — Walls (maze building) + Barricades (tactical speed bumps)
const Fortification = {
    walls: [],       // { gx, gy, hp, maxHp } — placed on empty tiles to redirect path
    barricades: [],  // { gx, gy, hp, maxHp, x, y } — placed ON path during waves
    
    // Wall config
    WALL_BASE_HP: 50,
    WALL_HP_PER_LEVEL: 15,
    WALL_COST: 20,
    WALL_REPAIR_COST: 5,
    
    // Barricade config
    BARRICADE_HP: 30,
    BARRICADE_COST: 10,
    BARRICADES_PER_WAVE: 5,
    barricadesRemaining: 0,
    
    // BFS pathfinding grid
    GRID_W: 80,  // 800 / 10
    GRID_H: 60,  // 600 / 10
    
    // Mode: 'wall' or 'barricade' or null
    placementMode: null,
    
    // Cached BFS path (array of {gx, gy} grid cells)
    _bfsPath: null,
    _bfsBlocked: null, // Set of "gx,gy" wall cells
    
    unlocked: false, // Walls unlock at level 2
    
    init() {
        this.walls = [];
        this.barricades = [];
        this.barricadesRemaining = 0;
        this._bfsPath = null;
        this._bfsBlocked = null;
        this.placementMode = null;
        this.unlocked = false;
    },
    
    reset() {
        this.walls = [];
        this._wallKeys.clear();
        this.barricades = [];
        this.barricadesRemaining = 0;
        this._bfsPath = null;
        this._bfsBlocked = null;
        this.placementMode = null;
    },
    
    onLevelStart(level) {
        this.unlocked = level >= 2;
        this.barricades = [];
        this.barricadesRemaining = this.BARRICADES_PER_WAVE;
        // Walls persist across waves but not levels (new map each level)
        this.walls = [];
        this._bfsPath = null;
        this._bfsBlocked = null;
    },
    
    onWaveStart() {
        // Add new stock but keep unused from previous wave (cap at 10)
        this.barricadesRemaining = Math.min(10, this.barricadesRemaining + this.BARRICADES_PER_WAVE);
    },
    
    getWallMaxHp(level) {
        return this.WALL_BASE_HP + (level || 1) * this.WALL_HP_PER_LEVEL;
    },
    
    // Get set of wall grid keys for quick lookup
    getWallSet() {
        const s = new Set();
        for (const w of this.walls) s.add(`${w.gx},${w.gy}`);
        return s;
    },
    
    // Wall lookup set for O(1) checks
    _wallKeys: new Set(),
    _rebuildWallKeys() {
        this._wallKeys.clear();
        for (const w of this.walls) this._wallKeys.add(`${w.gx},${w.gy}`);
    },
    
    // Check if a grid cell has a wall
    hasWall(gx, gy) {
        return this._wallKeys.has(`${gx},${gy}`);
    },
    
    // Check if a grid cell has a barricade
    getBarricade(gx, gy) {
        return this.barricades.find(b => b.gx === gx && b.gy === gy && b.hp > 0);
    },
    
    // Try to place a wall at grid position
    placeWall(gx, gy, level) {
        if (!this.unlocked) return { ok: false, reason: 'Walls unlock at level 2' };
        if (gx < 1 || gx >= this.GRID_W - 1 || gy < 1 || gy >= this.GRID_H - 1) {
            return { ok: false, reason: 'Out of bounds' };
        }
        
        // Can't place on path
        const pathBlocked = Path.getBlocked();
        if (pathBlocked.has(`${gx},${gy}`)) {
            return { ok: false, reason: 'Cannot place on path' };
        }
        
        // Can't place on existing wall
        if (this.hasWall(gx, gy)) {
            return { ok: false, reason: 'Wall already here' };
        }
        
        // Can't place on tower
        const cx = gx * Utils.GRID + Utils.GRID / 2;
        const cy = gy * Utils.GRID + Utils.GRID / 2;
        for (const t of game.towers) {
            if (Utils.dist(cx, cy, t.x, t.y) < Utils.GRID * 2) {
                return { ok: false, reason: 'Tower in the way' };
            }
        }
        
        // Can't place on water
        if (Path.isWater(cx, cy)) {
            return { ok: false, reason: 'Cannot build on water' };
        }
        
        const maxHp = this.getWallMaxHp(level);
        this.walls.push({ gx, gy, hp: maxHp, maxHp });
        this._wallKeys.add(`${gx},${gy}`);
        
        // Recalculate enemy paths
        this._recalcEnemyPaths();
        
        return { ok: true };
    },
    
    // Remove a wall (when destroyed by enemies)
    removeWall(wall) {
        const idx = this.walls.indexOf(wall);
        if (idx >= 0) {
            this._wallKeys.delete(`${wall.gx},${wall.gy}`);
            this.walls.splice(idx, 1);
            this._recalcEnemyPaths();
        }
    },
    
    // Repair a wall
    repairWall(gx, gy, level) {
        const wall = this.walls.find(w => w.gx === gx && w.gy === gy);
        if (!wall) return { ok: false, reason: 'No wall here' };
        if (wall.hp >= wall.maxHp) return { ok: false, reason: 'Wall at full HP' };
        
        wall.hp = Math.min(wall.maxHp, wall.hp + wall.maxHp * 0.4); // Repair 40%
        return { ok: true };
    },
    
    // Place barricade on path during wave
    placeBarricade(gx, gy) {
        if (this.barricadesRemaining <= 0) {
            return { ok: false, reason: 'No barricades left this wave' };
        }
        
        // Must be on the path
        const pathBlocked = Path.getBlocked();
        if (!pathBlocked.has(`${gx},${gy}`)) {
            return { ok: false, reason: 'Must place on path' };
        }
        
        // Can't stack barricades
        if (this.getBarricade(gx, gy)) {
            return { ok: false, reason: 'Barricade already here' };
        }
        
        const cx = gx * Utils.GRID + Utils.GRID / 2;
        const cy = gy * Utils.GRID + Utils.GRID / 2;
        
        this.barricades.push({
            gx, gy,
            x: cx, y: cy,
            hp: this.BARRICADE_HP,
            maxHp: this.BARRICADE_HP
        });
        this.barricadesRemaining--;
        
        return { ok: true };
    },
    
    // BFS pathfinding — validates that entry can reach exit
    // Uses the path's entry/exit points
    _validatePath(wallSet) {
        const entry = Path.points[0];
        const exit = Path.points[Path.points.length - 1];
        
        const startGx = Math.floor(Math.max(0, entry.x) / Utils.GRID);
        const startGy = Math.floor(entry.y / Utils.GRID);
        const endGx = Math.floor(Math.min(799, exit.x) / Utils.GRID);
        const endGy = Math.floor(exit.y / Utils.GRID);
        
        // BFS from start to end
        const visited = new Set();
        const queue = [[startGx, startGy]];
        visited.add(`${startGx},${startGy}`);
        
        // Include path cells as walkable + any non-wall non-water cell adjacent to path
        const pathCells = Path.getBlocked();
        
        while (queue.length > 0) {
            const [cx, cy] = queue.shift();
            
            // Check if reached exit (within 2 cells)
            if (Math.abs(cx - endGx) <= 2 && Math.abs(cy - endGy) <= 2) {
                return true;
            }
            
            // Check 4 neighbors
            const neighbors = [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]];
            for (const [nx, ny] of neighbors) {
                if (nx < -1 || nx > this.GRID_W || ny < -1 || ny > this.GRID_H) continue;
                const key = `${nx},${ny}`;
                if (visited.has(key)) continue;
                if (wallSet.has(key)) continue; // blocked by wall
                
                // Only walk on path cells (enemies can only walk the path)
                if (!pathCells.has(key)) continue;
                
                visited.add(key);
                queue.push([nx, ny]);
            }
        }
        
        return false;
    },
    
    // Recalculate enemy paths when walls change
    // Since enemies follow the fixed path via pathProgress, walls don't redirect them
    // Instead, walls act as physical blockers that enemies must attack through
    _recalcEnemyPaths() {
        this._bfsBlocked = this.getWallSet();
    },
    
    // Update — handle barricade/wall interactions with enemies
    update(dt, enemies, speedMult) {
        // Barricade interactions: enemies stop and attack barricades
        for (const barricade of this.barricades) {
            if (barricade.hp <= 0) continue;
            
            for (const enemy of enemies) {
                if (!enemy.alive) continue;
                const d = Utils.dist(enemy.x, enemy.y, barricade.x, barricade.y);
                if (d < Utils.GRID * 2) {
                    // Enemy is at barricade — stop and attack it
                    if (!enemy._attackingBarricade) {
                        enemy._attackingBarricade = barricade;
                        enemy._barricadeAttackTimer = 0;
                    }
                }
            }
        }
        
        // Wall interactions: breaker enemies (tank, boss) attack adjacent walls
        for (const wall of this.walls) {
            if (wall.hp <= 0) continue;
            
            const wcx = wall.gx * Utils.GRID + Utils.GRID / 2;
            const wcy = wall.gy * Utils.GRID + Utils.GRID / 2;
            
            for (const enemy of enemies) {
                if (!enemy.alive) continue;
                // Only tanks and bosses break walls
                if (enemy.type !== 'tank' && enemy.type !== 'boss') continue;
                
                const d = Utils.dist(enemy.x, enemy.y, wcx, wcy);
                if (d < Utils.GRID * 3) {
                    // Attack the wall
                    if (!enemy._attackingWall) {
                        enemy._attackingWall = wall;
                        enemy._wallAttackTimer = 0;
                    }
                }
            }
        }
        
        // Process enemy attacks on barricades
        for (const enemy of enemies) {
            if (!enemy.alive) continue;
            
            // Barricade attack
            if (enemy._attackingBarricade) {
                const b = enemy._attackingBarricade;
                if (b.hp <= 0) {
                    enemy._attackingBarricade = null;
                    continue;
                }
                
                const d = Utils.dist(enemy.x, enemy.y, b.x, b.y);
                if (d > Utils.GRID * 3) {
                    enemy._attackingBarricade = null;
                    continue;
                }
                
                // Stop enemy movement (handled in enemy.update via flag)
                enemy._stoppedByBarricade = true;
                
                enemy._barricadeAttackTimer = (enemy._barricadeAttackTimer || 0) + dt * speedMult;
                if (enemy._barricadeAttackTimer >= 0.5) { // Attack every 0.5s
                    enemy._barricadeAttackTimer = 0;
                    const dmg = enemy.type === 'boss' ? 15 : (enemy.type === 'tank' ? 8 : 5);
                    b.hp -= dmg;
                    
                    // Particle effect
                    ParticlePool.spawn(b.x, b.y, '#ffaa00', 3);
                    
                    if (b.hp <= 0) {
                        enemy._attackingBarricade = null;
                        enemy._stoppedByBarricade = false;
                    }
                }
            } else {
                enemy._stoppedByBarricade = false;
            }
            
            // Wall attack (tanks and bosses only)
            if (enemy._attackingWall) {
                const w = enemy._attackingWall;
                if (w.hp <= 0) {
                    enemy._attackingWall = null;
                    continue;
                }
                
                const wcx = w.gx * Utils.GRID + Utils.GRID / 2;
                const wcy = w.gy * Utils.GRID + Utils.GRID / 2;
                const d = Utils.dist(enemy.x, enemy.y, wcx, wcy);
                if (d > Utils.GRID * 4) {
                    enemy._attackingWall = null;
                    continue;
                }
                
                enemy._wallAttackTimer = (enemy._wallAttackTimer || 0) + dt * speedMult;
                if (enemy._wallAttackTimer >= 0.8) { // Attack wall every 0.8s
                    enemy._wallAttackTimer = 0;
                    const dmg = enemy.type === 'boss' ? 25 : 12;
                    w.hp -= dmg;
                    
                    const wcx2 = w.gx * Utils.GRID + Utils.GRID / 2;
                    const wcy2 = w.gy * Utils.GRID + Utils.GRID / 2;
                    ParticlePool.spawn(wcx2, wcy2, '#ff4400', 5);
                    
                    if (w.hp <= 0) {
                        this.removeWall(w);
                        enemy._attackingWall = null;
                        
                        // Floating text
                        game._floatingTexts.push({
                            text: '💥 WALL DESTROYED',
                            x: wcx2, y: wcy2 - 10,
                            life: 1.5, maxLife: 1.5,
                            color: '#ff4400'
                        });
                    }
                }
            }
        }
        
        // Clean dead barricades
        this.barricades = this.barricades.filter(b => b.hp > 0);
    },
    
    // Draw walls and barricades
    draw(ctx, theme) {
        const pathColor = theme ? theme.path : 'rgba(0, 243, 255,';
        
        // Draw walls
        for (const wall of this.walls) {
            const x = wall.gx * Utils.GRID;
            const y = wall.gy * Utils.GRID;
            const s = Utils.GRID;
            
            const hpRatio = wall.hp / wall.maxHp;
            
            // Wall body
            if (hpRatio > 0.6) {
                ctx.fillStyle = pathColor + '0.4)';
            } else if (hpRatio > 0.3) {
                ctx.fillStyle = 'rgba(255, 170, 0, 0.4)';
            } else {
                ctx.fillStyle = 'rgba(255, 50, 0, 0.4)';
            }
            ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
            
            // Wall border
            ctx.strokeStyle = pathColor + '0.6)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
            
            // HP bar (only if damaged)
            if (hpRatio < 1) {
                const barW = s - 2;
                const barH = 2;
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(x + 1, y + s - 3, barW, barH);
                ctx.fillStyle = hpRatio > 0.3 ? '#00ff66' : '#ff3333';
                ctx.fillRect(x + 1, y + s - 3, barW * hpRatio, barH);
            }
        }
        
        // Draw barricades
        for (const b of this.barricades) {
            if (b.hp <= 0) continue;
            
            const hpRatio = b.hp / b.maxHp;
            
            // Barricade — spiky/crossed look
            ctx.save();
            ctx.translate(b.x, b.y);
            
            // Glow
            ctx.shadowColor = '#ffaa00';
            ctx.shadowBlur = 6;
            
            // X shape
            const sz = Utils.GRID * 0.4;
            ctx.strokeStyle = hpRatio > 0.5 ? '#ffaa00' : '#ff4400';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-sz, -sz); ctx.lineTo(sz, sz);
            ctx.moveTo(sz, -sz); ctx.lineTo(-sz, sz);
            ctx.stroke();
            
            // Center dot
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(0, 0, 2, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.shadowBlur = 0;
            ctx.restore();
            
            // HP bar
            if (hpRatio < 1) {
                const barW = Utils.GRID;
                const barH = 2;
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(b.x - barW/2, b.y - Utils.GRID * 0.6, barW, barH);
                ctx.fillStyle = hpRatio > 0.3 ? '#ffaa00' : '#ff3333';
                ctx.fillRect(b.x - barW/2, b.y - Utils.GRID * 0.6, barW * hpRatio, barH);
            }
        }
    },
    
    // Draw placement preview
    drawPreview(ctx, mx, my, theme) {
        if (!this.placementMode) return;
        
        const gx = Math.floor(mx / Utils.GRID);
        const gy = Math.floor(my / Utils.GRID);
        const x = gx * Utils.GRID;
        const y = gy * Utils.GRID;
        const s = Utils.GRID;
        const pathColor = theme ? theme.path : 'rgba(0, 243, 255,';
        
        if (this.placementMode === 'wall') {
            // Check validity
            const pathBlocked = Path.getBlocked();
            const onPath = pathBlocked.has(`${gx},${gy}`);
            const hasW = this.hasWall(gx, gy);
            const onWater = Path.isWater(gx * Utils.GRID + Utils.GRID/2, gy * Utils.GRID + Utils.GRID/2);
            const valid = !onPath && !hasW && !onWater && gx >= 1 && gx < this.GRID_W - 1 && gy >= 1 && gy < this.GRID_H - 1;
            
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = valid ? pathColor + '0.5)' : 'rgba(255, 0, 50, 0.5)';
            ctx.fillRect(x, y, s, s);
            ctx.strokeStyle = valid ? pathColor + '0.8)' : 'rgba(255, 0, 50, 0.8)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, s, s);
            ctx.globalAlpha = 1;
        } else if (this.placementMode === 'barricade') {
            const pathBlocked = Path.getBlocked();
            const onPath = pathBlocked.has(`${gx},${gy}`);
            const hasB = !!this.getBarricade(gx, gy);
            const valid = onPath && !hasB && this.barricadesRemaining > 0;
            
            ctx.globalAlpha = 0.4;
            const cx = gx * Utils.GRID + Utils.GRID / 2;
            const cy = gy * Utils.GRID + Utils.GRID / 2;
            const sz = Utils.GRID * 0.4;
            
            ctx.strokeStyle = valid ? '#ffaa00' : '#ff0033';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx - sz, cy - sz); ctx.lineTo(cx + sz, cy + sz);
            ctx.moveTo(cx + sz, cy - sz); ctx.lineTo(cx - sz, cy + sz);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }
};
