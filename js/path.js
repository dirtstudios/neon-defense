// Path system — supports procedural generation with seeded RNG + water zones
const Path = {
    points: [],
    seed: null,
    waterZones: [], // Array of {x, y, radius} for water areas
    
    _totalLength: null,
    _segmentLengths: null,
    _blocked: null,
    _waterCells: null,

    // Seeded RNG for reproducible maps
    _rngState: 0,
    _seedRng(seed) {
        this._rngState = seed;
    },
    _rng() {
        let t = this._rngState += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    _rngRange(min, max) {
        return min + this._rng() * (max - min);
    },
    _rngInt(min, max) {
        return Math.floor(this._rngRange(min, max + 1));
    },

    templates: {
        scurve: {
            name: 'S-Curve',
            hasWater: false,
            generate(rng) {
                const yTop = 60 + rng(0, 60);
                const yMid = 280 + rng(-40, 40);
                const yBot = 500 + rng(-40, 40);
                const xBend1 = 620 + rng(-60, 60);
                const xBend2 = 140 + rng(-40, 60);
                return { points: [
                    { x: -20, y: yTop },
                    { x: 100 + rng(-20, 20), y: yTop + rng(-10, 10) },
                    { x: 250 + rng(-20, 20), y: yTop + rng(-15, 15) },
                    { x: 400 + rng(-20, 20), y: yTop + rng(-10, 10) },
                    { x: xBend1 - 80, y: yTop + rng(0, 20) },
                    { x: xBend1, y: yTop + 40 + rng(0, 20) },
                    { x: xBend1 + 20, y: yMid - 40 },
                    { x: xBend1, y: yMid },
                    { x: xBend1 - 80, y: yMid + 20 + rng(0, 15) },
                    { x: 450 + rng(-20, 20), y: yMid + 30 + rng(-10, 10) },
                    { x: 300 + rng(-20, 20), y: yMid + 20 + rng(-10, 10) },
                    { x: xBend2 + 40, y: yMid + 30 + rng(0, 20) },
                    { x: xBend2, y: yMid + 80 + rng(0, 20) },
                    { x: xBend2 - 20, y: yBot - 40 },
                    { x: xBend2, y: yBot },
                    { x: xBend2 + 60, y: yBot + rng(-5, 15) },
                    { x: 300 + rng(-20, 20), y: yBot + rng(-10, 10) },
                    { x: 500 + rng(-20, 20), y: yBot + rng(-10, 10) },
                    { x: 680 + rng(-20, 20), y: yBot + rng(-10, 10) },
                    { x: 820, y: yBot + rng(-10, 10) }
                ], water: [] };
            }
        },
        zigzag: {
            name: 'Zigzag',
            hasWater: false,
            generate(rng) {
                const rows = 4 + Math.floor(rng(0, 1) * 2);
                const pts = [];
                const margin = 60;
                const yStep = (600 - margin * 2) / (rows - 1);
                
                pts.push({ x: -20, y: margin + rng(-10, 10) });
                
                for (let i = 0; i < rows; i++) {
                    const y = margin + i * yStep + rng(-15, 15);
                    const goRight = (i % 2 === 0);
                    
                    if (goRight) {
                        pts.push({ x: 100 + rng(-20, 20), y });
                        pts.push({ x: 350 + rng(-30, 30), y: y + rng(-10, 10) });
                        pts.push({ x: 600 + rng(-20, 20), y: y + rng(-10, 10) });
                        pts.push({ x: 720 + rng(-20, 20), y });
                    } else {
                        pts.push({ x: 700 + rng(-20, 20), y });
                        pts.push({ x: 450 + rng(-30, 30), y: y + rng(-10, 10) });
                        pts.push({ x: 200 + rng(-20, 20), y: y + rng(-10, 10) });
                        pts.push({ x: 80 + rng(-20, 20), y });
                    }
                    
                    if (i < rows - 1) {
                        const nextY = margin + (i + 1) * yStep + rng(-15, 15);
                        const xEdge = (i % 2 === 0) ? 720 + rng(-15, 15) : 80 + rng(-15, 15);
                        pts.push({ x: xEdge, y: y + (nextY - y) * 0.5 });
                    }
                }
                
                const lastPt = pts[pts.length - 1];
                if (lastPt.x < 400) {
                    pts.push({ x: -20, y: lastPt.y + rng(-10, 10) });
                } else {
                    pts.push({ x: 820, y: lastPt.y + rng(-10, 10) });
                }
                
                return { points: pts, water: [] };
            }
        },
        spiral: {
            name: 'Spiral',
            hasWater: false,
            generate(rng) {
                const cx = 400 + rng(-40, 40);
                const cy = 300 + rng(-30, 30);
                const pts = [];
                
                pts.push({ x: -20, y: 80 + rng(-20, 20) });
                pts.push({ x: 80 + rng(-10, 10), y: 80 + rng(-10, 10) });
                pts.push({ x: 700 + rng(-20, 20), y: 80 + rng(-15, 15) });
                pts.push({ x: 730 + rng(-15, 15), y: 300 + rng(-20, 20) });
                pts.push({ x: 700 + rng(-20, 20), y: 520 + rng(-15, 15) });
                pts.push({ x: 400 + rng(-20, 20), y: 540 + rng(-15, 15) });
                pts.push({ x: 100 + rng(-15, 15), y: 520 + rng(-15, 15) });
                pts.push({ x: 70 + rng(-10, 10), y: 350 + rng(-20, 20) });
                pts.push({ x: 150 + rng(-15, 15), y: 200 + rng(-15, 15) });
                pts.push({ x: 400 + rng(-20, 20), y: 180 + rng(-15, 15) });
                pts.push({ x: 600 + rng(-15, 15), y: 250 + rng(-15, 15) });
                pts.push({ x: 580 + rng(-15, 15), y: 420 + rng(-15, 15) });
                pts.push({ x: 400 + rng(-20, 20), y: 440 + rng(-15, 15) });
                pts.push({ x: 250 + rng(-15, 15), y: 380 + rng(-15, 15) });
                pts.push({ x: cx + rng(-15, 15), y: cy + rng(-15, 15) });
                
                return { points: pts, water: [] };
            }
        },
        loop: {
            name: 'Loop',
            hasWater: false,
            generate(rng) {
                const pts = [];
                pts.push({ x: -20, y: 150 + rng(-20, 20) });
                pts.push({ x: 80 + rng(-15, 15), y: 150 + rng(-15, 15) });
                pts.push({ x: 300 + rng(-20, 20), y: 100 + rng(-15, 15) });
                pts.push({ x: 550 + rng(-20, 20), y: 80 + rng(-15, 15) });
                pts.push({ x: 700 + rng(-15, 15), y: 150 + rng(-15, 15) });
                pts.push({ x: 720 + rng(-10, 10), y: 280 + rng(-15, 15) });
                pts.push({ x: 600 + rng(-15, 15), y: 320 + rng(-10, 10) });
                pts.push({ x: 400 + rng(-20, 20), y: 300 + rng(-15, 15) });
                pts.push({ x: 200 + rng(-15, 15), y: 320 + rng(-15, 15) });
                pts.push({ x: 80 + rng(-10, 10), y: 400 + rng(-15, 15) });
                pts.push({ x: 100 + rng(-15, 15), y: 520 + rng(-15, 15) });
                pts.push({ x: 280 + rng(-20, 20), y: 550 + rng(-15, 15) });
                pts.push({ x: 480 + rng(-20, 20), y: 520 + rng(-15, 15) });
                pts.push({ x: 600 + rng(-15, 15), y: 460 + rng(-15, 15) });
                pts.push({ x: 700 + rng(-15, 15), y: 500 + rng(-15, 15) });
                pts.push({ x: 820, y: 500 + rng(-15, 15) });
                return { points: pts, water: [] };
            }
        },
        diamond: {
            name: 'Diamond',
            hasWater: false,
            generate(rng) {
                const pts = [];
                const cx = 400 + rng(-30, 30);
                const cy = 300 + rng(-20, 20);
                
                pts.push({ x: -20, y: cy + rng(-10, 10) });
                pts.push({ x: 60 + rng(-10, 10), y: cy + rng(-5, 5) });
                pts.push({ x: 160 + rng(-15, 15), y: cy - 20 + rng(-10, 10) });
                pts.push({ x: cx - 20 + rng(-10, 10), y: 80 + rng(-15, 15) });
                pts.push({ x: cx + 100 + rng(-10, 10), y: 80 + rng(-10, 10) });
                pts.push({ x: 720 + rng(-15, 15), y: cy - 40 + rng(-10, 10) });
                pts.push({ x: 740 + rng(-10, 10), y: cy + rng(-10, 10) });
                pts.push({ x: 720 + rng(-15, 15), y: cy + 40 + rng(-10, 10) });
                pts.push({ x: cx + 80 + rng(-15, 15), y: 520 + rng(-15, 15) });
                pts.push({ x: cx - 40 + rng(-15, 15), y: 540 + rng(-15, 15) });
                pts.push({ x: 140 + rng(-15, 15), y: cy + 60 + rng(-10, 10) });
                pts.push({ x: 100 + rng(-10, 10), y: cy + 100 + rng(-10, 10) });
                pts.push({ x: 60 + rng(-10, 10), y: 560 + rng(-10, 10) });
                pts.push({ x: -20, y: 570 + rng(-10, 10) });
                return { points: pts, water: [] };
            }
        },
        riverside: {
            name: 'Riverside',
            hasWater: true,
            generate(rng) {
                // Path runs alongside a river — water on one side
                const riverY = 300 + rng(-30, 30);
                const pts = [];
                
                pts.push({ x: -20, y: 80 + rng(-15, 15) });
                pts.push({ x: 100 + rng(-15, 15), y: 80 + rng(-10, 10) });
                pts.push({ x: 250 + rng(-15, 15), y: 120 + rng(-10, 10) });
                pts.push({ x: 400 + rng(-15, 15), y: 100 + rng(-10, 10) });
                pts.push({ x: 600 + rng(-15, 15), y: 130 + rng(-10, 10) });
                pts.push({ x: 720 + rng(-10, 10), y: 160 + rng(-10, 10) });
                pts.push({ x: 740 + rng(-10, 10), y: riverY - 40 + rng(-10, 10) });
                // Path crosses river
                pts.push({ x: 700 + rng(-15, 15), y: riverY + 30 + rng(-10, 10) });
                pts.push({ x: 580 + rng(-15, 15), y: riverY + 60 + rng(-10, 10) });
                pts.push({ x: 400 + rng(-15, 15), y: riverY + 80 + rng(-10, 10) });
                pts.push({ x: 200 + rng(-15, 15), y: riverY + 60 + rng(-10, 10) });
                pts.push({ x: 100 + rng(-10, 10), y: riverY + 100 + rng(-10, 10) });
                pts.push({ x: 80 + rng(-10, 10), y: 500 + rng(-15, 15) });
                pts.push({ x: 200 + rng(-15, 15), y: 540 + rng(-10, 10) });
                pts.push({ x: 450 + rng(-20, 20), y: 550 + rng(-10, 10) });
                pts.push({ x: 700 + rng(-15, 15), y: 530 + rng(-10, 10) });
                pts.push({ x: 820, y: 540 + rng(-10, 10) });
                
                // River as a horizontal water band
                const water = [
                    { x: 200 + rng(-20, 20), y: riverY, radius: 90 + rng(-10, 15) },
                    { x: 400 + rng(-20, 20), y: riverY + rng(-10, 10), radius: 100 + rng(-10, 15) },
                    { x: 600 + rng(-20, 20), y: riverY + rng(-10, 10), radius: 85 + rng(-10, 15) },
                ];
                
                return { points: pts, water };
            }
        },
        islands: {
            name: 'Islands',
            hasWater: true,
            generate(rng) {
                // Water-heavy map with land islands
                const pts = [];
                
                pts.push({ x: -20, y: 300 + rng(-20, 20) });
                pts.push({ x: 60 + rng(-10, 10), y: 280 + rng(-15, 15) });
                pts.push({ x: 150 + rng(-10, 10), y: 200 + rng(-15, 15) });
                pts.push({ x: 250 + rng(-10, 10), y: 140 + rng(-15, 15) });
                pts.push({ x: 380 + rng(-15, 15), y: 120 + rng(-10, 10) });
                pts.push({ x: 500 + rng(-15, 15), y: 180 + rng(-15, 15) });
                pts.push({ x: 550 + rng(-10, 10), y: 300 + rng(-15, 15) });
                pts.push({ x: 450 + rng(-15, 15), y: 380 + rng(-15, 15) });
                pts.push({ x: 300 + rng(-15, 15), y: 420 + rng(-15, 15) });
                pts.push({ x: 200 + rng(-10, 10), y: 480 + rng(-15, 15) });
                pts.push({ x: 350 + rng(-15, 15), y: 530 + rng(-10, 10) });
                pts.push({ x: 550 + rng(-15, 15), y: 500 + rng(-15, 15) });
                pts.push({ x: 680 + rng(-15, 15), y: 420 + rng(-15, 15) });
                pts.push({ x: 740 + rng(-10, 10), y: 300 + rng(-15, 15) });
                pts.push({ x: 820, y: 280 + rng(-15, 15) });
                
                // Multiple water zones scattered around
                const water = [
                    { x: 100 + rng(-15, 15), y: 100 + rng(-15, 15), radius: 70 + rng(-10, 10) },
                    { x: 650 + rng(-15, 15), y: 130 + rng(-15, 15), radius: 80 + rng(-10, 10) },
                    { x: 400 + rng(-15, 15), y: 280 + rng(-15, 15), radius: 60 + rng(-10, 10) },
                    { x: 130 + rng(-15, 15), y: 450 + rng(-15, 15), radius: 65 + rng(-10, 10) },
                    { x: 680 + rng(-15, 15), y: 540 + rng(-10, 10), radius: 70 + rng(-10, 10) },
                ];
                
                return { points: pts, water };
            }
        },
        lake: {
            name: 'Lakeside',
            hasWater: true,
            generate(rng) {
                // Big central lake, path wraps around it
                const lx = 400 + rng(-30, 30);
                const ly = 300 + rng(-20, 20);
                const pts = [];
                
                pts.push({ x: -20, y: 100 + rng(-15, 15) });
                pts.push({ x: 80 + rng(-10, 10), y: 80 + rng(-10, 10) });
                pts.push({ x: 200 + rng(-15, 15), y: 70 + rng(-10, 10) });
                pts.push({ x: 400 + rng(-15, 15), y: 60 + rng(-10, 10) });
                pts.push({ x: 600 + rng(-15, 15), y: 80 + rng(-10, 10) });
                pts.push({ x: 730 + rng(-10, 10), y: 140 + rng(-10, 10) });
                pts.push({ x: 750 + rng(-10, 10), y: 300 + rng(-15, 15) });
                pts.push({ x: 730 + rng(-10, 10), y: 460 + rng(-10, 10) });
                pts.push({ x: 600 + rng(-15, 15), y: 540 + rng(-10, 10) });
                pts.push({ x: 400 + rng(-15, 15), y: 560 + rng(-10, 10) });
                pts.push({ x: 200 + rng(-15, 15), y: 540 + rng(-10, 10) });
                pts.push({ x: 80 + rng(-10, 10), y: 460 + rng(-10, 10) });
                pts.push({ x: 60 + rng(-10, 10), y: 350 + rng(-15, 15) });
                pts.push({ x: -20, y: 300 + rng(-15, 15) });
                
                const water = [
                    { x: lx, y: ly, radius: 120 + rng(-15, 20) },
                    { x: lx - 60 + rng(-10, 10), y: ly + 30 + rng(-10, 10), radius: 60 + rng(-10, 10) },
                    { x: lx + 50 + rng(-10, 10), y: ly - 20 + rng(-10, 10), radius: 55 + rng(-10, 10) },
                ];
                
                return { points: pts, water };
            }
        },
        canyon: {
            name: 'Canyon',
            hasWater: false,
            generate(rng) {
                // Tight winding path through a narrow canyon
                const pts = [];
                pts.push({ x: 400 + rng(-20, 20), y: -20 });
                pts.push({ x: 400 + rng(-15, 15), y: 60 + rng(-10, 10) });
                pts.push({ x: 350 + rng(-20, 20), y: 120 + rng(-10, 10) });
                pts.push({ x: 450 + rng(-20, 20), y: 180 + rng(-10, 10) });
                pts.push({ x: 330 + rng(-20, 20), y: 240 + rng(-10, 10) });
                pts.push({ x: 470 + rng(-20, 20), y: 300 + rng(-10, 10) });
                pts.push({ x: 320 + rng(-20, 20), y: 360 + rng(-10, 10) });
                pts.push({ x: 480 + rng(-20, 20), y: 420 + rng(-10, 10) });
                pts.push({ x: 350 + rng(-20, 20), y: 480 + rng(-10, 10) });
                pts.push({ x: 430 + rng(-20, 20), y: 540 + rng(-10, 10) });
                pts.push({ x: 400 + rng(-15, 15), y: 620 });
                return { points: pts, water: [] };
            }
        },
        switchback: {
            name: 'Switchback',
            hasWater: false,
            generate(rng) {
                // Mountain switchback — tight hairpin turns
                const pts = [];
                const margin = 80;
                
                pts.push({ x: -20, y: 80 + rng(-10, 10) });
                pts.push({ x: 650 + rng(-20, 20), y: 80 + rng(-10, 10) });
                pts.push({ x: 720 + rng(-10, 10), y: 120 + rng(-10, 10) });
                pts.push({ x: 720 + rng(-10, 10), y: 180 + rng(-10, 10) });
                pts.push({ x: 650 + rng(-20, 20), y: 210 + rng(-10, 10) });
                pts.push({ x: 150 + rng(-20, 20), y: 210 + rng(-10, 10) });
                pts.push({ x: 80 + rng(-10, 10), y: 250 + rng(-10, 10) });
                pts.push({ x: 80 + rng(-10, 10), y: 310 + rng(-10, 10) });
                pts.push({ x: 150 + rng(-20, 20), y: 340 + rng(-10, 10) });
                pts.push({ x: 650 + rng(-20, 20), y: 340 + rng(-10, 10) });
                pts.push({ x: 720 + rng(-10, 10), y: 380 + rng(-10, 10) });
                pts.push({ x: 720 + rng(-10, 10), y: 440 + rng(-10, 10) });
                pts.push({ x: 650 + rng(-20, 20), y: 470 + rng(-10, 10) });
                pts.push({ x: 150 + rng(-20, 20), y: 470 + rng(-10, 10) });
                pts.push({ x: 80 + rng(-10, 10), y: 510 + rng(-10, 10) });
                pts.push({ x: 80 + rng(-10, 10), y: 560 + rng(-10, 10) });
                pts.push({ x: 150 + rng(-15, 15), y: 570 + rng(-5, 5) });
                pts.push({ x: 820, y: 570 + rng(-10, 10) });
                
                return { points: pts, water: [] };
            }
        },
        harbor: {
            name: 'Harbor',
            hasWater: true,
            generate(rng) {
                // Bottom half is water (harbor), path runs along top then dips down
                const pts = [];
                const waterLine = 380 + rng(-20, 20);
                
                pts.push({ x: -20, y: 100 + rng(-15, 15) });
                pts.push({ x: 100 + rng(-10, 10), y: 80 + rng(-10, 10) });
                pts.push({ x: 300 + rng(-15, 15), y: 100 + rng(-10, 10) });
                pts.push({ x: 500 + rng(-15, 15), y: 70 + rng(-10, 10) });
                pts.push({ x: 700 + rng(-10, 10), y: 100 + rng(-10, 10) });
                pts.push({ x: 740 + rng(-10, 10), y: 200 + rng(-10, 10) });
                pts.push({ x: 700 + rng(-10, 10), y: 300 + rng(-10, 10) });
                // Dip into harbor area
                pts.push({ x: 580 + rng(-15, 15), y: waterLine + 40 + rng(-10, 10) });
                pts.push({ x: 400 + rng(-15, 15), y: waterLine + 80 + rng(-10, 10) });
                pts.push({ x: 220 + rng(-15, 15), y: waterLine + 40 + rng(-10, 10) });
                pts.push({ x: 100 + rng(-10, 10), y: 300 + rng(-10, 10) });
                pts.push({ x: 60 + rng(-10, 10), y: waterLine + 100 + rng(-10, 10) });
                pts.push({ x: 150 + rng(-15, 15), y: 550 + rng(-10, 10) });
                pts.push({ x: 400 + rng(-20, 20), y: 570 + rng(-5, 5) });
                pts.push({ x: 820, y: 560 + rng(-10, 10) });
                
                // Large harbor water zone at bottom
                const water = [
                    { x: 200 + rng(-15, 15), y: waterLine + 100, radius: 100 + rng(-10, 15) },
                    { x: 400 + rng(-15, 15), y: waterLine + 120 + rng(-10, 10), radius: 110 + rng(-10, 15) },
                    { x: 600 + rng(-15, 15), y: waterLine + 90 + rng(-10, 10), radius: 95 + rng(-10, 15) },
                    { x: 300 + rng(-10, 10), y: waterLine + 160 + rng(-5, 5), radius: 70 + rng(-5, 10) },
                    { x: 550 + rng(-10, 10), y: waterLine + 155 + rng(-5, 5), radius: 65 + rng(-5, 10) },
                ];
                
                return { points: pts, water };
            }
        }
    },

    generate(seed) {
        if (seed === undefined || seed === null) {
            seed = Math.floor(Math.random() * 2147483647);
        }
        this.seed = seed;
        this._seedRng(seed);
        
        const templateNames = Object.keys(this.templates);
        const templateIdx = this._rngInt(0, templateNames.length - 1);
        const templateName = templateNames[templateIdx];
        const template = this.templates[templateName];
        
        const rng = (min, max) => this._rngRange(min, max);
        const result = template.generate(rng);
        this.points = result.points;
        this.waterZones = result.water || [];
        
        // Clamp interior points
        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i];
            if (i > 0 && i < this.points.length - 1) {
                p.x = Math.max(40, Math.min(760, p.x));
                p.y = Math.max(40, Math.min(570, p.y));
            }
        }
        
        this.points = this._subdivide(this.points);
        
        this._totalLength = null;
        this._segmentLengths = null;
        this._blocked = null;
        this._waterCells = null;
        
        this._calculatePathLength();
        
        return { seed: this.seed, template: templateName, name: template.name, hasWater: this.waterZones.length > 0 };
    },
    
    _subdivide(pts) {
        if (pts.length < 3) return pts;
        
        const result = [pts[0]];
        
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i];
            const p1 = pts[i + 1];
            
            if (i > 0) {
                result.push({
                    x: p0.x * 0.75 + p1.x * 0.25,
                    y: p0.y * 0.75 + p1.y * 0.25
                });
            }
            result.push({
                x: p0.x * 0.25 + p1.x * 0.75,
                y: p0.y * 0.25 + p1.y * 0.75
            });
        }
        
        result.push(pts[pts.length - 1]);
        return result;
    },

    init() {
        if (this.points.length === 0) {
            this.generate();
        }
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
    },
    
    // Check if a grid cell is in water
    isWater(x, y) {
        for (const zone of this.waterZones) {
            if (Utils.dist(x, y, zone.x, zone.y) <= zone.radius) {
                return true;
            }
        }
        return false;
    },
    
    // Check if a grid cell center is in water
    isWaterCell(gx, gy) {
        const cx = gx * Utils.GRID + Utils.GRID / 2;
        const cy = gy * Utils.GRID + Utils.GRID / 2;
        return this.isWater(cx, cy);
    },

    // Catmull-Rom spline interpolation for smooth curves
    _catmullRom(p0, p1, p2, p3, t) {
        const t2 = t * t, t3 = t2 * t;
        return {
            x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
            y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        };
    },

    // Generate smooth spline points from control points
    _getSplinePoints(stepsPerSegment) {
        const pts = this.points;
        if (pts.length < 2) return pts;
        const spline = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(0, i - 1)];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[Math.min(pts.length - 1, i + 2)];
            for (let s = 0; s < stepsPerSegment; s++) {
                spline.push(this._catmullRom(p0, p1, p2, p3, s / stepsPerSegment));
            }
        }
        spline.push(pts[pts.length - 1]);
        return spline;
    },

    // Flow animation timer
    _flowOffset: 0,

    draw(ctx, theme) {
        const pathColor = theme ? theme.path : 'rgba(0, 243, 255,';
        
        // Draw water zones first (below path)
        for (const zone of this.waterZones) {
            const grad = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, zone.radius);
            grad.addColorStop(0, 'rgba(0, 80, 180, 0.15)');
            grad.addColorStop(0.6, 'rgba(0, 60, 150, 0.10)');
            grad.addColorStop(1, 'rgba(0, 40, 120, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
            ctx.fill();
            
            const innerGrad = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, zone.radius * 0.8);
            innerGrad.addColorStop(0, 'rgba(0, 100, 200, 0.12)');
            innerGrad.addColorStop(1, 'rgba(0, 60, 150, 0.06)');
            ctx.fillStyle = innerGrad;
            ctx.beginPath();
            ctx.arc(zone.x, zone.y, zone.radius * 0.8, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(0, 120, 220, 0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(zone.x, zone.y, zone.radius * 0.8, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Generate smooth spline
        const spline = this._getSplinePoints(6);
        
        // Outer glow (wide, faint)
        ctx.beginPath();
        ctx.moveTo(spline[0].x, spline[0].y);
        for (let i = 1; i < spline.length; i++) ctx.lineTo(spline[i].x, spline[i].y);
        ctx.strokeStyle = pathColor + '0.04)';
        ctx.lineWidth = Utils.GRID * 1.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        
        // Main path body
        ctx.beginPath();
        ctx.moveTo(spline[0].x, spline[0].y);
        for (let i = 1; i < spline.length; i++) ctx.lineTo(spline[i].x, spline[i].y);
        ctx.strokeStyle = pathColor + '0.08)';
        ctx.lineWidth = Utils.GRID * 0.8;
        ctx.stroke();

        // Edge glow lines
        ctx.beginPath();
        ctx.moveTo(spline[0].x, spline[0].y);
        for (let i = 1; i < spline.length; i++) ctx.lineTo(spline[i].x, spline[i].y);
        ctx.strokeStyle = pathColor + '0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Directional flow arrows (animated dashes)
        this._flowOffset = (this._flowOffset + 0.3) % 30;
        ctx.save();
        ctx.setLineDash([4, 26]);
        ctx.lineDashOffset = -this._flowOffset;
        ctx.beginPath();
        ctx.moveTo(spline[0].x, spline[0].y);
        for (let i = 1; i < spline.length; i++) ctx.lineTo(spline[i].x, spline[i].y);
        ctx.strokeStyle = pathColor + '0.35)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'butt';
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        
        // Entry/exit markers
        const entry = this.points[0];
        const exit = this.points[this.points.length - 1];
        
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
    }
};
