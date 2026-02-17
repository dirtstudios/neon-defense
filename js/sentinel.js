// Sentinel System — Kingdom Rush-style soldier units spawned by Sentinel towers
// Sentinels walk to a rally point on the path and block enemies in melee combat

const SentinelManager = {
    sentinels: [], // All active sentinels across all sentinel towers
    
    // Enemy damage dealt TO sentinels (per second)
    ENEMY_DPS: {
        basic: 3,
        fast: 2,
        tank: 8,
        shield: 4,
        swarm: 1,
        healer: 2,
        stealth: 3,
        boss: 15
    },
    
    reset() {
        this.sentinels = [];
    },
    
    // Create a sentinel for a tower
    spawnSentinel(tower, index) {
        const rally = tower.rallyPoint || this._defaultRally(tower);
        // Offset sentinels slightly so they don't stack
        const offsetAngle = (index / (tower.maxSentinels || 2)) * Math.PI * 2;
        const offsetDist = 8;
        
        return {
            tower: tower,
            x: tower.x,
            y: tower.y,
            targetX: rally.x + Math.cos(offsetAngle) * offsetDist,
            targetY: rally.y + Math.sin(offsetAngle) * offsetDist,
            hp: tower.sentinelHp,
            maxHp: tower.sentinelHp,
            damage: tower.sentinelDmg,
            dmgReduction: tower.sentinelDmgReduction || 0,
            alive: true,
            respawnTimer: 0,
            respawnTime: tower.sentinelRespawn,
            engagedEnemy: null,
            index: index,
            // Movement
            speed: 80, // pixels per second
            atRally: false
        };
    },
    
    _defaultRally(tower) {
        // Find nearest path point to tower
        let bestDist = Infinity;
        let bestPos = { x: tower.x, y: tower.y + 30 };
        
        const pathBlocked = Path.getBlocked();
        // Sample path at intervals to find closest point
        for (let p = 0; p <= 1; p += 0.02) {
            const pos = Path.getPositionAtProgress(p);
            const d = Utils.dist(tower.x, tower.y, pos.x, pos.y);
            if (d < bestDist) {
                bestDist = d;
                bestPos = { x: pos.x, y: pos.y };
            }
        }
        return bestPos;
    },
    
    // Update all sentinels
    update(dt, enemies, speedMult) {
        for (const s of this.sentinels) {
            if (!s.alive) {
                // Respawn timer
                s.respawnTimer -= dt * speedMult;
                if (s.respawnTimer <= 0) {
                    // Respawn at tower position
                    s.alive = true;
                    s.hp = s.maxHp;
                    s.x = s.tower.x;
                    s.y = s.tower.y;
                    s.engagedEnemy = null;
                    s.atRally = false;
                    // Update target based on current rally
                    const rally = s.tower.rallyPoint || this._defaultRally(s.tower);
                    const offsetAngle = (s.index / (s.tower.maxSentinels || 2)) * Math.PI * 2;
                    s.targetX = rally.x + Math.cos(offsetAngle) * 8;
                    s.targetY = rally.y + Math.sin(offsetAngle) * 8;
                }
                continue;
            }
            
            // If engaged enemy died or left, disengage
            if (s.engagedEnemy && (!s.engagedEnemy.alive || s.engagedEnemy.reachedEnd)) {
                s.engagedEnemy._blockedBySentinel = false;
                s.engagedEnemy = null;
            }
            
            // If not engaged, move toward rally point
            if (!s.engagedEnemy) {
                const dx = s.targetX - s.x;
                const dy = s.targetY - s.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > 3) {
                    const moveSpeed = s.speed * speedMult * dt;
                    s.x += (dx / dist) * Math.min(moveSpeed, dist);
                    s.y += (dy / dist) * Math.min(moveSpeed, dist);
                    s.atRally = false;
                } else {
                    s.atRally = true;
                }
                
                // Look for nearby enemy to engage (within 25px of sentinel)
                let closestEnemy = null;
                let closestDist = 25;
                
                for (const e of enemies) {
                    if (!e.alive || e._blockedBySentinel) continue;
                    const d = Utils.dist(s.x, s.y, e.x, e.y);
                    if (d < closestDist) {
                        closestDist = d;
                        closestEnemy = e;
                    }
                }
                
                if (closestEnemy) {
                    s.engagedEnemy = closestEnemy;
                    closestEnemy._blockedBySentinel = true;
                }
            }
            
            // Combat — sentinel and enemy exchange damage
            if (s.engagedEnemy && s.engagedEnemy.alive) {
                const enemy = s.engagedEnemy;
                
                // Sentinel deals damage to enemy
                const sentinelDmg = s.damage * dt * speedMult;
                enemy.hp -= sentinelDmg;
                if (enemy.hp <= 0) {
                    enemy.hp = 0;
                    enemy.alive = false;
                    enemy._blockedBySentinel = false;
                    s.engagedEnemy = null;
                }
                
                // Enemy deals damage to sentinel
                const enemyDps = this.ENEMY_DPS[enemy.type] || 3;
                const actualDps = enemyDps * (1 - s.dmgReduction);
                s.hp -= actualDps * dt * speedMult;
                
                if (s.hp <= 0) {
                    s.hp = 0;
                    s.alive = false;
                    s.respawnTimer = s.respawnTime;
                    enemy._blockedBySentinel = false;
                    s.engagedEnemy = null;
                    
                    // Death particles
                    ParticlePool.spawn(s.x, s.y, '#00ff88', 8);
                }
                
                // Move sentinel to enemy position (stick to them)
                s.x = Utils.lerp(s.x, enemy.x, 5 * dt);
                s.y = Utils.lerp(s.y, enemy.y, 5 * dt);
            }
        }
    },
    
    // Draw all sentinels
    draw(ctx) {
        for (const s of this.sentinels) {
            // Draw rally point indicator (subtle)
            if (s.index === 0 && s.tower.selected) {
                ctx.beginPath();
                ctx.arc(s.targetX, s.targetY, 12, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Line from tower to rally
                ctx.beginPath();
                ctx.moveTo(s.tower.x, s.tower.y);
                ctx.lineTo(s.targetX, s.targetY);
                ctx.strokeStyle = 'rgba(0, 255, 136, 0.15)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            
            if (!s.alive) {
                // Show respawn indicator at tower
                if (s.respawnTimer > 0) {
                    const progress = 1 - (s.respawnTimer / s.respawnTime);
                    const ax = s.tower.x + (s.index - 0.5) * 12;
                    const ay = s.tower.y + 20;
                    
                    ctx.globalAlpha = 0.3;
                    ctx.beginPath();
                    ctx.arc(ax, ay, 4, 0, Math.PI * 2);
                    ctx.strokeStyle = '#00ff88';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    
                    // Progress arc
                    ctx.beginPath();
                    ctx.arc(ax, ay, 4, -Math.PI/2, -Math.PI/2 + progress * Math.PI * 2);
                    ctx.strokeStyle = '#00ff88';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
                continue;
            }
            
            // Sentinel body — small filled circle
            const engaged = !!s.engagedEnemy;
            
            ctx.shadowColor = '#00ff88';
            ctx.shadowBlur = engaged ? 10 : 5;
            
            ctx.fillStyle = engaged ? '#00ffaa' : '#00ff88';
            ctx.beginPath();
            ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
            ctx.fill();
            
            // Inner dot
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.shadowBlur = 0;
            
            // HP bar
            if (s.hp < s.maxHp) {
                const barW = 12;
                const barH = 2;
                const barX = s.x - barW / 2;
                const barY = s.y - 8;
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(barX, barY, barW, barH);
                const hpRatio = s.hp / s.maxHp;
                ctx.fillStyle = hpRatio > 0.3 ? '#00ff88' : '#ff3333';
                ctx.fillRect(barX, barY, barW * hpRatio, barH);
            }
            
            // Combat flash
            if (engaged) {
                // Small cross/spark at engagement point
                const t = performance.now() / 200;
                if (Math.sin(t) > 0.3) {
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1;
                    ctx.globalAlpha = 0.6;
                    ctx.beginPath();
                    ctx.moveTo(s.x - 3, s.y - 3);
                    ctx.lineTo(s.x + 3, s.y + 3);
                    ctx.moveTo(s.x + 3, s.y - 3);
                    ctx.lineTo(s.x - 3, s.y + 3);
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }
        }
    },
    
    // Register a sentinel tower's units
    registerTower(tower) {
        // Remove any existing sentinels for this tower
        this.unregisterTower(tower);
        
        const count = tower.maxSentinels || 2;
        for (let i = 0; i < count; i++) {
            const s = this.spawnSentinel(tower, i);
            this.sentinels.push(s);
        }
    },
    
    // Remove sentinels when tower is sold/destroyed
    unregisterTower(tower) {
        // Release any engaged enemies
        for (const s of this.sentinels) {
            if (s.tower === tower && s.engagedEnemy) {
                s.engagedEnemy._blockedBySentinel = false;
            }
        }
        this.sentinels = this.sentinels.filter(s => s.tower !== tower);
    },
    
    // Update rally point for a tower's sentinels
    setRallyPoint(tower, x, y) {
        tower.rallyPoint = { x, y };
        const count = tower.maxSentinels || 2;
        for (const s of this.sentinels) {
            if (s.tower !== tower) continue;
            const offsetAngle = (s.index / count) * Math.PI * 2;
            s.targetX = x + Math.cos(offsetAngle) * 8;
            s.targetY = y + Math.sin(offsetAngle) * 8;
            s.atRally = false;
        }
    },
    
    // Handle tower upgrade — re-register with new stats
    onTowerUpgrade(tower) {
        // Update existing sentinels with new stats
        for (const s of this.sentinels) {
            if (s.tower !== tower) continue;
            s.maxHp = tower.sentinelHp;
            s.damage = tower.sentinelDmg;
            s.dmgReduction = tower.sentinelDmgReduction || 0;
            s.respawnTime = tower.sentinelRespawn;
            // Heal on upgrade
            if (s.alive) s.hp = s.maxHp;
        }
        
        // Check if upgrade adds more sentinels
        const currentCount = this.sentinels.filter(s => s.tower === tower).length;
        const targetCount = tower.maxSentinels || 2;
        if (targetCount > currentCount) {
            for (let i = currentCount; i < targetCount; i++) {
                this.sentinels.push(this.spawnSentinel(tower, i));
            }
        }
    }
};
