// Object-pooled projectiles
const ProjectilePool = {
    pool: [],
    active: [],
    MAX: 200,

    init() {
        for (let i = 0; i < this.MAX; i++) {
            this.pool.push({ x: 0, y: 0, tx: 0, ty: 0, speed: 0, damage: 0, color: '', target: null, aoe: false, aoeSlow: false, aoeRadius: 0 });
        }
    },

    fire(x, y, target, damage, speed, color, aoe, aoeSlow, aoeRadius) {
        if (aoe) {
            // AOE fires a ring blast — no projectile travel, instant area effect
            this._fireRing(x, y, damage, color, aoeSlow, aoeRadius);
            return;
        }
        if (this.pool.length === 0) return;
        const p = this.pool.pop();
        p.x = x;
        p.y = y;
        p.target = target;
        p.tx = target.x;
        p.ty = target.y;
        p.damage = damage;
        p.speed = speed || 10;
        p.color = color || '#fff';
        p.aoe = false;
        p.aoeSlow = false;
        p.aoeRadius = 0;
        p.isRing = false;
        this.active.push(p);
    },
    
    // Ring blast for AOE towers — expanding ring
    rings: [],
    
    _fireRing(x, y, damage, color, aoeSlow, radius) {
        this.rings.push({
            x, y, damage, color, aoeSlow,
            maxRadius: radius,
            currentRadius: 0,
            speed: 120, // pixels per second (slower = more visible)
            hit: new Set(), // track which enemies already hit
            alive: true
        });
    },

    update(dt, enemies) {
        // Update normal projectiles
        for (let i = this.active.length - 1; i >= 0; i--) {
            const p = this.active[i];
            if (p.target && p.target.alive) {
                p.tx = p.target.x;
                p.ty = p.target.y;
            }
            const angle = Utils.angle(p.x, p.y, p.tx, p.ty);
            p.x += Math.cos(angle) * p.speed;
            p.y += Math.sin(angle) * p.speed;

            const dist = Utils.dist(p.x, p.y, p.tx, p.ty);
            if (dist < 10) {
                if (p.target && p.target.alive) {
                    const bonusMult = p.target.slowed ? 1.5 : 1;
                    p.target.takeDamage(p.damage * bonusMult);
                    ParticlePool.spawn(p.x, p.y, p.color, 3);
                }
                this.pool.push(p);
                this.active.splice(i, 1);
            } else if (p.x < -50 || p.x > 850 || p.y < -50 || p.y > 650) {
                this.pool.push(p);
                this.active.splice(i, 1);
            }
        }
        
        // Update ring blasts
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.currentRadius += r.speed * dt;
            
            // Hit enemies as ring expands through them
            for (const e of enemies) {
                if (!e.alive || r.hit.has(e)) continue;
                const d = Utils.dist(r.x, r.y, e.x, e.y);
                // Enemy is within the ring band (current radius ± tolerance)
                if (d <= r.currentRadius + 15 && d >= r.currentRadius - 15) {
                    const bonusMult = e.slowed ? 1.5 : 1;
                    e.takeDamage(r.damage * bonusMult);
                    if (r.aoeSlow) {
                        e.slowed = true;
                        e.slowTimer = 2;
                    }
                    r.hit.add(e);
                    ParticlePool.spawn(e.x, e.y, r.color, 3);
                }
            }
            
            if (r.currentRadius >= r.maxRadius) {
                this.rings.splice(i, 1);
            }
        }
    },

    draw(ctx) {
        // Draw projectiles
        for (const p of this.active) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        
        // Draw ring blasts
        for (const r of this.rings) {
            const progress = r.currentRadius / r.maxRadius;
            const alpha = 1 - progress;
            
            // Outer glow (wide, faint)
            ctx.strokeStyle = r.color;
            ctx.globalAlpha = alpha * 0.15;
            ctx.shadowColor = r.color;
            ctx.shadowBlur = 20;
            ctx.lineWidth = 16;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.currentRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Main ring (bright)
            ctx.globalAlpha = alpha * 0.8;
            ctx.shadowBlur = 15;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.currentRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Fill flash at start
            if (progress < 0.3) {
                ctx.globalAlpha = (0.3 - progress) * 0.15;
                ctx.fillStyle = r.color;
                ctx.beginPath();
                ctx.arc(r.x, r.y, r.currentRadius, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
        }
    }
};
