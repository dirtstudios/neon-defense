// Test suite for path system
import { test, describe } from 'node:test';
import assert from 'node:assert';

// Mock Utils for path tests
global.Utils = {
    GRID: 20,
    lerp: (a, b, t) => a + (b - a) * t,
    dist: (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
};

// Import path system
// Since we can't easily import, we'll recreate the Path object for testing
const createPathSystem = () => ({
    points: [
        { x: -20, y: 100 },
        { x: 50, y: 100 },
        { x: 150, y: 100 },
        { x: 250, y: 100 },
        { x: 350, y: 100 },
        { x: 450, y: 100 },
        { x: 550, y: 100 },
        { x: 620, y: 110 },
        { x: 660, y: 130 },
        { x: 680, y: 150 },
        { x: 690, y: 180 },
        { x: 700, y: 220 },
        { x: 700, y: 260 },
        { x: 700, y: 300 },
        { x: 700, y: 340 },
        { x: 690, y: 380 },
        { x: 680, y: 400 },
        { x: 660, y: 420 },
        { x: 620, y: 440 },
        { x: 580, y: 450 },
        { x: 520, y: 460 },
        { x: 450, y: 460 },
        { x: 380, y: 460 },
        { x: 310, y: 460 },
        { x: 250, y: 460 },
        { x: 190, y: 460 },
        { x: 140, y: 470 },
        { x: 110, y: 485 },
        { x: 95, y: 510 },
        { x: 95, y: 530 },
        { x: 110, y: 550 },
        { x: 140, y: 565 },
        { x: 180, y: 570 },
        { x: 230, y: 570 },
        { x: 290, y: 570 },
        { x: 360, y: 570 },
        { x: 440, y: 570 },
        { x: 520, y: 570 },
        { x: 600, y: 570 },
        { x: 680, y: 570 },
        { x: 760, y: 570 },
        { x: 820, y: 570 }
    ],
    
    _totalLength: null,
    _segmentLengths: null,
    _blocked: null,
    
    init() {
        this._calculatePathLength();
    },
    
    _calculatePathLength() {
        if (this._segmentLengths) return;
        
        this._segmentLengths = [];
        this._totalLength = 0;
        
        for (let i = 0; i < this.points.length - 1; i++) {
            const p1 = this.points[i];
            const p2 = this.points[i + 1];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            this._segmentLengths.push(length);
            this._totalLength += length;
        }
    },
    
    getPositionAtProgress(progress) {
        if (!this._segmentLengths) this._calculatePathLength();
        
        progress = Math.max(0, Math.min(1, progress));
        
        if (progress === 0) return { ...this.points[0] };
        if (progress === 1) return { ...this.points[this.points.length - 1] };
        
        const targetDistance = progress * this._totalLength;
        let currentDistance = 0;
        
        for (let i = 0; i < this._segmentLengths.length; i++) {
            const segmentLength = this._segmentLengths[i];
            if (currentDistance + segmentLength >= targetDistance) {
                const segmentProgress = (targetDistance - currentDistance) / segmentLength;
                const p1 = this.points[i];
                const p2 = this.points[i + 1];
                
                return {
                    x: p1.x + (p2.x - p1.x) * segmentProgress,
                    y: p1.y + (p2.y - p1.y) * segmentProgress
                };
            }
            currentDistance += segmentLength;
        }
        
        return { ...this.points[this.points.length - 1] };
    },
    
    getTotalLength() {
        if (!this._totalLength) this._calculatePathLength();
        return this._totalLength;
    },

    getBlocked() {
        if (this._blocked) return this._blocked;
        this._blocked = new Set();
        for (let i = 0; i < this.points.length - 1; i++) {
            const p1 = this.points[i], p2 = this.points[i + 1];
            const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
            const steps = Math.ceil(dist / 10);
            for (let s = 0; s <= steps; s++) {
                const t = s / steps;
                const x = p1.x + (p2.x - p1.x) * t;
                const y = p1.y + (p2.y - p1.y) * t;
                const gx = Math.floor(x / Utils.GRID);
                const gy = Math.floor(y / Utils.GRID);
                this._blocked.add(`${gx},${gy}`);
            }
        }
        return this._blocked;
    }
});

describe('Path System', () => {
    test('should initialize with proper S-curve points', () => {
        const path = createPathSystem();
        path.init();
        
        assert.strictEqual(path.points.length, 42);
        assert.deepEqual(path.points[0], { x: -20, y: 100 });
        assert.deepEqual(path.points[path.points.length - 1], { x: 820, y: 570 });
    });

    test('should calculate total path length', () => {
        const path = createPathSystem();
        path.init();
        
        const totalLength = path.getTotalLength();
        assert.strictEqual(typeof totalLength, 'number');
        assert.strictEqual(totalLength > 0, true);
        
        // Should be reasonable length for an S-curve across 800x600 canvas
        assert.strictEqual(totalLength > 1000, true); // At least 1000 pixels
        assert.strictEqual(totalLength < 3000, true); // Less than 3000 pixels
    });

    test('should return start position at progress 0', () => {
        const path = createPathSystem();
        path.init();
        
        const pos = path.getPositionAtProgress(0);
        assert.deepEqual(pos, { x: -20, y: 100 });
    });

    test('should return end position at progress 1', () => {
        const path = createPathSystem();
        path.init();
        
        const pos = path.getPositionAtProgress(1);
        assert.deepEqual(pos, { x: 820, y: 570 });
    });

    test('should return interpolated position at progress 0.5', () => {
        const path = createPathSystem();
        path.init();
        
        const pos = path.getPositionAtProgress(0.5);
        assert.strictEqual(typeof pos.x, 'number');
        assert.strictEqual(typeof pos.y, 'number');
        
        // Should be somewhere in the middle of the canvas
        assert.strictEqual(pos.x > 0, true);
        assert.strictEqual(pos.x < 800, true);
        assert.strictEqual(pos.y > 0, true);
        assert.strictEqual(pos.y < 600, true);
    });

    test('should handle progress values outside 0-1 range', () => {
        const path = createPathSystem();
        path.init();
        
        const negativePos = path.getPositionAtProgress(-0.5);
        const overOnePos = path.getPositionAtProgress(1.5);
        
        // Should clamp to valid range
        assert.deepEqual(negativePos, { x: -20, y: 100 });
        assert.deepEqual(overOnePos, { x: 820, y: 570 });
    });

    test('should create blocked cells along path', () => {
        const path = createPathSystem();
        path.init();
        
        const blocked = path.getBlocked();
        assert.strictEqual(blocked instanceof Set, true);
        assert.strictEqual(blocked.size > 0, true);
        
        // Should have reasonable number of blocked cells
        assert.strictEqual(blocked.size > 50, true); // At least 50 cells blocked
        assert.strictEqual(blocked.size < 500, true); // Less than 500 cells blocked
    });

    test('should provide smooth movement along path', () => {
        const path = createPathSystem();
        path.init();
        
        // Test that small progress increments result in smooth movement
        const pos1 = path.getPositionAtProgress(0.1);
        const pos2 = path.getPositionAtProgress(0.11);
        
        const distance = Math.sqrt((pos2.x - pos1.x) ** 2 + (pos2.y - pos1.y) ** 2);
        
        // Distance should be reasonable (not jumping large distances)
        assert.strictEqual(distance > 0, true);
        assert.strictEqual(distance < 50, true); // Less than 50 pixels for 1% progress
    });
});

describe('Enemy Path Movement', () => {
    // Mock enemy creation for testing movement
    const createTestEnemy = (pathSystem) => ({
        pathProgress: 0,
        speed: 2,
        baseSpeed: 2,
        slowed: false,
        slowTimer: 0,
        alive: true,
        reachedEnd: false,
        x: 0,
        y: 0,
        
        update(dt, speedMult, path) {
            if (!this.alive) return;

            if (this.slowed) {
                this.speed = this.baseSpeed * 0.5;
                this.slowTimer -= dt;
                if (this.slowTimer <= 0) {
                    this.slowed = false;
                    this.speed = this.baseSpeed;
                }
            }

            const moveSpeed = this.speed * speedMult * 60 * dt;
            const pathLength = path.getTotalLength();
            const progressIncrement = moveSpeed / pathLength;
            
            this.pathProgress += progressIncrement;
            this.pathProgress = Math.min(1, this.pathProgress);
            
            if (this.pathProgress >= 1) {
                this.alive = false;
                this.reachedEnd = true;
                return;
            }
            
            const pos = path.getPositionAtProgress(this.pathProgress);
            this.x = pos.x;
            this.y = pos.y;
        }
    });

    test('should move enemy along path smoothly', () => {
        const path = createPathSystem();
        path.init();
        const enemy = createTestEnemy(path);
        
        // Initialize position
        const startPos = path.getPositionAtProgress(0);
        enemy.x = startPos.x;
        enemy.y = startPos.y;
        
        const initialX = enemy.x;
        const initialY = enemy.y;
        
        // Update enemy for one frame (16.67ms)
        enemy.update(1/60, 1, path);
        
        // Enemy should have moved
        assert.notStrictEqual(enemy.x, initialX);
        assert.strictEqual(enemy.pathProgress > 0, true);
        assert.strictEqual(enemy.pathProgress < 1, true);
    });

    test('should trigger end-reached when progress reaches 1', () => {
        const path = createPathSystem();
        path.init();
        const enemy = createTestEnemy(path);
        
        // Set enemy almost at the end
        enemy.pathProgress = 0.99;
        
        // Update with large dt to push past end
        enemy.update(1, 1, path);
        
        assert.strictEqual(enemy.pathProgress, 1);
        assert.strictEqual(enemy.alive, false);
        assert.strictEqual(enemy.reachedEnd, true);
    });

    test('should handle slow effect properly', () => {
        const path = createPathSystem();
        path.init();
        const enemy = createTestEnemy(path);
        
        // Apply slow effect
        enemy.slowed = true;
        enemy.slowTimer = 1.0; // 1 second of slow
        
        const initialProgress = enemy.pathProgress;
        
        // Update for one frame
        enemy.update(1/60, 1, path);
        
        // Should move slower when slowed
        assert.strictEqual(enemy.speed, enemy.baseSpeed * 0.5);
        
        // Update for longer to remove slow effect
        enemy.update(1.1, 1, path); // More than slowTimer
        
        assert.strictEqual(enemy.slowed, false);
        assert.strictEqual(enemy.speed, enemy.baseSpeed);
    });
});