// Tower definitions and factory
// Each tower has 3 tiers. Tier 1 = base, Tier 2 & 3 = upgrades
const TowerTypes = {
    blaster: { cost: 50, damage: 10, range: 100, fireRate: 2, color: '#00f3ff', shape: 'triangle', projectileColor: '#00f3ff', land: true },
    sniper:  { cost: 100, damage: 50, range: 200, fireRate: 0.3, color: '#aa88ff', shape: 'diamond', projectileColor: '#aa88ff', land: true },
    aoe:     { cost: 150, damage: 15, range: 80, fireRate: 0.8, color: '#ff8800', shape: 'hexagon', projectileColor: '#ff8800', aoe: true, aoeSlow: true, aoeRadius: 60, land: true },
    boat:    { cost: 75, damage: 20, range: 140, fireRate: 1.2, color: '#0088ff', shape: 'boat', projectileColor: '#0088ff', water: true }
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
            this.damage = up.damage;
            this.range = up.range;
            this.fireRate = up.fireRate;
            this.color = up.color;
            this.projectileColor = up.color;
            if (up.aoeRadius) this.aoeRadius = up.aoeRadius;
            this.totalInvested += up.cost;
            this.sellValue = Math.floor(this.totalInvested * 0.5);
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
            const s = 14;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = this.selected ? 16 : 10;

            // Tower body
            ctx.fillStyle = this.color;
            if (this.shape === 'triangle') {
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - s);
                ctx.lineTo(this.x - s * 0.8, this.y + s * 0.6);
                ctx.lineTo(this.x + s * 0.8, this.y + s * 0.6);
                ctx.closePath();
                ctx.fill();
            } else if (this.shape === 'diamond') {
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - s);
                ctx.lineTo(this.x + s * 0.7, this.y);
                ctx.lineTo(this.x, this.y + s);
                ctx.lineTo(this.x - s * 0.7, this.y);
                ctx.closePath();
                ctx.fill();
            } else if (this.shape === 'hexagon') {
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = (Math.PI / 3) * i - Math.PI / 6;
                    const px = this.x + Math.cos(a) * s * 0.8;
                    const py = this.y + Math.sin(a) * s * 0.8;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
            } else if (this.shape === 'boat') {
                // Boat hull shape
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - s);           // bow (front)
                ctx.lineTo(this.x + s * 0.7, this.y);     // right side
                ctx.lineTo(this.x + s * 0.5, this.y + s * 0.6); // right stern
                ctx.lineTo(this.x - s * 0.5, this.y + s * 0.6); // left stern
                ctx.lineTo(this.x - s * 0.7, this.y);     // left side
                ctx.closePath();
                ctx.fill();
                // Mast
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - s * 0.3);
                ctx.lineTo(this.x, this.y - s * 1.2);
                ctx.stroke();
                // Flag
                ctx.fillStyle = '#0055aa';
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - s * 1.2);
                ctx.lineTo(this.x + s * 0.4, this.y - s);
                ctx.lineTo(this.x, this.y - s * 0.8);
                ctx.fill();
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
