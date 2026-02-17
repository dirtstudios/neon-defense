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
               resist: { kinetic: 0.7, fire: 0.7 } } // bosses resist everything a bit
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

        // Apply resistance to damage based on tower's damage type
        takeDamage(dmg, damageType) {
            const mult = this.resist[damageType] || 1.0;
            const actualDmg = Math.max(1, Math.floor(dmg * mult));
            this.hp -= actualDmg;
            if (this.hp <= 0) {
                this.hp = 0;
                this.alive = false;
            }
            return actualDmg;
        },

        update(dt, speedMult) {
            if (!this.alive) return;

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
            const isBoss = this.type === 'boss';

            // Glow
            // Stealth: draw semi-transparent
            if (this.stealthed) {
                ctx.globalAlpha = 0.3;
            }

            const effectColor = this.poisoned ? '#44ff44' : (this.slowed ? '#4488ff' : this.color);
            ctx.shadowColor = effectColor;
            ctx.shadowBlur = isBoss ? 15 : 8;

            // Shape
            ctx.fillStyle = effectColor;

            if (this.shape === 'circle') {
                ctx.beginPath();
                ctx.arc(this.x, this.y, s, 0, Math.PI * 2);
                ctx.fill();
            } else if (this.shape === 'diamond') {
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - s);
                ctx.lineTo(this.x + s, this.y);
                ctx.lineTo(this.x, this.y + s);
                ctx.lineTo(this.x - s, this.y);
                ctx.closePath();
                ctx.fill();
            } else if (this.shape === 'hexagon') {
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = (Math.PI / 3) * i - Math.PI / 6;
                    const px = this.x + Math.cos(a) * s;
                    const py = this.y + Math.sin(a) * s;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
            } else if (this.shape === 'shield') {
                // Shield shape — rounded top, pointed bottom
                ctx.beginPath();
                ctx.moveTo(this.x - s, this.y - s * 0.5);
                ctx.lineTo(this.x - s, this.y + s * 0.2);
                ctx.lineTo(this.x, this.y + s);
                ctx.lineTo(this.x + s, this.y + s * 0.2);
                ctx.lineTo(this.x + s, this.y - s * 0.5);
                ctx.arc(this.x, this.y - s * 0.5, s, 0, Math.PI, true);
                ctx.closePath();
                ctx.fill();
            } else if (this.shape === 'cross') {
                // Plus/cross shape for healer
                const w = s * 0.4;
                ctx.beginPath();
                ctx.moveTo(this.x - w, this.y - s);
                ctx.lineTo(this.x + w, this.y - s);
                ctx.lineTo(this.x + w, this.y - w);
                ctx.lineTo(this.x + s, this.y - w);
                ctx.lineTo(this.x + s, this.y + w);
                ctx.lineTo(this.x + w, this.y + w);
                ctx.lineTo(this.x + w, this.y + s);
                ctx.lineTo(this.x - w, this.y + s);
                ctx.lineTo(this.x - w, this.y + w);
                ctx.lineTo(this.x - s, this.y + w);
                ctx.lineTo(this.x - s, this.y - w);
                ctx.lineTo(this.x - w, this.y - w);
                ctx.closePath();
                ctx.fill();
            }

            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;

            // HP bar
            if (this.hp < this.maxHp) {
                const barW = s * 2;
                const barH = 3;
                const barX = this.x - barW / 2;
                const barY = this.y - s - 6;
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fillRect(barX, barY, barW, barH);
                ctx.fillStyle = this.hp / this.maxHp > 0.3 ? '#00ff66' : '#ff3333';
                ctx.fillRect(barX, barY, barW * (this.hp / this.maxHp), barH);
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
