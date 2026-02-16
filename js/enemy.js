// Enemy definitions and class
const EnemyTypes = {
    basic:  { hp: 30, speed: 2, gold: 10, color: '#ff0055', size: 8, shape: 'circle' },
    fast:   { hp: 20, speed: 3, gold: 15, color: '#ff3388', size: 6, shape: 'diamond' },
    tank:   { hp: 100, speed: 1, gold: 30, color: '#ff0055', size: 12, shape: 'hexagon' },
    boss:   { hp: 500, speed: 0.5, gold: 100, color: '#ff0055', size: 18, shape: 'hexagon' }
};

function createEnemy(type, waveNum) {
    const def = EnemyTypes[type];
    const hpScale = 1 + waveNum * 0.2;
    const startPos = Path.getPositionAtProgress(0);
    return {
        type: type,
        x: startPos.x,
        y: startPos.y,
        hp: Math.floor(def.hp * hpScale),
        maxHp: Math.floor(def.hp * hpScale),
        speed: def.speed,
        baseSpeed: def.speed,
        gold: def.gold,
        color: def.color,
        size: def.size,
        shape: def.shape,
        alive: true,
        pathProgress: 0,
        slowed: false,
        slowTimer: 0,
        poisoned: false,
        poisonDamage: 0,
        poisonTimer: 0,
        poisonTick: 0,

        takeDamage(dmg) {
            this.hp -= dmg;
            if (this.hp <= 0) {
                this.hp = 0;
                this.alive = false;
            }
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

            // Move along path using smooth progress
            if (this.pathProgress >= 1) {
                this.alive = false;
                this.reachedEnd = true;
                return;
            }

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
            }

            ctx.shadowBlur = 0;

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
        }
    };
}
