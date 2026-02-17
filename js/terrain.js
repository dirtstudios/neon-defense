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
        const hue = theme ? this._extractHue(theme.path) : { r: 0, g: 243, b: 255 };
        
        switch(type) {
            case 'grass': {
                // Rich green base with theme tint and noise variation
                const brightness = 25 + noise * 20;
                const greenBoost = 40 + noise * 25;
                const tintR = Math.floor(hue.r * 0.04);
                const tintB = Math.floor(hue.b * 0.04);
                ctx.fillStyle = `rgb(${brightness + tintR}, ${greenBoost + brightness}, ${brightness + tintB})`;
                ctx.fillRect(x, y, ts, ts);
                
                // Subtle grass blades on many tiles
                if (noise > 0.4) {
                    const bladeAlpha = 0.3 + noise * 0.3;
                    ctx.strokeStyle = `rgba(${50 + tintR}, ${80 + Math.floor(noise * 40)}, ${35 + tintB}, ${bladeAlpha})`;
                    ctx.lineWidth = 1;
                    // Multiple blades per tile for coverage
                    for (let b = 0; b < 3; b++) {
                        const bx = x + ((noise * 7 + b * 11) % 1) * ts * 0.8 + ts * 0.1;
                        const by = y + ts * (0.6 + b * 0.12);
                        ctx.beginPath();
                        ctx.moveTo(bx, by);
                        ctx.lineTo(bx + (b - 1) * 2, by - 5 - noise * 5);
                        ctx.stroke();
                    }
                }
                
                // Occasional tiny flower
                if (noise > 0.9) {
                    const flowerColors = ['#ff6688', '#ffaa44', '#aa88ff', '#44ddff'];
                    ctx.fillStyle = flowerColors[Math.floor(noise * 40) % flowerColors.length];
                    ctx.globalAlpha = 0.7;
                    ctx.beginPath();
                    ctx.arc(x + ts * 0.3, y + ts * 0.5, 2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }
                break;
            }
            
            case 'path': {
                // Dirt road — warm sandy brown, lighter center
                const isEdge = this._isPathEdge(row, col);
                const base = isEdge ? 35 + noise * 10 : 50 + noise * 15;
                ctx.fillStyle = `rgb(${base + 20}, ${base + 10}, ${base - 5})`;
                ctx.fillRect(x, y, ts, ts);
                
                // Edge transition — blend toward grass
                if (isEdge) {
                    ctx.fillStyle = `rgba(30, 55, 30, 0.25)`;
                    ctx.fillRect(x, y, ts, ts);
                }
                
                // Texture — scattered dots and pebbles
                if (noise > 0.4) {
                    ctx.fillStyle = `rgba(${65 + Math.floor(noise * 25)}, ${50 + Math.floor(noise * 20)}, ${30}, 0.25)`;
                    ctx.beginPath();
                    ctx.arc(x + noise * ts, y + (1-noise) * ts, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                }
                if (noise > 0.75) {
                    ctx.fillStyle = `rgba(80, 70, 55, 0.3)`;
                    ctx.beginPath();
                    ctx.arc(x + ts * 0.7, y + ts * 0.3, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }
            
            case 'water': {
                // Rich blue with theme tint
                const depth = 15 + noise * 12;
                ctx.fillStyle = `rgb(${depth + 5}, ${depth + 15}, ${depth + 45})`;
                ctx.fillRect(x, y, ts, ts);
                
                // Static highlight shimmer
                if (noise > 0.4) {
                    ctx.fillStyle = `rgba(${30 + Math.floor(hue.r * 0.2)}, ${40 + Math.floor(hue.g * 0.2)}, ${80 + Math.floor(hue.b * 0.3)}, 0.15)`;
                    ctx.fillRect(x + 3, y + noise * ts * 0.5, ts - 6, 1);
                }
                break;
            }
            
            case 'rock': {
                // Grass underneath
                const gBright = 25 + noise * 15;
                ctx.fillStyle = `rgb(${gBright}, ${gBright + 30}, ${gBright})`;
                ctx.fillRect(x, y, ts, ts);
                
                // Rock — irregular polygon, brighter
                ctx.fillStyle = `rgb(${55 + Math.floor(noise * 25)}, ${50 + Math.floor(noise * 20)}, ${45 + Math.floor(noise * 18)})`;
                ctx.beginPath();
                const cx = x + ts / 2;
                const cy = y + ts / 2;
                const sz = ts * 0.35 + noise * ts * 0.12;
                for (let i = 0; i < 6; i++) {
                    const a = (Math.PI / 3) * i + noise * 0.5;
                    const r = sz * (0.7 + ((noise * 7 + i * 3) % 1) * 0.3);
                    const px = cx + Math.cos(a) * r;
                    const py = cy + Math.sin(a) * r;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                
                // Highlight on top-left
                ctx.fillStyle = `rgba(255, 255, 255, 0.1)`;
                ctx.beginPath();
                ctx.arc(cx - 2, cy - 2, sz * 0.35, 0, Math.PI * 2);
                ctx.fill();
                
                // Shadow on bottom-right
                ctx.fillStyle = `rgba(0, 0, 0, 0.15)`;
                ctx.beginPath();
                ctx.arc(cx + 2, cy + 2, sz * 0.3, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            
            case 'forest': {
                // Darker grass base
                const fBright = 18 + noise * 12;
                ctx.fillStyle = `rgb(${fBright}, ${fBright + 22}, ${fBright})`;
                ctx.fillRect(x, y, ts, ts);
                
                // 2-3 small triangle trees
                const numTrees = noise > 0.4 ? 3 : 2;
                for (let t = 0; t < numTrees; t++) {
                    const tx = x + ts * (0.15 + t * 0.32) + (noise - 0.5) * 4;
                    const ty = y + ts * 0.85;
                    const th = ts * 0.55 + noise * ts * 0.25;
                    const tw = ts * 0.22 + noise * ts * 0.08;
                    
                    // Trunk
                    ctx.fillStyle = `rgb(${40 + Math.floor(noise * 15)}, ${28 + Math.floor(noise * 8)}, ${15})`;
                    ctx.fillRect(tx - 1.5, ty - th * 0.35, 3, th * 0.35);
                    
                    // Canopy — layered triangles for depth
                    const tintG = Math.floor(hue.g * 0.1);
                    // Back layer (darker)
                    ctx.fillStyle = `rgb(${15}, ${45 + Math.floor(noise * 25) + tintG}, ${15})`;
                    ctx.beginPath();
                    ctx.moveTo(tx, ty - th - 2);
                    ctx.lineTo(tx - tw - 2, ty - th * 0.25);
                    ctx.lineTo(tx + tw + 2, ty - th * 0.25);
                    ctx.closePath();
                    ctx.fill();
                    
                    // Front layer (brighter)
                    ctx.fillStyle = `rgb(${20}, ${60 + Math.floor(noise * 30) + tintG}, ${20})`;
                    ctx.beginPath();
                    ctx.moveTo(tx, ty - th);
                    ctx.lineTo(tx - tw, ty - th * 0.3);
                    ctx.lineTo(tx + tw, ty - th * 0.3);
                    ctx.closePath();
                    ctx.fill();
                    
                    // Glow
                    ctx.shadowColor = `rgba(${Math.floor(hue.r * 0.3)}, ${Math.floor(hue.g * 0.4)}, ${Math.floor(hue.b * 0.3)}, 0.4)`;
                    ctx.shadowBlur = 4;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
                break;
            }
            
            case 'structure': {
                // Grass base
                const sBright = 25 + noise * 12;
                ctx.fillStyle = `rgb(${sBright}, ${sBright + 25}, ${sBright})`;
                ctx.fillRect(x, y, ts, ts);
                
                // Building — slightly larger, more detail
                const bw = ts * 0.75;
                const bh = ts * 0.65;
                const bx = x + (ts - bw) / 2;
                const by = y + (ts - bh) / 2 + 2;
                
                // Walls
                ctx.fillStyle = `rgb(${50 + Math.floor(noise * 15)}, ${45 + Math.floor(noise * 12)}, ${38 + Math.floor(noise * 10)})`;
                ctx.fillRect(bx, by, bw, bh);
                
                // Roof
                ctx.fillStyle = `rgb(${60 + Math.floor(noise * 10)}, ${35 + Math.floor(noise * 8)}, ${25})`;
                ctx.beginPath();
                ctx.moveTo(bx - 2, by);
                ctx.lineTo(bx + bw / 2, by - 6);
                ctx.lineTo(bx + bw + 2, by);
                ctx.closePath();
                ctx.fill();
                
                // Window glow
                ctx.fillStyle = `rgba(${Math.floor(hue.r * 0.8)}, ${Math.floor(hue.g * 0.7)}, ${Math.floor(hue.b * 0.6)}, 0.7)`;
                ctx.shadowColor = `rgba(${Math.floor(hue.r * 0.5)}, ${Math.floor(hue.g * 0.5)}, ${Math.floor(hue.b * 0.5)}, 0.5)`;
                ctx.shadowBlur = 3;
                ctx.fillRect(bx + bw * 0.25, by + bh * 0.25, 4, 4);
                if (noise > 0.5) {
                    ctx.fillRect(bx + bw * 0.6, by + bh * 0.25, 4, 4);
                }
                ctx.shadowBlur = 0;
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
