// Fortification System — Barricades (tactical speed bumps on the path)
const Fortification = {
    barricades: [],  // { gx, gy, hp, maxHp, x, y } — placed ON path during waves
    
    // Barricade config
    BARRICADE_HP: 30,
    BARRICADE_COST: 10,
    BARRICADES_PER_WAVE: 5,
    barricadesRemaining: 0,
    
    // Mode: 'barricade' or null
    placementMode: null,
    
    unlocked: false,
    
    init() {
        this.barricades = [];
        this.barricadesRemaining = 0;
        this.placementMode = null;
        this.unlocked = false;
    },
    
    reset() {
        this.barricades = [];
        this.barricadesRemaining = 0;
        this.placementMode = null;
    },
    
    onLevelStart(level) {
        this.unlocked = level >= 2;
        this.barricades = [];
        this.barricadesRemaining = this.BARRICADES_PER_WAVE;
    },
    
    onWaveStart() {
        // Add new stock but keep unused from previous wave (cap at 10)
        this.barricadesRemaining = Math.min(10, this.barricadesRemaining + this.BARRICADES_PER_WAVE);
    },
    
    // Check if a grid cell has a barricade
    getBarricade(gx, gy) {
        return this.barricades.find(b => b.gx === gx && b.gy === gy && b.hp > 0);
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
    
    // Update — handle barricade interactions with enemies
    update(dt, enemies, speedMult) {
        for (const barricade of this.barricades) {
            if (barricade.hp <= 0) continue;
            
            for (const enemy of enemies) {
                if (!enemy.alive) continue;
                const d = Utils.dist(enemy.x, enemy.y, barricade.x, barricade.y);
                if (d < Utils.GRID * 2) {
                    if (!enemy._attackingBarricade) {
                        enemy._attackingBarricade = barricade;
                        enemy._barricadeAttackTimer = 0;
                    }
                }
            }
        }
        
        // Process enemy attacks on barricades
        for (const enemy of enemies) {
            if (!enemy.alive) continue;
            
            if (enemy._attackingBarricade) {
                const b = enemy._attackingBarricade;
                if (b.hp <= 0) {
                    enemy._attackingBarricade = null;
                    enemy._stoppedByBarricade = false;
                    continue;
                }
                
                const d = Utils.dist(enemy.x, enemy.y, b.x, b.y);
                if (d > Utils.GRID * 3) {
                    enemy._attackingBarricade = null;
                    enemy._stoppedByBarricade = false;
                    continue;
                }
                
                enemy._stoppedByBarricade = true;
                
                enemy._barricadeAttackTimer = (enemy._barricadeAttackTimer || 0) + dt * speedMult;
                if (enemy._barricadeAttackTimer >= 0.5) {
                    enemy._barricadeAttackTimer = 0;
                    const dmg = enemy.type === 'boss' ? 15 : (enemy.type === 'tank' ? 8 : 5);
                    b.hp -= dmg;
                    
                    ParticlePool.spawn(b.x, b.y, '#ffaa00', 3);
                    
                    if (b.hp <= 0) {
                        enemy._attackingBarricade = null;
                        enemy._stoppedByBarricade = false;
                    }
                }
            } else {
                enemy._stoppedByBarricade = false;
            }
        }
        
        // Clean dead barricades
        this.barricades = this.barricades.filter(b => b.hp > 0);
    },
    
    // Draw barricades
    draw(ctx, theme) {
        for (const b of this.barricades) {
            if (b.hp <= 0) continue;
            
            const hpRatio = b.hp / b.maxHp;
            
            ctx.save();
            ctx.translate(b.x, b.y);
            
            ctx.shadowColor = '#ffaa00';
            ctx.shadowBlur = 6;
            
            const sz = Utils.GRID * 0.4;
            ctx.strokeStyle = hpRatio > 0.5 ? '#ffaa00' : '#ff4400';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-sz, -sz); ctx.lineTo(sz, sz);
            ctx.moveTo(sz, -sz); ctx.lineTo(-sz, sz);
            ctx.stroke();
            
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(0, 0, 2, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.shadowBlur = 0;
            ctx.restore();
            
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
        if (this.placementMode !== 'barricade') return;
        
        const gx = Math.floor(mx / Utils.GRID);
        const gy = Math.floor(my / Utils.GRID);
        
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
};
