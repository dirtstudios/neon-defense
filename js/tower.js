// Tower definitions and factory
// Each tower has 3 tiers. Tier 1 = base, Tier 2 & 3 = upgrades
const TowerTypes = {
    blaster: { cost: 50, damage: 10, range: 100, fireRate: 2, color: '#00f3ff', shape: 'triangle', projectileColor: '#00f3ff', land: true },
    sniper:  { cost: 100, damage: 50, range: 200, fireRate: 0.3, color: '#aa88ff', shape: 'diamond', projectileColor: '#aa88ff', land: true },
    aoe:     { cost: 150, damage: 15, range: 80, fireRate: 0.8, color: '#ff8800', shape: 'hexagon', projectileColor: '#ff8800', aoe: true, aoeSlow: true, aoeRadius: 60, land: true },
    boat:    { cost: 75, damage: 20, range: 140, fireRate: 1.2, color: '#0088ff', shape: 'boat', projectileColor: '#0088ff', water: true },
    sentinel:{ cost: 75, damage: 0, range: 0, fireRate: 0, color: '#00ff88', shape: 'sentinel', projectileColor: '#00ff88', land: true,
               isSentinel: true, maxSentinels: 2, sentinelHp: 40, sentinelDmg: 5, sentinelRespawn: 10, sentinelDmgReduction: 0 }
};

const TowerUpgrades = {
    blaster: [
        null, // tier 1 = base
        { cost: 60, damage: 18, range: 110, fireRate: 2.5, color: '#33ffff', name: 'Blaster II' },
        { cost: 100, damage: 30, range: 120, fireRate: 3.2, color: '#66ffff', name: 'Blaster III' }
    ],
    sniper: [
        null,
        { cost: 120, damage: 90, range: 230, fireRate: 0.4, color: '#bb99ff', name: 'Sniper II' },
        { cost: 180, damage: 150, range: 260, fireRate: 0.5, color: '#ddbbff', name: 'Sniper III' }
    ],
    aoe: [
        null,
        { cost: 120, damage: 25, range: 95, fireRate: 1.0, aoeRadius: 75, color: '#ffaa33', name: 'AOE II' },
        { cost: 180, damage: 40, range: 110, fireRate: 1.2, aoeRadius: 90, color: '#ffcc66', name: 'AOE III' }
    ],
    boat: [
        null,
        { cost: 80, damage: 35, range: 160, fireRate: 1.5, color: '#33aaff', name: 'Boat II' },
        { cost: 130, damage: 55, range: 180, fireRate: 1.8, color: '#66ccff', name: 'Boat III' }
    ],
    sentinel: [
        null,
        { cost: 100, color: '#33ffaa', name: 'Sentinel II',
          maxSentinels: 3, sentinelHp: 50, sentinelDmg: 6, sentinelRespawn: 9, sentinelDmgReduction: 0 },
        { cost: 150, color: '#66ffcc', name: 'Sentinel III',
          maxSentinels: 4, sentinelHp: 60, sentinelDmg: 8, sentinelRespawn: 8, sentinelDmgReduction: 0.15 }
    ]
};

