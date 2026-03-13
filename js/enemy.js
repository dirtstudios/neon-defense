// Damage type system — towers deal typed damage, enemies have resistances/weaknesses
// Resistance values: 0.5 = takes half damage, 2.0 = takes double, 1.0 = normal
const DamageTypes = {
    blaster: 'kinetic',
    sniper: 'pierce',
    aoe: 'fire',
    boat: 'kinetic',
    sentinel: 'melee'
};

const EnemyTypes = {
    basic:   { hp: 30,  speed: 2,   gold: 10,  color: '#ff0055', size: 8,  shape: 'circle',
               resist: {} }, // no resistances
    fast:    { hp: 20,  speed: 3,   gold: 15,  color: '#ff3388', size: 6,  shape: 'diamond',
               resist: { pierce: 1.5 } }, // weak to snipers (precision hits fast targets)
    tank:    { hp: 100, speed: 1,   gold: 30,  color: '#ff4400', size: 12, shape: 'hexagon',
               resist: { kinetic: 0.5, fire: 1.5 } }, // armored: resists bullets, weak to fire
    shield:  { hp: 60,  speed: 1.8, gold: 20,  color: '#4488ff', size: 9,  shape: 'shield',
               resist: { fire: 0.5, pierce: 2.0 } }, // energy shield: resists fire, weak to pierce
    swarm:   { hp: 12,  speed: 2.5, gold: 5,   color: '#ffaa00', size: 5,  shape: 'circle',
               resist: { pierce: 0.3, fire: 2.0 } }, // tiny: hard to snipe, burns easy
    healer:  { hp: 40,  speed: 1.5, gold: 25,  color: '#44ff88', size: 8,  shape: 'cross',
               resist: { kinetic: 1.5 }, healRadius: 60, healRate: 5 }, // heals nearby enemies
    stealth: { hp: 35,  speed: 2.2, gold: 20,  color: '#8844aa', size: 7,  shape: 'diamond',
               resist: { fire: 0.5, kinetic: 0.7 }, stealth: true }, // partially invisible, resists most
    boss:    { hp: 500, speed: 0.5, gold: 100, color: '#ff0055', size: 18, shape: 'hexagon',
               resist: { kinetic: 0.7, fire: 0.7 }, bossRole: 'titan' },
    broodBoss:{ hp: 420, speed: 0.65, gold: 115, color: '#ff7a22', size: 16, shape: 'circle',
               resist: { kinetic: 0.8, fire: 0.8 }, bossRole: 'brood' },
    warBoss: { hp: 620, speed: 0.42, gold: 130, color: '#c44dff', size: 20, shape: 'shield',
               resist: { kinetic: 0.6, fire: 0.75 }, bossRole: 'war' },
    voidBoss:{ hp: 380, speed: 0.55, gold: 140, color: '#aa44ff', size: 17, shape: 'circle',
               resist: { kinetic: 0.5, fire: 0.5, pierce: 0.5 }, bossRole: 'void', 
               teleportCooldown: 4, lifeDrainRate: 3, lifeDrainRadius: 80 },
    healerBoss:{ hp: 450, speed: 0.48, gold: 150, color: '#44ffaa', size: 18, shape: 'cross',
               resist: { kinetic: 0.6, fire: 0.6, pierce: 0.6 }, bossRole: 'healer',
               healRadius: 120, healRate: 12, healPulseCooldown: 2.5 }
};

