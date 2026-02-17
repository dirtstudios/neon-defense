// Terrain system — tile-based map with terrain types
// Grid: 32 columns × 24 rows, 25px per tile
const Terrain = {
    TILE_SIZE: 25,
    COLS: 32,
    ROWS: 24,
    grid: null,        // 2D array [row][col] of terrain type strings
    _cache: null,      // Offscreen canvas for cached terrain render
    _cacheDirty: true,
    
    // Terrain types
    TYPES: {
        grass:     { buildable: true,  color: '#0a1a0a' },
        path:      { buildable: false, color: '#1a0f05' },
        water:     { buildable: false, color: '#050a1a', boatOnly: true },
        rock:      { buildable: false, color: '#1a1a1a' },
        forest:    { buildable: false, color: '#0a150a' },
        structure: { buildable: false, color: '#12100a' }
    },
    
    // Seeded RNG (borrows from Path)
    _rngState: 0,
    _seedRng(seed) { this._rngState = seed; },
    _rng() {
        let t = this._rngState += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    _rngInt(min, max) { return Math.floor(this._rng() * (max - min + 1)) + min; },
    _rngFloat(min, max) { return min + this._rng() * (max - min); },
    
    // Per-tile seeded noise for visual variation
    _tileNoise: null,
    
    init() {
        this.grid = [];
        for (let r = 0; r < this.ROWS; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.COLS; c++) {
                this.grid[r][c] = 'grass';
            }
        }
        this._cacheDirty = true;
    },
    
    // Generate terrain for current map
    generate(seed) {
        this._seedRng(seed || 1);
        this.init();
        
        // Generate per-tile noise for visual variation
        this._tileNoise = [];
        for (let r = 0; r < this.ROWS; r++) {
            this._tileNoise[r] = [];
            for (let c = 0; c < this.COLS; c++) {
                this._tileNoise[r][c] = this._rng();
            }
        }
        
        // 1. Rasterize path — mark tiles near the path spline as 'path'
        this._rasterizePath();
        
        // 2. Mark water zones
        this._rasterizeWater();
        
        // 3. Scatter forests (clusters)
        this._scatterForests();
        
        // 4. Scatter rocks
        this._scatterRocks();
        
        // 5. Scatter structures
        this._scatterStructures();
        
        this._cacheDirty = true;
    },
    
    _rasterizePath() {
        // Sample the path at fine intervals and mark nearby tiles
        const pathRadius = 1.8; // tiles radius from path center = ~3-4 tiles wide road
        
        for (let p = 0; p <= 1; p += 0.002) {
            const pos = Path.getPositionAtProgress(p);
            const gc = Math.floor(pos.x / this.TILE_SIZE);
            const gr = Math.floor(pos.y / this.TILE_SIZE);
            
            // Mark tiles in radius
            const rad = Math.ceil(pathRadius);
            for (let dr = -rad; dr <= rad; dr++) {
                for (let dc = -rad; dc <= rad; dc++) {
                    const r = gr + dr;
                    const c = gc + dc;
                    if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) continue;
                    
                    // Check distance from tile center to path point
                    const tcx = c * this.TILE_SIZE + this.TILE_SIZE / 2;
                    const tcy = r * this.TILE_SIZE + this.TILE_SIZE / 2;
                    const dist = Math.sqrt((tcx - pos.x) ** 2 + (tcy - pos.y) ** 2);
                    
                    if (dist < pathRadius * this.TILE_SIZE) {
                        this.grid[r][c] = 'path';
                    }
                }
            }
        }
    },
    
    _rasterizeWater() {
        for (const zone of Path.waterZones) {
            for (let r = 0; r < this.ROWS; r++) {
                for (let c = 0; c < this.COLS; c++) {
                    const tcx = c * this.TILE_SIZE + this.TILE_SIZE / 2;
                    const tcy = r * this.TILE_SIZE + this.TILE_SIZE / 2;
                    const dist = Math.sqrt((tcx - zone.x) ** 2 + (tcy - zone.y) ** 2);
                    if (dist < zone.radius && this.grid[r][c] !== 'path') {
                        this.grid[r][c] = 'water';
                    }
                }
            }
        }
    },
    
    _scatterForests() {
        const numPatches = this._rngInt(3, 6);
        for (let p = 0; p < numPatches; p++) {
            // Pick random grass tile as seed
            let sr, sc;
            let attempts = 0;
            do {
                sr = this._rngInt(1, this.ROWS - 2);
                sc = this._rngInt(1, this.COLS - 2);
                attempts++;
            } while (this.grid[sr][sc] !== 'grass' && attempts < 50);
            
            if (this.grid[sr][sc] !== 'grass') continue;
            
            // Random walk to create cluster
            const size = this._rngInt(4, 10);
            let cr = sr, cc = sc;
            for (let i = 0; i < size; i++) {
                if (cr >= 0 && cr < this.ROWS && cc >= 0 && cc < this.COLS && this.grid[cr][cc] === 'grass') {
                    this.grid[cr][cc] = 'forest';
                }
                // Random walk
                const dir = this._rngInt(0, 3);
                if (dir === 0) cr--;
                else if (dir === 1) cr++;
                else if (dir === 2) cc--;
                else cc++;
                cr = Math.max(0, Math.min(this.ROWS - 1, cr));
                cc = Math.max(0, Math.min(this.COLS - 1, cc));
            }
        }
    },
    
    _scatterRocks() {
        const numRocks = this._rngInt(8, 18);
        for (let i = 0; i < numRocks; i++) {
            const r = this._rngInt(0, this.ROWS - 1);
            const c = this._rngInt(0, this.COLS - 1);
            if (this.grid[r][c] === 'grass') {
                this.grid[r][c] = 'rock';
            }
        }
    },
    
    _scatterStructures() {
        const numStructures = this._rngInt(1, 3);
        for (let i = 0; i < numStructures; i++) {
            // Place near path but not on it
            let attempts = 0;
            while (attempts < 30) {
                const r = this._rngInt(1, this.ROWS - 2);
                const c = this._rngInt(1, this.COLS - 2);
                if (this.grid[r][c] === 'grass') {
                    // Check if adjacent to path
                    const neighbors = [
                        [r-1,c],[r+1,c],[r,c-1],[r,c+1]
                    ];
                    const nearPath = neighbors.some(([nr, nc]) => 
                        nr >= 0 && nr < this.ROWS && nc >= 0 && nc < this.COLS && this.grid[nr][nc] === 'path'
                    );
                    if (nearPath) {
                        this.grid[r][c] = 'structure';
                        // Sometimes make 2-tile structure
                        if (this._rng() > 0.5 && c + 1 < this.COLS && this.grid[r][c+1] === 'grass') {
                            this.grid[r][c+1] = 'structure';
                        }
                        break;
                    }
                }
                attempts++;
            }
        }
    },
    
    // Check if a pixel position is buildable
    canBuild(px, py) {
        const c = Math.floor(px / this.TILE_SIZE);
        const r = Math.floor(py / this.TILE_SIZE);
        if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) return false;
        return this.TYPES[this.grid[r][c]].buildable;
    },
    
    // Check if pixel position is water (for boat towers)
    isWaterTile(px, py) {
        const c = Math.floor(px / this.TILE_SIZE);
        const r = Math.floor(py / this.TILE_SIZE);
        if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) return false;
        return this.grid[r][c] === 'water';
    },
    
    // Get terrain type at pixel position
    getType(px, py) {
        const c = Math.floor(px / this.TILE_SIZE);
        const r = Math.floor(py / this.TILE_SIZE);
        if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) return 'grass';
        return this.grid[r][c];
    },
    
    // Render terrain to offscreen canvas (called once per map gen)
    _renderCache(theme) {
        if (!this._cache) {
            this._cache = document.createElement('canvas');
            this._cache.width = 800;
            this._cache.height = 600;
        }
        
        const ctx = this._cache.getContext('2d');
        const ts = this.TILE_SIZE;
        const pathColor = theme ? theme.path : 'rgba(0, 243, 255,';
        
        // Theme color influence
        const themeHue = this._extractHue(pathColor);
        
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const type = this.grid[r][c];
                const x = c * ts;
                const y = r * ts;
                const noise = this._tileNoise ? this._tileNoise[r][c] : 0.5;
                
                this._drawTile(ctx, x, y, ts, type, noise, theme, r, c);
            }
        }
        
        // Draw path flow arrows on top
        this._drawPathFlow(ctx, theme);
        
        // Draw entry/exit markers
        this._drawEntryExit(ctx);
        
        this._cacheDirty = false;
    },
    
    _extractHue(pathColorStr) {
        // Simple extraction of dominant channel from "rgba(r, g, b," string
        const match = pathColorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return { r: 0, g: 243, b: 255 };
        return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
    },
    
    // Hash for per-pixel deterministic noise
    _hash(a, b) {
        let h = (a * 2654435761 ^ b * 2246822519) >>> 0;
        h = Math.imul(h ^ (h >>> 13), 3266489917);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    },
    
    _drawTile(ctx, x, y, ts, type, noise, theme, row, col) {
        // All rendering is procedural at native 25px — no sprite downscaling
        switch(type) {
            case 'grass': {
                // Rich green base with per-pixel variation for organic look
                const baseR = 58, baseG = 175, baseB = 80;
                const imgData = ctx.createImageData(ts, ts);
                const d = imgData.data;
                for (let py = 0; py < ts; py++) {
                    for (let px = 0; px < ts; px++) {
                        const h = this._hash(x + px, y + py);
                        const h2 = this._hash(x + px + 1000, y + py + 1000);
                        // Grass blade brightness variation
                        const blade = h > 0.7 ? 20 : (h > 0.4 ? 8 : 0);
                        // Subtle darker patches
                        const patch = h2 > 0.85 ? -15 : 0;
                        const i = (py * ts + px) * 4;
                        d[i]     = Math.min(255, baseR + blade + patch + (noise * 12 | 0));
                        d[i + 1] = Math.min(255, baseG + blade * 2 + patch + (noise * 20 | 0));
                        d[i + 2] = Math.min(255, baseB + blade + patch + (noise * 8 | 0));
                        d[i + 3] = 255;
                    }
                }
                ctx.putImageData(imgData, x, y);
                break;
            }
            case 'path': {
                // Warm sandy-brown dirt with pebble specks
                const baseR = 194, baseG = 155, baseB = 97;
                const imgData = ctx.createImageData(ts, ts);
                const d = imgData.data;
                for (let py = 0; py < ts; py++) {
                    for (let px = 0; px < ts; px++) {
                        const h = this._hash(x + px, y + py);
                        const h2 = this._hash(x + px + 500, y + py + 500);
                        // Pebble highlights
                        const pebble = h > 0.92 ? 30 : (h > 0.88 ? -20 : 0);
                        // Grain variation
                        const grain = ((h2 * 16) | 0) - 8;
                        const i = (py * ts + px) * 4;
                        d[i]     = Math.min(255, Math.max(0, baseR + pebble + grain + (noise * 10 | 0)));
                        d[i + 1] = Math.min(255, Math.max(0, baseG + pebble + grain + (noise * 8 | 0)));
                        d[i + 2] = Math.min(255, Math.max(0, baseB + pebble * 0.7 + grain + (noise * 5 | 0)));
                        d[i + 3] = 255;
                    }
                }
                ctx.putImageData(imgData, x, y);
                // Subtle edge darkening where path meets grass
                if (row > 0 && this.grid[row-1][col] !== 'path') {
                    ctx.fillStyle = 'rgba(0,0,0,0.08)';
                    ctx.fillRect(x, y, ts, 2);
                }
                if (row < this.ROWS-1 && this.grid[row+1][col] !== 'path') {
                    ctx.fillStyle = 'rgba(0,0,0,0.08)';
                    ctx.fillRect(x, y + ts - 2, ts, 2);
                }
                if (col > 0 && this.grid[row][col-1] !== 'path') {
                    ctx.fillStyle = 'rgba(0,0,0,0.08)';
                    ctx.fillRect(x, y, 2, ts);
                }
                if (col < this.COLS-1 && this.grid[row][col+1] !== 'path') {
                    ctx.fillStyle = 'rgba(0,0,0,0.08)';
                    ctx.fillRect(x + ts - 2, y, 2, ts);
                }
                break;
            }
            case 'water': {
                // Bright blue with subtle depth variation
                const baseR = 52, baseG = 140, baseB = 210;
                const imgData = ctx.createImageData(ts, ts);
                const d = imgData.data;
                for (let py = 0; py < ts; py++) {
                    for (let px = 0; px < ts; px++) {
                        const h = this._hash(x + px, y + py);
                        const shimmer = h > 0.9 ? 25 : 0;
                        const wave = Math.sin((x + px) * 0.3 + (y + py) * 0.2) * 8;
                        const i = (py * ts + px) * 4;
                        d[i]     = Math.min(255, baseR + shimmer + (wave | 0));
                        d[i + 1] = Math.min(255, baseG + shimmer + (wave * 0.5 | 0) + (noise * 15 | 0));
                        d[i + 2] = Math.min(255, baseB + shimmer + (noise * 10 | 0));
                        d[i + 3] = 255;
                    }
                }
                ctx.putImageData(imgData, x, y);
                break;
            }
            case 'rock': {
                // Grass base then rock on top
                this._drawTile(ctx, x, y, ts, 'grass', noise, theme, row, col);
                // Grey boulder
                const cx = x + ts/2, cy = y + ts/2;
                const r1 = ts * 0.35, r2 = ts * 0.28;
                ctx.fillStyle = `rgb(${140 + noise * 30 | 0}, ${135 + noise * 25 | 0}, ${125 + noise * 20 | 0})`;
                ctx.beginPath();
                ctx.ellipse(cx, cy + 1, r1, r2, 0, 0, Math.PI * 2);
                ctx.fill();
                // Highlight
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.beginPath();
                ctx.ellipse(cx - 2, cy - 2, r1 * 0.5, r2 * 0.4, -0.3, 0, Math.PI * 2);
                ctx.fill();
                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.15)';
                ctx.beginPath();
                ctx.ellipse(cx + 2, cy + 3, r1 * 0.6, r2 * 0.3, 0.2, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'forest': {
                // Grass base then tree
                this._drawTile(ctx, x, y, ts, 'grass', noise, theme, row, col);
                const cx = x + ts/2, cy = y + ts/2;
                // Trunk
                ctx.fillStyle = 'rgb(120, 85, 50)';
                ctx.fillRect(cx - 2, cy, 4, ts * 0.35);
                // Canopy — layered circles for fullness
                const canopyG = 80 + noise * 60 | 0;
                ctx.fillStyle = `rgb(30, ${canopyG + 40}, 30)`;
                ctx.beginPath();
                ctx.arc(cx, cy - 1, ts * 0.38, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = `rgb(45, ${canopyG + 60}, 40)`;
                ctx.beginPath();
                ctx.arc(cx - 2, cy - 3, ts * 0.25, 0, Math.PI * 2);
                ctx.fill();
                // Light dapple
                ctx.fillStyle = 'rgba(100, 220, 80, 0.3)';
                ctx.beginPath();
                ctx.arc(cx + 2, cy - 4, ts * 0.12, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'structure': {
                // Grass base then small building
                this._drawTile(ctx, x, y, ts, 'grass', noise, theme, row, col);
                const bx = x + 3, by = y + 4;
                const bw = ts - 6, bh = ts - 7;
                // Walls
                ctx.fillStyle = `rgb(${175 + noise * 20 | 0}, ${160 + noise * 15 | 0}, ${130 + noise * 10 | 0})`;
                ctx.fillRect(bx, by + 4, bw, bh - 4);
                // Roof
                ctx.fillStyle = `rgb(${145 + noise * 20 | 0}, ${75 + noise * 15 | 0}, ${45})`;
                ctx.beginPath();
                ctx.moveTo(bx - 1, by + 5);
                ctx.lineTo(bx + bw / 2, by);
                ctx.lineTo(bx + bw + 1, by + 5);
                ctx.fill();
                // Door
                ctx.fillStyle = 'rgb(90, 60, 35)';
                ctx.fillRect(bx + bw/2 - 2, by + bh - 6, 4, 6);
                // Window glow
                ctx.fillStyle = 'rgba(255, 230, 100, 0.7)';
                ctx.fillRect(bx + 3, by + 7, 3, 3);
                break;
            }
        }
    },
    
    _isPathEdge(row, col) {
        if (this.grid[row][col] !== 'path') return false;
        const neighbors = [[row-1,col],[row+1,col],[row,col-1],[row,col+1]];
        return neighbors.some(([r, c]) => {
            if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) return false;
            return this.grid[r][c] !== 'path';
        });
    },
    
    _drawPathFlow(ctx, theme) {
        // Subtle directional arrows on the path
        const pathColor = theme ? theme.path : 'rgba(0, 243, 255,';
        const spline = Path.getSpline();
        
        ctx.save();
        ctx.setLineDash([4, 26]);
        ctx.lineDashOffset = 0;
        ctx.beginPath();
        ctx.moveTo(spline[0].x, spline[0].y);
        for (let i = 1; i < spline.length; i++) ctx.lineTo(spline[i].x, spline[i].y);
        ctx.strokeStyle = pathColor + '0.15)';
        ctx.lineWidth = 1;
        ctx.lineCap = 'butt';
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    },
    
    _drawEntryExit(ctx) {
        const entry = Path.points[0];
        const exit = Path.points[Path.points.length - 1];
        
        ctx.fillStyle = '#00ff66';
        ctx.shadowColor = '#00ff66';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(Math.max(10, entry.x), entry.y, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ff0055';
        ctx.shadowColor = '#ff0055';
        ctx.beginPath();
        ctx.arc(Math.min(790, exit.x), exit.y, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
    },
    
    // Draw the cached terrain (fast — just one drawImage call)
    draw(ctx, theme) {
        if (this._cacheDirty || !this._cache) {
            this._renderCache(theme);
        }
        ctx.drawImage(this._cache, 0, 0);
        
        // Animate water ripples (drawn on top of cache each frame)
        this._drawWaterAnimation(ctx, theme);
        
        // Animate path flow arrows
        this._drawFlowAnimation(ctx, theme);
    },
    
    _waterTime: 0,
    _drawWaterAnimation(ctx, theme) {
        this._waterTime += 0.02;
        const hue = theme ? this._extractHue(theme.path) : { r: 0, g: 243, b: 255 };
        const ts = this.TILE_SIZE;
        
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (this.grid[r][c] !== 'water') continue;
                
                const x = c * ts;
                const y = r * ts;
                const noise = this._tileNoise ? this._tileNoise[r][c] : 0.5;
                
                // Animated ripple line
                const rippleY = y + ts * 0.3 + Math.sin(this._waterTime * 2 + c * 0.8 + r * 0.3) * 3;
                ctx.strokeStyle = `rgba(${Math.floor(hue.r * 0.2)}, ${Math.floor(hue.g * 0.25)}, ${Math.floor(hue.b * 0.4)}, ${0.08 + Math.sin(this._waterTime + noise * 6) * 0.04})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x + 2, rippleY);
                ctx.lineTo(x + ts - 2, rippleY);
                ctx.stroke();
            }
        }
    },
    
    _flowOffset: 0,
    _drawFlowAnimation(ctx, theme) {
        const pathColor = theme ? theme.path : 'rgba(0, 243, 255,';
        const spline = Path.getSpline();
        
        this._flowOffset = (this._flowOffset + 0.3) % 30;
        
        ctx.save();
        ctx.setLineDash([4, 26]);
        ctx.lineDashOffset = -this._flowOffset;
        ctx.beginPath();
        ctx.moveTo(spline[0].x, spline[0].y);
        for (let i = 1; i < spline.length; i++) ctx.lineTo(spline[i].x, spline[i].y);
        ctx.strokeStyle = pathColor + '0.2)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'butt';
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }
};
