// Sprite loader — loads Kenney tilesheet and provides tile drawing
const Sprites = {
    sheet: null,
    loaded: false,
    TILE_W: 64,
    TILE_H: 64,
    COLS: 23,
    
    // Tile index mapping (1-based tile numbers)
    // Verified against Kenney TD tilesheet (1472x832, 23x13 grid)
    TILES: {
        // Pure terrain fills
        GRASS: 24,           // Solid green grass (row 1, col 1)
        DIRT: 1,             // Solid brown dirt (row 0, col 1) — used for paths
        
        // Grass-dirt transitions (biome 1, rows 0-1)
        // These auto-tile edges make path borders look natural
        GRASS_DIRT_TL: 3,
        GRASS_DIRT_T: 2,
        GRASS_DIRT_TR: 1,
        GRASS_DIRT_L: 26,
        GRASS_DIRT_R: 24,
        GRASS_DIRT_BL: 49,
        GRASS_DIRT_B: 48,
        GRASS_DIRT_BR: 47,
        
        // Nature objects (row 5, tiles ~128-136)
        BUSH1: 128,          // Small bush
        BUSH2: 130,          // Medium bush
        BUSH3: 131,          // Large round bush
        TREE1: 132,          // Large round tree canopy
        TREE2: 133,          // Star/spiky tree
        ROCK_SM: 134,        // Small grey rock
        ROCK_MD: 135,        // Medium grey rock
        ROCK_LG: 136,        // Large grey rock
        
        // Tower bases (row 7, tiles 180-184)
        TOWER_BASE_1: 180,   // Stone pedestal front
        TOWER_BASE_2: 181,   // Stone pedestal variant
        TOWER_BASE_3: 182,   // Stone pedestal angled
        
        // Turrets (row 8, tiles 201-204)
        TURRET_EMPTY: 201,   // Base only, no weapon
        TURRET_BASIC: 202,   // Small cannon
        TURRET_MISSILE: 203, // Dual red rockets
        TURRET_HEAVY: 204,   // Large dual rockets
    },
    
    load(callback) {
        this.sheet = new Image();
        this.sheet.onload = () => {
            this.loaded = true;
            console.log('Tilesheet loaded successfully');
            if (callback) callback();
        };
        this.sheet.onerror = () => {
            console.warn('Tilesheet failed to load, using fallback rendering');
            this.loaded = false;
            if (callback) callback();
        };
        this.sheet.src = 'assets/tilesheet.png';
    },
    
    // Get source x,y for a tile number (1-based)
    _getTilePos(tileNum) {
        const idx = tileNum - 1;
        const col = idx % this.COLS;
        const row = Math.floor(idx / this.COLS);
        return { 
            sx: col * this.TILE_W, 
            sy: row * this.TILE_H 
        };
    },
    
    // Draw a tile from the sheet, scaled to destination size
    drawTile(ctx, tileNum, dx, dy, dw, dh) {
        if (!this.loaded || !this.sheet) return false;
        const { sx, sy } = this._getTilePos(tileNum);
        ctx.drawImage(this.sheet, sx, sy, this.TILE_W, this.TILE_H, dx, dy, dw || this.TILE_W, dh || this.TILE_H);
        return true;
    },
    
    // Draw a tile centered at a position
    drawTileCentered(ctx, tileNum, cx, cy, size) {
        if (!this.loaded) return false;
        const half = size / 2;
        return this.drawTile(ctx, tileNum, cx - half, cy - half, size, size);
    }
};
