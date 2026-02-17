// Sprite loader — loads Kenney tilesheet and provides tile drawing
const Sprites = {
    sheet: null,
    loaded: false,
    TILE_W: 64,
    TILE_H: 64,
    COLS: 23,
    
    // Tile index mapping (1-based tile numbers → 0-based index)
    // Kenney TD pack tile numbers
    TILES: {
        // Terrain (these are the grass-on-dirt transitions, row 1-4)
        GRASS: 24,           // Pure grass (tile024)
        GRASS_VAR1: 1,       // Grass with dirt edge
        GRASS_VAR2: 27,      // Another grass variant
        DIRT: 50,            // Pure dirt/path
        DIRT_VAR1: 53,       // Dirt variant
        SAND: 77,            // Sand tile
        SAND_VAR1: 80,       // Sand variant
        
        // Nature objects (row ~6, tiles 131+)
        BUSH1: 131,          // Small round bush
        BUSH2: 132,          // Leaf cluster
        TREE1: 133,          // Round tree canopy
        TREE2: 134,          // Star-shaped tree
        ROCK_SM: 135,        // Small rock
        ROCK_MD: 136,        // Medium rock
        ROCK_LG: 137,        // Large rock
        
        // Grass-dirt transitions (for path edges)
        // Row 1: tiles 1-23
        GRASS_DIRT_TL: 3,    // Top-left corner
        GRASS_DIRT_T: 2,     // Top edge
        GRASS_DIRT_TR: 1,    // Top-right corner
        GRASS_DIRT_L: 26,    // Left edge
        GRASS_DIRT_R: 24,    // Right edge  
        GRASS_DIRT_BL: 49,   // Bottom-left corner
        GRASS_DIRT_B: 48,    // Bottom edge
        GRASS_DIRT_BR: 47,   // Bottom-right corner
        
        // Tower bases (row ~8-9)
        TOWER_BASE_GREEN: 180,
        TOWER_BASE_BROWN: 181,
        TOWER_BASE_GREY: 182,
        
        // Tower turrets
        TURRET_1: 199,       // Basic turret
        TURRET_2: 200,       // Armed turret
        TURRET_3: 201,       // Missile turret
        TURRET_4: 202,       // Heavy turret
        
        // Enemies
        ENEMY_GREEN: 249,    // Green screw enemy
        ENEMY_RED: 250,      // Red screw enemy
        PLANE_GREEN: 270,    // Green plane
        PLANE_GREY: 271,     // Grey plane
        
        // Coins
        COIN_GOLD: 272,
        COIN_SILVER: 273,
        
        // Structures
        STRUCT_1: 138,       // Path corner (sand-grass)
        STRUCT_2: 139,       // Path edge
        STRUCT_3: 140,       // Path corner
    },
    
    load(callback) {
        this.sheet = new Image();
        this.sheet.onload = () => {
            this.loaded = true;
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
        const idx = tileNum - 1; // Convert to 0-based
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