function createEnemy(type, waveNum) {
    const def = EnemyTypes[type];
    // Scale HP by wave number AND level progression
    const levelScale = WaveManager.levelScale || 1;
    const hpScale = (1 + waveNum * 0.2) * levelScale;
    const speedScale = 1 + (levelScale - 1) * 0.15; // enemies get slightly faster each level
    const goldScale = Math.max(1, levelScale * 0.8); // gold scales but slightly less than difficulty
    const startPos = Path.getPositionAtProgress(0);
    return {
        type: type,
        x: startPos.x,
        y: startPos.y,
        hp: Math.floor(def.hp * hpScale),
        maxHp: Math.floor(def.hp * hpScale),
        speed: def.speed * speedScale,
        baseSpeed: def.speed * speedScale,
        gold: Math.floor(def.gold * goldScale),
        color: def.color,
        size: def.size,
        shape: def.shape,
        resist: def.resist || {},
        healRadius: def.healRadius || 0,
        healRate: def.healRate || 0,
        healCooldown: 0,
        stealthed: def.stealth || false,
        stealthAlpha: def.stealth ? 0.3 : 1,
        alive: true,
        pathProgress: 0,
        slowed: false,
        slowTimer: 0,
        poisoned: false,
        poisonDamage: 0,
        poisonTimer: 0,
        poisonTick: 0,
        hitFlash: 0,
        critFlash: 0,
        lastDamage: 0,
        bossRole: def.bossRole || null,
        bossSpawnCooldown: def.bossRole ? 3.2 : 0,
        bossPulseCooldown: def.bossRole === 'war' ? 5.5 : 0,
        // Void boss properties
        teleportCooldown: def.teleportCooldown || 0,
        teleportTimer: def.teleportCooldown || 0,
        lifeDrainRate: def.lifeDrainRate || 0,
        lifeDrainRadius: def.lifeDrainRadius || 0,
        lifeDrainTimer: 0,
        originalX: 0,
        originalY: 0,
        bossIntroShown: def.bossRole ? false : true, // show intro when boss spawns

        // Apply resistance to damage based on tower's damage type
        takeDamage(dmg, damageType) {
            const mult = this.resist[damageType] || 1.0;
            const actualDmg = Math.max(1, Math.floor(dmg * mult));
            this.hp -= actualDmg;
            this.hitFlash = 0.12;
            this.lastDamage = actualDmg;
            if (this.hp <= 0) {
                this.hp = 0;
                this.alive = false;
            }
            return actualDmg;
        },

        update(dt, speedMult) {
            if (!this.alive) return;

            if (this.hitFlash > 0) this.hitFlash -= dt;
            if (this.critFlash > 0) this.critFlash -= dt;

            // Slow effect
            if (this.slowed) {
                this.speed = this.baseSpeed * 0.5;
                this.slowTimer -= dt;
                if (this.slowTimer <= 0) {
                    this.slowed = false;
                    this.speed = this.baseSpeed;
                }
            }
            
            // Poison tick
            if (this.poisoned) {
                this.poisonTick -= dt;
                if (this.poisonTick <= 0) {
                    this.takeDamage(this.poisonDamage);
                    this.poisonTick = 0.5; // tick every 0.5s
                }
                this.poisonTimer -= dt;
                if (this.poisonTimer <= 0) {
                    this.poisoned = false;
                }
            }

            // Healer: heal nearby enemies
            if (this.healRadius > 0) {
                this.healCooldown -= dt;
                if (this.healCooldown <= 0) {
                    this.healCooldown = 1; // heal every second
                    const healAmt = Math.floor(this.healRate * levelScale);
                    for (const other of (game.enemies || [])) {
                        if (other === this || !other.alive) continue;
                        if (Utils.dist(this.x, this.y, other.x, other.y) <= this.healRadius) {
                            other.hp = Math.min(other.maxHp, other.hp + healAmt);
                        }
                    }
                }
            }

            // Boss mechanics
            if (this.bossRole && game && game.enemies) {
                // Show boss intro on first spawn
                if (!this.bossIntroShown) {
                    this.bossIntroShown = true;
                    if (game.showBossBanner) {
                        const bossName = this.bossRole === 'brood' ? '🐞 BROOD KING' : 
                                        this.bossRole === 'war' ? '⚔️ WAR TITAN' :
                                        this.bossRole === 'void' ? '👻 VOID WALKER' :
                                        this.bossRole === 'healer' ? '💚 HEALER QUEEN' : '👹 TITAN';
                        game.showBossBanner(bossName + ' APPEARS!');
                        game.shake(8);
                    }
                }
                
                this.bossSpawnCooldown -= dt;
                if (this.bossSpawnCooldown <= 0) {
                    const lowHp = this.hp / this.maxHp < 0.5;
                    this.bossSpawnCooldown = 2.6;
                    const supportType = this.bossRole === 'brood' ? 'swarm' : (lowHp ? 'fast' : 'swarm');
                    const spawnCount = this.bossRole === 'brood' ? (lowHp ? 10 : 6) : (lowHp ? 8 : 4);
                    for (let i = 0; i < spawnCount; i++) {
                        const add = createEnemy(supportType, waveNum);
                        add.pathProgress = Math.max(0, this.pathProgress - 0.018 - i * 0.006);
                        const pos = Path.getPositionAtProgress(add.pathProgress);
                        const side = (i % 2 === 0 ? -1 : 1);
                        const row = Math.floor(i / 2);
                        add.x = pos.x + side * (10 + row * 3);
                        add.y = pos.y + 4 + row * 2;
                        game.enemies.push(add);
                    }
                    ParticlePool.explosion(this.x, this.y, this.bossRole === 'brood' ? '#ffb044' : '#ff8844', false);
                    if (game.showBossBanner) {
                        const text = this.bossRole === 'brood'
                            ? 'BROOD BOSS SPITS A SWARM'
                            : (lowHp ? 'BOSS UNLEASHES A SWARM' : 'BOSS CALLS REINFORCEMENTS');
                        game.showBossBanner(text);
                    }
                }

                if (this.bossRole === 'war') {
                    this.bossPulseCooldown -= dt;
                    if (this.bossPulseCooldown <= 0) {
                        this.bossPulseCooldown = 5.5;
                        ParticlePool.explosion(this.x, this.y, '#c44dff', false);
                        for (const s of (SentinelManager.sentinels || [])) {
                            if (!s.alive) continue;
                            if (Utils.dist(this.x, this.y, s.x, s.y) <= 95) {
                                s.hp = Math.max(0, s.hp - 18);
                                if (s.hp <= 0) {
                                    s.alive = false;
                                    s.respawnTimer = s.respawnTime;
                                    if (s.engagedEnemy) s.engagedEnemy._blockedBySentinel = false;
                                    s.engagedEnemy = null;
                                }
                            }
                        }
                        if (game.showBossBanner) game.showBossBanner('WAR BOSS SHOCKWAVE');
                    }
                }
                
                // VOID BOSS: Teleport + life drain
                if (this.bossRole === 'void') {
                    // Track original spawn position
                    if (this.originalX === 0) {
                        this.originalX = this.x;
                        this.originalY = this.y;
                    }
                    
                    // Teleport periodically
                    this.teleportTimer -= dt;
                    if (this.teleportTimer <= 0) {
                        this.teleportTimer = this.teleportCooldown;
                        // Teleport to a random position ahead on path
                        const teleportProgress = Math.min(0.85, this.pathProgress + 0.15 + Math.random() * 0.1);
                        const newPos = Path.getPositionAtProgress(teleportProgress);
                        this.x = newPos.x;
                        this.y = newPos.y;
                        this.pathProgress = teleportProgress;
                        ParticlePool.explosion(this.x, this.y, '#aa44ff', true);
                        if (game.showBossBanner) game.showBossBanner('👻 VOID PORTAL');
                        if (game.shake) game.shake(4);
                    }
                    
                    // Life drain: heal boss, damage player lives
                    this.lifeDrainTimer -= dt;
                    if (this.lifeDrainTimer <= 0) {
                        this.lifeDrainTimer = 1.5;
                        // Drain from player lives (not towers)
                        if (game && game.lives > 1) {
                            game.lives -= 1;
                            // Heal boss slightly
                            this.hp = Math.min(this.maxHp, this.hp + this.lifeDrainRate * 15);
                            if (game.updateUI) game.updateUI();
                            ParticlePool.explosion(this.x, this.y, '#aa44ff', false);
                        }
                    }
                }
                
                // HEALER BOSS: Healing aura + pulse healing
                if (this.bossRole === 'healer') {
                    this.healPulseCooldown -= dt;
                    if (this.healPulseCooldown <= 0) {
                        this.healPulseCooldown = 2.5;
                        // Heal all nearby enemies in radius
                        if (game && game.enemies) {
                            const healed = [];
                            for (const other of game.enemies) {
                                if (other !== this && other.alive && !other.reachedEnd) {
                                    const dist = Utils.dist(this.x, this.y, other.x, other.y);
                                    if (dist <= this.healRadius) {
                                        const healAmt = Math.floor(this.healRate * 3);
                                        other.hp = Math.min(other.maxHp, other.hp + healAmt);
                                        healed.push({ enemy: other, amount: healAmt });
                                    }
                                }
                            }
                            // Visual pulse effect
                            if (healed.length > 0) {
                                ParticlePool.explosion(this.x, this.y, '#44ffaa', false);
                                if (game.showBossBanner) game.showBossBanner(`💚 HEALER RESTORES ${healed.length} ENEMIES`);
                                if (game.shake) game.shake(3);
                            }
                        }
                    }
                }
            }

            // Move along path using smooth progress
            if (this.pathProgress >= 1) {
                this.alive = false;
                this.reachedEnd = true;
                return;
            }

            // Stopped by barricade or sentinel — don't move
            if (this._stoppedByBarricade || this._blockedBySentinel) return;

            // Calculate movement distance based on speed
            const moveSpeed = this.speed * speedMult * 60 * dt;
            const pathLength = Path.getTotalLength();
            const progressIncrement = moveSpeed / pathLength;
            
            // Update progress
            this.pathProgress += progressIncrement;
            this.pathProgress = Math.min(1, this.pathProgress);
            
            // Get new position based on progress
            const pos = Path.getPositionAtProgress(this.pathProgress);
            this.x = pos.x;
            this.y = pos.y;
        },

        draw(ctx) {
            if (!this.alive) return;
            const s = this.size;
            const isBoss = !!this.bossRole;
            const bob = Math.sin(performance.now() * 0.008 + this.x * 0.03) * (this.type === 'fast' ? 2 : 1);

            if (this.stealthed) ctx.globalAlpha = 0.3;

            // === STRONGER SILHOUETTE: Dark underlayer ===
            ctx.fillStyle = 'rgba(8,10,15,0.85)';
            ctx.beginPath();
            if (this.shape === 'circle') {
                ctx.arc(this.x + 2, this.y + bob + 2, s, 0, Math.PI * 2);
            } else if (this.shape === 'diamond') {
                ctx.moveTo(this.x + 2, this.y - s + bob + 2);
                ctx.lineTo(this.x + s + 2, this.y + bob + 2);
                ctx.lineTo(this.x + 2, this.y + s + bob + 2);
                ctx.lineTo(this.x - s + 2, this.y + bob + 2);
                ctx.closePath();
            } else if (this.shape === 'hexagon') {
                for (let i = 0; i < 6; i++) {
                    const a = (Math.PI / 3) * i - Math.PI / 6;
                    const px = this.x + Math.cos(a) * s + 2;
                    const py = this.y + Math.sin(a) * s + bob + 2;
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath();
            } else if (this.shape === 'shield') {
                ctx.moveTo(this.x - s + 2, this.y - s * 0.5 + bob + 2);
                ctx.lineTo(this.x - s + 2, this.y + s * 0.2 + bob + 2);
                ctx.lineTo(this.x + 2, this.y + s + bob + 2);
                ctx.lineTo(this.x + s + 2, this.y + s * 0.2 + bob + 2);
                ctx.lineTo(this.x + s + 2, this.y - s * 0.5 + bob + 2);
                ctx.arc(this.x + 2, this.y - s * 0.5 + bob + 2, s, 0, Math.PI, true);
                ctx.closePath();
            } else if (this.shape === 'cross') {
                const w = s * 0.4;
                ctx.moveTo(this.x - w + 2, this.y - s + bob + 2);
                ctx.lineTo(this.x + w + 2, this.y - s + bob + 2);
                ctx.lineTo(this.x + w + 2, this.y - w + bob + 2);
                ctx.lineTo(this.x + s + 2, this.y - w + bob + 2);
                ctx.lineTo(this.x + s + 2, this.y + w + bob + 2);
                ctx.lineTo(this.x + w + 2, this.y + w + bob + 2);
                ctx.lineTo(this.x + w + 2, this.y + s + bob + 2);
                ctx.lineTo(this.x - w + 2, this.y + s + bob + 2);
                ctx.lineTo(this.x - w + 2, this.y + w + bob + 2);
                ctx.lineTo(this.x - s + 2, this.y + w + bob + 2);
                ctx.lineTo(this.x - s + 2, this.y - w + bob + 2);
                ctx.lineTo(this.x - w + 2, this.y - w + bob + 2);
                ctx.closePath();
            }
            ctx.fill();

            const effectColor = this.poisoned ? '#44ff44' : (this.slowed ? '#4488ff' : this.color);
            ctx.shadowColor = effectColor;
            ctx.shadowBlur = isBoss ? 18 : 10;
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.fillStyle = this.critFlash > 0 ? '#ff3366' : (this.hitFlash > 0 ? '#ffffff' : effectColor);

            if (this.shape === 'circle') {
                ctx.beginPath();
                ctx.arc(this.x, this.y + bob, s, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                if (this.type === 'swarm') {
                    ctx.beginPath();
                    ctx.arc(this.x, this.y + bob, s * 0.35, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255,255,255,0.45)';
                    ctx.fill();
                }
            } else if (this.shape === 'diamond') {
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - s + bob);
                ctx.lineTo(this.x + s, this.y + bob);
                ctx.lineTo(this.x, this.y + s + bob);
                ctx.lineTo(this.x - s, this.y + bob);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - s * 0.65 + bob);
                ctx.lineTo(this.x, this.y + s * 0.65 + bob);
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.stroke();
            } else if (this.shape === 'hexagon') {
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = (Math.PI / 3) * i - Math.PI / 6;
                    const px = this.x + Math.cos(a) * s;
                    const py = this.y + Math.sin(a) * s + bob;
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.18)';
                ctx.beginPath();
                ctx.arc(this.x, this.y + bob, s * 0.35, 0, Math.PI * 2);
                ctx.fill();
            } else if (this.shape === 'shield') {
                ctx.beginPath();
                ctx.moveTo(this.x - s, this.y - s * 0.5 + bob);
                ctx.lineTo(this.x - s, this.y + s * 0.2 + bob);
                ctx.lineTo(this.x, this.y + s + bob);
                ctx.lineTo(this.x + s, this.y + s * 0.2 + bob);
                ctx.lineTo(this.x + s, this.y - s * 0.5 + bob);
                ctx.arc(this.x, this.y - s * 0.5 + bob, s, 0, Math.PI, true);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.45)';
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - s * 0.7 + bob);
                ctx.lineTo(this.x, this.y + s * 0.55 + bob);
                ctx.stroke();
            } else if (this.shape === 'cross') {
                const w = s * 0.4;
                ctx.beginPath();
                ctx.moveTo(this.x - w, this.y - s + bob);
                ctx.lineTo(this.x + w, this.y - s + bob);
                ctx.lineTo(this.x + w, this.y - w + bob);
                ctx.lineTo(this.x + s, this.y - w + bob);
                ctx.lineTo(this.x + s, this.y + w + bob);
                ctx.lineTo(this.x + w, this.y + w + bob);
                ctx.lineTo(this.x + w, this.y + s + bob);
                ctx.lineTo(this.x - w, this.y + s + bob);
                ctx.lineTo(this.x - w, this.y + w + bob);
                ctx.lineTo(this.x - s, this.y + w + bob);
                ctx.lineTo(this.x - s, this.y - w + bob);
                ctx.lineTo(this.x - w, this.y - w + bob);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(this.x, this.y + bob, s * 1.2, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(120,255,180,0.18)';
                ctx.stroke();
            }

            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;

            // HP bar
            if (this.hp < this.maxHp || isBoss) {
                const barW = isBoss ? s * 3.2 : s * 2;
                const barH = isBoss ? 5 : 3;
                const barX = this.x - barW / 2;
                const barY = this.y - s - (isBoss ? 12 : 6);
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fillRect(barX, barY, barW, barH);
                ctx.fillStyle = this.hp / this.maxHp > 0.3 ? '#00ff66' : '#ff3333';
                ctx.fillRect(barX, barY, barW * (this.hp / this.maxHp), barH);
                if (isBoss) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
                    ctx.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);
                    ctx.fillStyle = '#ffcc44';
                    ctx.font = 'bold 10px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText('BOSS', this.x, barY - 4);
                }
            }

            if (isBoss) {
                // Pulsing boss aura
                const pulse = 0.7 + Math.sin(performance.now() * 0.005) * 0.3;
                
                // Different boss types have different aura colors
                let auraColor, auraWidth;
                if (this.bossRole === 'brood') {
                    // Brood: orange/red aggressive glow
                    auraColor = `rgba(255,120,30,${pulse * 0.4})`;
                    auraWidth = 3;
                } else if (this.bossRole === 'war') {
                    // War: purple/royal glow
                    auraColor = `rgba(180,80,255,${pulse * 0.45})`;
                    auraWidth = 4;
                } else {
                    // Titan: classic red glow
                    auraColor = `rgba(255,80,120,${pulse * 0.35})`;
                    auraWidth = 2;
                }
                ctx.strokeStyle = auraColor;
                ctx.lineWidth = auraWidth;
                ctx.beginPath();
                ctx.arc(this.x, this.y + bob, s * 1.45, 0, Math.PI * 2);
                ctx.stroke();
                
                // Extra ring for war boss
                if (this.bossRole === 'war') {
                    ctx.strokeStyle = `rgba(255,255,255,${pulse * 0.2})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y + bob, s * 1.7, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            
            // Resistance indicator icon above enemy
            const resistIcon = this._getResistIcon();
            if (resistIcon) {
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(resistIcon, this.x, this.y - s - 12);
            }
        },
        
        _getResistIcon() {
            // Show resistance icons based on enemy type
            if (this.resist) {
                if (this.resist.kinetic && this.resist.kinetic < 1) return '🛡️'; // resists kinetic
                if (this.resist.fire && this.resist.fire < 1) return '🔥'; // resists fire
                if (this.resist.pierce && this.resist.pierce < 1) return '💎'; // resists pierce
                if (this.type === 'healer') return '💚'; // healer
                if (this.type === 'stealth') return '👻'; // stealth
            }
            return null;
        }
    };
}
