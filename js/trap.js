// Path traps — placeable items ON the enemy path
const TrapTypes = {
    mine:   { cost: 30, damage: 80, color: '#ff3333', uses: 1, radius: 30, effect: 'explode', icon: '💣' },
    poison: { cost: 40, damage: 5, color: '#44ff44', uses: 8, radius: 25, effect: 'poison', duration: 3, icon: '☠️' },
    ice:    { cost: 25, damage: 0, color: '#88ddff', uses: 5, radius: 35, effect: 'ice', duration: 3, icon: '❄️' }
};

function createTrap(type, x, y) {
    const def = TrapTypes[type];
    return {
        type,
        x, y,
        damage: def.damage,
        color: def.color,
        uses: def.uses,
        maxUses: def.uses,
        radius: def.radius,
        effect: def.effect,
        duration: def.duration || 0,
        cooldown: 0,
        cooldownTime: 0.5, // seconds between triggers
        alive: true,
        hitEnemies: new Set(), // per-trigger tracking
        
        update(dt, enemies, speedMult) {
            if (!this.alive) return;
            
            if (this.cooldown > 0) {
                this.cooldown -= dt * speedMult;
                if (this.cooldown <= 0) {
                    this.hitEnemies.clear(); // Reset for next trigger
                }
                return;
            }
            
            // Check for enemies in radius
            for (const e of enemies) {
                if (!e.alive || this.hitEnemies.has(e)) continue;
                const d = Utils.dist(this.x, this.y, e.x, e.y);
                if (d > this.radius) continue;
                
                // Trigger!
                this.hitEnemies.add(e);
                
                if (this.effect === 'explode') {
                    // Mine: big damage to all in radius, then gone
                    for (const e2 of enemies) {
                        if (e2.alive && Utils.dist(this.x, this.y, e2.x, e2.y) <= this.radius) {
                            e2.takeDamage(this.damage, 'fire');
                        }
                    }
                    ParticlePool.spawn(this.x, this.y, this.color, 20);
                    Audio.trapTrigger();
                    game.shake(3);
                    this.uses = 0;
                    this.alive = false;
                    return;
                }
                
                if (this.effect === 'poison') {
                    // Poison: damage over time
                    e.poisoned = true;
                    e.poisonDamage = this.damage;
                    e.poisonTimer = this.duration;
                    ParticlePool.spawn(e.x, e.y, this.color, 4);
                }
                
                if (this.effect === 'ice') {
                    // Ice: slow + brief freeze
                    e.slowed = true;
                    e.slowTimer = this.duration;
                    e.speed = e.baseSpeed * 0.3; // Stronger slow than AOE tower
                    ParticlePool.spawn(e.x, e.y, this.color, 5);
                }
                
                this.uses--;
                this.cooldown = this.cooldownTime;
                Audio.trapTrigger();
                
                if (this.uses <= 0) {
                    this.alive = false;
                }
                return; // One trigger per cooldown
            }
        },
        
        draw(ctx) {
            if (!this.alive) return;
            
            const pulse = 0.8 + Math.sin(Date.now() / 300) * 0.2;
            
            // Trigger radius (subtle)
            ctx.globalAlpha = 0.06;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            
            // Trap body
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 6 * pulse;
            ctx.fillStyle = this.color;
            
            if (this.effect === 'explode') {
                // Mine: spiky circle
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const a = (Math.PI / 4) * i;
                    const r = (i % 2 === 0) ? 8 : 5;
                    const px = this.x + Math.cos(a) * r;
                    const py = this.y + Math.sin(a) * r;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
            } else if (this.effect === 'poison') {
                // Poison: skull-ish blob
                ctx.beginPath();
                ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
                ctx.fill();
                // Drip effect
                ctx.fillStyle = this.color + '88';
                ctx.beginPath();
                ctx.arc(this.x - 2, this.y + 8, 2, 0, Math.PI * 2);
                ctx.fill();
            } else if (this.effect === 'ice') {
                // Ice: diamond/crystal
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - 8);
                ctx.lineTo(this.x + 6, this.y);
                ctx.lineTo(this.x, this.y + 8);
                ctx.lineTo(this.x - 6, this.y);
                ctx.closePath();
                ctx.fill();
            }
            
            ctx.shadowBlur = 0;
            
            // Uses indicator
            if (this.maxUses > 1) {
                const usePct = this.uses / this.maxUses;
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.fillRect(this.x - 6, this.y - 13, 12, 2);
                ctx.fillStyle = this.color;
                ctx.fillRect(this.x - 6, this.y - 13, 12 * usePct, 2);
            }
        }
    };
}