function createTower(type, x, y) {
    const def = TowerTypes[type];
    return {
        type: type,
        x: x,
        y: y,
        tier: 1,
        totalInvested: def.cost, // tracks total gold spent (for sell value)
        damage: def.damage,
        range: def.range,
        fireRate: def.fireRate,
        color: def.color,
        shape: def.shape,
        projectileColor: def.projectileColor,
        aoe: def.aoe || false,
        aoeSlow: def.aoeSlow || false,
        aoeRadius: def.aoeRadius || 0,
        cooldown: 0,
        target: null,
        sellValue: Math.floor(def.cost * 0.5),
        selected: false,
        recoil: 0,
        muzzleFlash: 0,
        aimAngle: -Math.PI / 2,
        // Sentinel properties
        isSentinel: def.isSentinel || false,
        maxSentinels: def.maxSentinels || 0,
        sentinelHp: def.sentinelHp || 0,
        sentinelDmg: def.sentinelDmg || 0,
        sentinelRespawn: def.sentinelRespawn || 10,
        sentinelDmgReduction: def.sentinelDmgReduction || 0,
        rallyPoint: null,
        settingRally: false,

        getUpgradeCost() {
            const upgrades = TowerUpgrades[this.type];
            if (!upgrades || this.tier >= 3) return null;
            return upgrades[this.tier] ? upgrades[this.tier].cost : null;
        },

        upgrade() {
            const upgrades = TowerUpgrades[this.type];
            if (!upgrades || this.tier >= 3) return false;
            const up = upgrades[this.tier];
            if (!up) return false;
            this.tier++;
            if (up.damage !== undefined) this.damage = up.damage;
            if (up.range !== undefined) this.range = up.range;
            if (up.fireRate !== undefined) this.fireRate = up.fireRate;
            if (up.color) this.color = up.color;
            if (up.color) this.projectileColor = up.color;
            if (up.aoeRadius) this.aoeRadius = up.aoeRadius;
            // Sentinel upgrade stats
            if (up.maxSentinels !== undefined) this.maxSentinels = up.maxSentinels;
            if (up.sentinelHp !== undefined) this.sentinelHp = up.sentinelHp;
            if (up.sentinelDmg !== undefined) this.sentinelDmg = up.sentinelDmg;
            if (up.sentinelRespawn !== undefined) this.sentinelRespawn = up.sentinelRespawn;
            if (up.sentinelDmgReduction !== undefined) this.sentinelDmgReduction = up.sentinelDmgReduction;
            this.totalInvested += up.cost;
            this.sellValue = Math.floor(this.totalInvested * 0.5);
            // Notify sentinel manager of upgrade
            if (this.isSentinel) SentinelManager.onTowerUpgrade(this);
            return true;
        },

        findTarget(enemies) {
            let closest = null;
            let closestDist = Infinity;
            for (const e of enemies) {
                if (!e.alive) continue;
                const d = Utils.dist(this.x, this.y, e.x, e.y);
                if (d <= this.range && d < closestDist) {
                    closest = e;
                    closestDist = d;
                }
            }
            this.target = closest;
        },

        update(dt, enemies, speedMult) {
            if (this.isSentinel) return; // Sentinels don't shoot — SentinelManager handles combat
            
            this.cooldown -= dt * speedMult;
            this.recoil = Math.max(0, this.recoil - dt * 5.5 * speedMult);
            this.muzzleFlash = Math.max(0, this.muzzleFlash - dt * 8 * speedMult);
            this.findTarget(enemies);
            if (this.target && this.target.alive) {
                this.aimAngle = Utils.angle(this.x, this.y, this.target.x, this.target.y);
            }

            if (this.target && this.cooldown <= 0) {
                const dmgType = DamageTypes[this.type] || 'kinetic';
                const origin = this.getFireOrigin();
                ProjectilePool.fire(
                    origin.x, origin.y, this.target,
                    this.damage, 10,
                    this.projectileColor,
                    this.aoe, this.aoeSlow, this.aoeRadius,
                    dmgType
                );
                this.recoil = this.type === 'sniper' ? 1 : (this.type === 'aoe' ? 0.8 : 0.55);
                this.muzzleFlash = 1;
                this.cooldown = 1 / this.fireRate;
                Audio.shoot();
            }
        },

        getFireOrigin() {
            const a = this.aimAngle || -Math.PI / 2;
            if (this.type === 'blaster') {
                return { x: this.x + Math.cos(a) * 15, y: this.y + Math.sin(a) * 15 - 4 };
            }
            if (this.type === 'sniper') {
                return { x: this.x + Math.cos(a) * 20, y: this.y + Math.sin(a) * 20 - 7 };
            }
            if (this.type === 'aoe') {
                return { x: this.x + Math.cos(a) * 10, y: this.y + Math.sin(a) * 10 - 3 };
            }
            if (this.type === 'boat') {
                return { x: this.x + Math.cos(a) * 16, y: this.y + Math.sin(a) * 16 - 5 };
            }
            return { x: this.x, y: this.y };
        },

        draw(ctx) {
            const s = 14 + (this.tier - 1) * 1.5;
            const pulse = 0.7 + Math.sin(performance.now() * 0.006 + this.x * 0.03) * 0.08;
            const idle = Math.sin(performance.now() * 0.003 + this.x * 0.02 + this.y * 0.01) * 0.8;
            const dark = 'rgba(24,28,38,0.98)';
            const panel = 'rgba(60,72,92,0.95)';
            const a = this.aimAngle || -Math.PI / 2;
            const recoilPx = this.recoil * (this.type === 'sniper' ? 7 : this.type === 'aoe' ? 4 : 3.5);
            const ox = Math.cos(a) * recoilPx * -1;
            const oy = Math.sin(a) * recoilPx * -1;

            ctx.save();
            ctx.translate(ox, oy + idle);
            ctx.shadowColor = this.color;
            ctx.shadowBlur = this.selected ? 18 : 10;
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(255,255,255,0.28)';

            if (this.shape === 'triangle') {
                // blaster: squat turret with twin barrels
                ctx.fillStyle = dark;
                ctx.fillRect(this.x - s * 0.6, this.y - s * 0.15, s * 1.2, s * 0.9);
                ctx.strokeRect(this.x - s * 0.6, this.y - s * 0.15, s * 1.2, s * 0.9);
                ctx.fillStyle = panel;
                ctx.fillRect(this.x - s * 0.36, this.y - s * 0.65, s * 0.72, s * 0.55);
                ctx.fillStyle = this.color;
                ctx.fillRect(this.x - 2, this.y - s * 1.05, 4, s * 0.7);
                ctx.fillRect(this.x - s * 0.24, this.y - s * 0.82, 3, s * 0.55);
                ctx.fillRect(this.x + s * 0.12, this.y - s * 0.82, 3, s * 0.55);
                if (this.tier >= 2) {
                    ctx.fillStyle = this.color;
                    ctx.fillRect(this.x - s * 0.55, this.y + s * 0.05, 3, s * 0.38);
                    ctx.fillRect(this.x + s * 0.52, this.y + s * 0.05, 3, s * 0.38);
                }
                if (this.tier >= 3) {
                    ctx.strokeStyle = `${this.color}aa`;
                    ctx.beginPath();
                    ctx.moveTo(this.x - s * 0.62, this.y - s * 0.2);
                    ctx.lineTo(this.x - s * 0.95, this.y - s * 0.55);
                    ctx.moveTo(this.x + s * 0.62, this.y - s * 0.2);
                    ctx.lineTo(this.x + s * 0.95, this.y - s * 0.55);
                    ctx.stroke();
                }
            } else if (this.shape === 'diamond') {
                // sniper: long rail cannon on compact base
                ctx.fillStyle = dark;
                ctx.fillRect(this.x - s * 0.52, this.y - s * 0.05, s * 1.04, s * 0.78);
                ctx.strokeRect(this.x - s * 0.52, this.y - s * 0.05, s * 1.04, s * 0.78);
                ctx.fillStyle = panel;
                ctx.fillRect(this.x - s * 0.18, this.y - s * 0.62, s * 0.36, s * 0.55);
                ctx.fillStyle = this.color;
                ctx.fillRect(this.x - 2, this.y - s * 1.15, 4, s * 0.95);
                ctx.fillRect(this.x - s * 0.06, this.y - s * 1.25, s * 0.12, s * 0.22);
                if (this.tier >= 2) {
                    ctx.fillStyle = this.color;
                    ctx.fillRect(this.x - s * 0.5, this.y - s * 0.52, s, 3);
                }
                if (this.tier >= 3) {
                    ctx.fillStyle = 'rgba(255,255,255,0.85)';
                    ctx.fillRect(this.x - 1, this.y - s * 1.35, 2, 6);
                }
            } else if (this.shape === 'hexagon') {
                // aoe: reactor/mortar assembly
                ctx.fillStyle = dark;
                ctx.fillRect(this.x - s * 0.68, this.y - s * 0.1, s * 1.36, s * 0.92);
                ctx.strokeRect(this.x - s * 0.68, this.y - s * 0.1, s * 1.36, s * 0.92);
                ctx.fillStyle = panel;
                ctx.fillRect(this.x - s * 0.4, this.y - s * 0.6, s * 0.8, s * 0.5);
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y - s * 0.18, s * 0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = `rgba(255,255,255,${0.18 * pulse})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y - s * 0.18, s * 0.14, 0, Math.PI * 2);
                ctx.fill();
                if (this.tier >= 2) {
                    ctx.strokeStyle = `${this.color}bb`;
                    ctx.strokeRect(this.x - s * 0.52, this.y - s * 0.34, s * 1.04, s * 0.36);
                }
                if (this.tier >= 3) {
                    for (let i = 0; i < 3; i++) {
                        const a = performance.now() * 0.002 + i * (Math.PI * 2 / 3);
                        ctx.fillStyle = 'rgba(255,240,200,0.55)';
                        ctx.beginPath();
                        ctx.arc(this.x + Math.cos(a) * s * 0.55, this.y - s * 0.18 + Math.sin(a) * s * 0.2, 2.2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            } else if (this.shape === 'sentinel') {
                // sentinel: little barracks building
                ctx.fillStyle = 'rgba(70,78,92,0.98)';
                ctx.fillRect(this.x - s * 0.85, this.y - s * 0.05, s * 1.7, s * 0.92);
                ctx.strokeRect(this.x - s * 0.85, this.y - s * 0.05, s * 1.7, s * 0.92);
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.moveTo(this.x - s * 0.95, this.y - s * 0.05);
                ctx.lineTo(this.x, this.y - s * 0.7);
                ctx.lineTo(this.x + s * 0.95, this.y - s * 0.05);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = 'rgba(20,20,20,0.5)';
                ctx.fillRect(this.x - s * 0.18, this.y + s * 0.18, s * 0.36, s * 0.64);
                if (this.tier >= 2) {
                    ctx.fillStyle = 'rgba(255,240,150,0.4)';
                    ctx.fillRect(this.x - s * 0.6, this.y + s * 0.12, s * 0.18, s * 0.18);
                    ctx.fillRect(this.x + s * 0.42, this.y + s * 0.12, s * 0.18, s * 0.18);
                }
                if (this.tier >= 3) {
                    ctx.strokeStyle = `${this.color}aa`;
                    ctx.beginPath();
                    ctx.moveTo(this.x - s * 0.95, this.y - s * 0.05);
                    ctx.lineTo(this.x - s * 0.95, this.y - s * 0.9);
                    ctx.stroke();
                }
            } else if (this.shape === 'boat') {
                // boat: hull + bridge, no weird platform circle
                ctx.fillStyle = 'rgba(255,255,255,0.12)';
                ctx.beginPath();
                ctx.moveTo(this.x - s * 0.5, this.y + s * 0.72);
                ctx.lineTo(this.x + s * 0.5, this.y + s * 0.72);
                ctx.lineTo(this.x + s * 0.85, this.y + s * 0.95);
                ctx.lineTo(this.x - s * 0.85, this.y + s * 0.95);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = dark;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - s * 0.95);
                ctx.lineTo(this.x + s * 0.78, this.y - s * 0.05);
                ctx.lineTo(this.x + s * 0.55, this.y + s * 0.6);
                ctx.lineTo(this.x - s * 0.55, this.y + s * 0.6);
                ctx.lineTo(this.x - s * 0.78, this.y - s * 0.05);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = this.color;
                ctx.fillRect(this.x - 2, this.y - s * 0.95, 4, s * 0.72);
                ctx.fillStyle = panel;
                ctx.fillRect(this.x - s * 0.18, this.y - s * 0.25, s * 0.36, s * 0.42);
                if (this.tier >= 2) {
                    ctx.fillStyle = this.color;
                    ctx.fillRect(this.x - s * 0.42, this.y - s * 0.02, s * 0.16, s * 0.22);
                    ctx.fillRect(this.x + s * 0.26, this.y - s * 0.02, s * 0.16, s * 0.22);
                }
                if (this.tier >= 3) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
                    ctx.beginPath();
                    ctx.moveTo(this.x - s * 0.55, this.y + s * 0.72);
                    ctx.lineTo(this.x - s * 0.95, this.y + s * 1.02);
                    ctx.moveTo(this.x + s * 0.55, this.y + s * 0.72);
                    ctx.lineTo(this.x + s * 0.95, this.y + s * 1.02);
                    ctx.stroke();
                }
            }

            if (this.muzzleFlash > 0 && !this.isSentinel) {
                const origin = this.getFireOrigin();
                const flashAlpha = this.muzzleFlash * 0.9;
                ctx.globalAlpha = flashAlpha;
                ctx.fillStyle = this.type === 'aoe' ? '#ffd27a' : '#ffffff';
                ctx.shadowColor = this.color;
                ctx.shadowBlur = 16;
                ctx.beginPath();
                ctx.arc(origin.x - ox, origin.y - oy - idle, this.type === 'sniper' ? 4 : 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = `${this.color}aa`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(origin.x - ox, origin.y - oy - idle);
                ctx.lineTo(origin.x - ox + Math.cos(a) * (this.type === 'sniper' ? 10 : 6), origin.y - oy - idle + Math.sin(a) * (this.type === 'sniper' ? 10 : 6));
                ctx.stroke();
                ctx.globalAlpha = 1;
            }

            ctx.shadowBlur = 0;
            ctx.restore();

            // Tier pips (dots below tower)
            if (this.tier >= 2) {
                const pipY = this.y + s + 4;
                for (let i = 0; i < this.tier - 1; i++) {
                    const pipX = this.x + (i - (this.tier - 2) * 0.5) * 6;
                    ctx.beginPath();
                    ctx.arc(pipX, pipY, 2, 0, Math.PI * 2);
                    ctx.fillStyle = this.tier === 3 ? '#ffdd00' : '#ffffff';
                    ctx.fill();
                }
            }

            // Range indicator when selected
            if (this.selected) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
                ctx.strokeStyle = `${this.color}33`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // Targeting line
            if (this.target && this.target.alive) {
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.target.x, this.target.y);
                ctx.strokeStyle = `${this.color}22`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    };
}
