// Object-pooled particles for death effects
const ParticlePool = {
    pool: [],
    active: [],
    MAX: 800,

    init() {
        for (let i = 0; i < this.MAX; i++) {
            this.pool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 0, color: '', shape: 0, stroke: false, gravity: 0, shrink: 0 });
        }
    },

    spawn(x, y, color, count, opts = {}) {
        for (let i = 0; i < count && this.pool.length > 0; i++) {
            const p = this.pool.pop();
            const angle = opts.directional ? (opts.angle + Utils.rand(-0.45, 0.45)) : Utils.rand(0, Math.PI * 2);
            const speed = Utils.rand(opts.minSpeed || 1, opts.maxSpeed || 4);
            p.x = x;
            p.y = y;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
            p.life = 1;
            p.maxLife = Utils.rand(opts.minLife || 0.2, opts.maxLife || 0.8);
            p.size = Utils.rand(opts.minSize || 2, opts.maxSize || 6);
            p.color = color;
            p.shape = opts.shape ?? Utils.randInt(0, 2); // 0=square, 1=triangle, 2=circle, 3=line
            p.stroke = !!opts.stroke;
            p.gravity = opts.gravity || 0;
            p.shrink = opts.shrink ?? 0.96;
            this.active.push(p);
        }
    },

    impact(x, y, color, angle = 0) {
        this.spawn(x, y, color, 5, { directional: true, angle, minSpeed: 2, maxSpeed: 5, minLife: 0.12, maxLife: 0.3, minSize: 2, maxSize: 4, shape: 3, stroke: true, shrink: 0.92 });
        this.spawn(x, y, '#ffffff', 2, { directional: true, angle, minSpeed: 1, maxSpeed: 3, minLife: 0.08, maxLife: 0.18, minSize: 1, maxSize: 2, shape: 2 });
    },

    explosion(x, y, color, big = false) {
        this.spawn(x, y, color, big ? 22 : 10, { minSpeed: 1, maxSpeed: big ? 7 : 4.5, minLife: 0.25, maxLife: 0.7, minSize: 2, maxSize: big ? 8 : 5, shrink: 0.95 });
        this.spawn(x, y, '#ffffff', big ? 8 : 4, { minSpeed: 1, maxSpeed: big ? 5 : 3, minLife: 0.1, maxLife: 0.25, minSize: 1, maxSize: 3, shape: 2 });
    },

    update(dt) {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const p = this.active[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.96;
            p.vy = p.vy * 0.96 + p.gravity;
            p.size *= p.shrink;
            p.life -= dt / p.maxLife;
            if (p.life <= 0 || p.size <= 0.3) {
                this.pool.push(p);
                this.active.splice(i, 1);
            }
        }
    },

    draw(ctx) {
        for (const p of this.active) {
            const alpha = Utils.clamp(p.life, 0, 1);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.strokeStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;

            if (p.shape === 0) {
                ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            } else if (p.shape === 1) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y - p.size);
                ctx.lineTo(p.x - p.size, p.y + p.size);
                ctx.lineTo(p.x + p.size, p.y + p.size);
                ctx.closePath();
                ctx.fill();
            } else if (p.shape === 3) {
                ctx.lineWidth = Math.max(1, p.size * 0.45);
                ctx.beginPath();
                ctx.moveTo(p.x - p.size, p.y - p.size * 0.2);
                ctx.lineTo(p.x + p.size, p.y + p.size * 0.2);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }
};
