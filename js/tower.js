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
            this.findTarget(enemies);

            if (this.target && this.cooldown <= 0) {
                const dmgType = DamageTypes[this.type] || 'kinetic';
                ProjectilePool.fire(
                    this.x, this.y, this.target,
                    this.damage, 10,
                    this.projectileColor,
                    this.aoe, this.aoeSlow, this.aoeRadius,
                    dmgType
                );
                this.cooldown = 1 / this.fireRate;
                Audio.shoot();
            }
        },

        draw(ctx) {
            const s = 14 + (this.tier - 1) * 1.5;
            const pulse = 0.7 + Math.sin(performance.now() * 0.006 + this.x * 0.03) * 0.08;

            // base pad
            ctx.fillStyle = 'rgba(20, 24, 34, 0.95)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, s * 0.95, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = `${this.color}55`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, s * 0.8, 0, Math.PI * 2);
            ctx.stroke();

            ctx.shadowColor = this.color;
            ctx.shadowBlur = this.selected ? 22 : 12;
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';

            // Tower body with stronger silhouettes
            if (this.shape === 'triangle') {
                // blaster: forward gun turret
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - s * 0.95);
                ctx.lineTo(this.x - s * 0.7, this.y + s * 0.55);
                ctx.lineTo(this.x + s * 0.7, this.y + s * 0.55);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.22)';
                ctx.fillRect(this.x - 2, this.y - s * 0.6, 4, s * 0.7);
                if (this.tier >= 2) {
                    ctx.fillStyle = 'rgba(255,255,255,0.18)';
                    ctx.fillRect(this.x - s * 0.42, this.y - s * 0.1, s * 0.18, s * 0.48);
                    ctx.fillRect(this.x + s * 0.24, this.y - s * 0.1, s * 0.18, s * 0.48);
                }
                if (this.tier >= 3) {
                    ctx.strokeStyle = `${this.color}aa`;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, s * 1.08, -Math.PI * 0.15, Math.PI * 1.15);
                    ctx.stroke();
                }
            } else if (this.shape === 'diamond') {
                // sniper: crystal/railgun shape
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - s);
                ctx.lineTo(this.x + s * 0.55, this.y - 2);
                ctx.lineTo(this.x, this.y + s * 0.95);
                ctx.lineTo(this.x - s * 0.55, this.y - 2);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.55)';
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - s * 0.8);
                ctx.lineTo(this.x, this.y + s * 0.55);
                ctx.stroke();
                if (this.tier >= 2) {
                    ctx.strokeStyle = `${this.color}cc`;
                    ctx.beginPath();
                    ctx.moveTo(this.x - s * 0.55, this.y + s * 0.45);
                    ctx.lineTo(this.x + s * 0.55, this.y + s * 0.45);
                    ctx.stroke();
                }
                if (this.tier >= 3) {
                    ctx.fillStyle = 'rgba(255,255,255,0.26)';
                    ctx.beginPath();
                    ctx.arc(this.x, this.y - s * 0.35, s * 0.16, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (this.shape === 'hexagon') {
                // aoe: chunky reactor core
                ctx.fillStyle = this.color;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = (Math.PI / 3) * i - Math.PI / 6;
                    const px = this.x + Math.cos(a) * s * 0.82;
                    const py = this.y + Math.sin(a) * s * 0.82;
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = `rgba(255,255,255,${0.18 * pulse})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, s * 0.32, 0, Math.PI * 2);
                ctx.fill();
                if (this.tier >= 2) {
                    ctx.strokeStyle = `${this.color}bb`;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, s * 0.58, 0, Math.PI * 2);
                    ctx.stroke();
                }
                if (this.tier >= 3) {
                    for (let i = 0; i < 3; i++) {
                        const a = performance.now() * 0.002 + i * (Math.PI * 2 / 3);
                        ctx.fillStyle = 'rgba(255,240,200,0.55)';
                        ctx.beginPath();
                        ctx.arc(this.x + Math.cos(a) * s * 0.55, this.y + Math.sin(a) * s * 0.55, 2.2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            } else if (this.shape === 'sentinel') {
                // sentinel: barracks with banner + gate
                ctx.fillStyle = this.color;
                ctx.fillRect(this.x - s * 0.8, this.y - s * 0.15, s * 1.6, s * 0.95);
                ctx.strokeRect(this.x - s * 0.8, this.y - s * 0.15, s * 1.6, s * 0.95);
                ctx.fillStyle = 'rgba(20,20,20,0.45)';
                ctx.fillRect(this.x - s * 0.22, this.y + s * 0.15, s * 0.44, s * 0.65);
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.moveTo(this.x - s * 0.55, this.y - s * 0.15);
                ctx.lineTo(this.x - s * 0.55, this.y - s * 1.05);
                ctx.lineTo(this.x + s * 0.35, this.y - s * 0.7);
                ctx.lineTo(this.x - s * 0.55, this.y - s * 0.42);
                ctx.closePath();
                ctx.fill();
                if (this.tier >= 2) {
                    ctx.fillStyle = 'rgba(255,255,255,0.25)';
                    ctx.fillRect(this.x - s * 0.55, this.y + s * 0.08, s * 0.22, s * 0.22);
                    ctx.fillRect(this.x + s * 0.33, this.y + s * 0.08, s * 0.22, s * 0.22);
                }
                if (this.tier >= 3) {
                    ctx.strokeStyle = `${this.color}aa`;
                    ctx.beginPath();
                    ctx.moveTo(this.x - s * 0.9, this.y - s * 0.2);
                    ctx.lineTo(this.x - s * 0.9, this.y - s * 0.95);
                    ctx.stroke();
                }
            } else if (this.shape === 'boat') {
                // boat: stronger hull + cabin + wake
                ctx.fillStyle = 'rgba(255,255,255,0.12)';
                ctx.beginPath();
                ctx.ellipse(this.x, this.y + s * 0.65, s * 0.9, s * 0.28, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - s * 0.95);
                ctx.lineTo(this.x + s * 0.78, this.y - s * 0.05);
                ctx.lineTo(this.x + s * 0.55, this.y + s * 0.6);
                ctx.lineTo(this.x - s * 0.55, this.y + s * 0.6);
                ctx.lineTo(this.x - s * 0.78, this.y - s * 0.05);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.25)';
                ctx.fillRect(this.x - s * 0.18, this.y - s * 0.25, s * 0.36, s * 0.42);
                ctx.strokeStyle = this.color;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - s * 0.25);
                ctx.lineTo(this.x, this.y - s * 1.15);
                ctx.stroke();
                if (this.tier >= 2) {
                    ctx.fillStyle = 'rgba(255,255,255,0.28)';
                    ctx.fillRect(this.x - s * 0.42, this.y - s * 0.05, s * 0.16, s * 0.3);
                    ctx.fillRect(this.x + s * 0.26, this.y - s * 0.05, s * 0.16, s * 0.3);
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

            ctx.shadowBlur = 0;

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
