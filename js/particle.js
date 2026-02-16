// Object-pooled particles for death effects
const ParticlePool = {
    pool: [],
    active: [],
    MAX: 500,

    init() {
        for (let i = 0; i < this.MAX; i++) {
            this.pool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 0, color: '', shape: 0 });
        }
    },

    spawn(x, y, color, count) {
        for (let i = 0; i < count && this.pool.length > 0; i++) {
            const p = this.pool.pop();
            const angle = Utils.rand(0, Math.PI * 2);
            const speed = Utils.rand(1, 4);
            p.x = x;
            p.y = y;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
            p.life = 1;
            p.maxLife = Utils.rand(0.3, 0.8);
            p.size = Utils.rand(2, 6);
            p.color = color;
            p.shape = Utils.randInt(0, 2); // 0=square, 1=triangle, 2=circle
            this.active.push(p);
        }
    },

    update(dt) {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const p = this.active[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.96;
            p.vy *= 0.96;
            p.life -= dt / p.maxLife;
            if (p.life <= 0) {
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
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 6;

            if (p.shape === 0) {
                ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            } else if (p.shape === 1) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y - p.size);
                ctx.lineTo(p.x - p.size, p.y + p.size);
                ctx.lineTo(p.x + p.size, p.y + p.size);
                ctx.closePath();
                ctx.fill();
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
