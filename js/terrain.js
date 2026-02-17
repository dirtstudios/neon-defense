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
    
    _drawTile(ctx, x, y, ts, type, noise, theme, row, col) {
        const S = Sprites.TILES;
        
        // Try sprite-based rendering first
        if (Sprites.loaded) {
            switch(type) {
                case 'grass':
                    Sprites.drawTile(ctx, S.GRASS, x, y, ts, ts);
                    return;
                case 'path': {
                    Sprites.drawTile(ctx, S.DIRT, x, y, ts, ts);
                    return;
                }
                case 'water':
                    // Use grass as base, tint blue
                    Sprites.drawTile(ctx, S.GRASS, x, y, ts, ts);
                    ctx.fillStyle = 'rgba(20, 60, 140, 0.6)';
                    ctx.fillRect(x, y, ts, ts);
                    return;
                case 'rock':
                    Sprites.drawTile(ctx, S.GRASS, x, y, ts, ts);
                    // Draw rock sprite on top
                    const rockTile = noise > 0.6 ? S.ROCK_LG : (noise > 0.3 ? S.ROCK_MD : S.ROCK_SM);
                    Sprites.drawTile(ctx, rockTile, x, y, ts, ts);
                    return;
                case 'forest':
                    Sprites.drawTile(ctx, S.GRASS, x, y, ts, ts);
                    const treeTile = noise > 0.5 ? S.TREE1 : S.TREE2;
                    Sprites.drawTile(ctx, treeTile, x, y, ts, ts);
                    return;
                case 'structure':
                    Sprites.drawTile(ctx, S.GRASS, x, y, ts, ts);
                    const bushTile = noise > 0.5 ? S.BUSH1 : S.BUSH2;
                    Sprites.drawTile(ctx, bushTile, x, y, ts, ts);
                    return;
            }
        }
        
        // Fallback: procedural rendering if sprites not loaded
        const hue = theme ? this._extractHue(theme.path) : { r: 0, g: 243, b: 255 };
        switch(type) {
            case 'grass': {
                const brightness = 25 + noise * 20;
                ctx.fillStyle = `rgb(${brightness}, ${brightness + 35}, ${brightness})`;
                ctx.fillRect(x, y, ts, ts);
                break;
            }
            case 'path': {
                const base = 50 + noise * 15;
                ctx.fillStyle = `rgb(${base + 20}, ${base + 10}, ${base - 5})`;
                ctx.fillRect(x, y, ts, ts);
                break;
            }
            case 'water': {
                const depth = 15 + noise * 12;
                ctx.fillStyle = `rgb(${depth + 5}, ${depth + 15}, ${depth + 45})`;
                ctx.fillRect(x, y, ts, ts);
                break;
            }
            case 'rock': {
                ctx.fillStyle = `rgb(${25 + noise * 15}, ${25 + noise * 15 + 30}, ${25 + noise * 15})`;
                ctx.fillRect(x, y, ts, ts);
                ctx.fillStyle = `rgb(${55 + Math.floor(noise * 25)}, ${50 + Math.floor(noise * 20)}, ${45})`;
                ctx.beginPath();
                ctx.arc(x + ts/2, y + ts/2, ts * 0.3, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'forest': {
                ctx.fillStyle = `rgb(${18 + noise * 12}, ${18 + noise * 12 + 22}, ${18 + noise * 12})`;
                ctx.fillRect(x, y, ts, ts);
                ctx.fillStyle = `rgb(20, ${60 + Math.floor(noise * 30)}, 20)`;
                ctx.beginPath();
                ctx.arc(x + ts/2, y + ts/2, ts * 0.35, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'structure': {
                ctx.fillStyle = `rgb(${25 + noise * 12}, ${25 + noise * 12 + 25}, ${25 + noise * 12})`;
                ctx.fillRect(x, y, ts, ts);
                ctx.fillStyle = `rgb(${50 + Math.floor(noise * 15)}, ${45 + Math.floor(noise * 12)}, ${38})`;
                ctx.fillRect(x + ts*0.15, y + ts*0.15, ts*0.7, ts*0.7);
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
