// Math helpers — no allocations in hot path
const Utils = {
    dist(x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },
    angle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    },
    lerp(a, b, t) {
        return a + (b - a) * t;
    },
    clamp(v, min, max) {
        return v < min ? min : v > max ? max : v;
    },
    rand(min, max) {
        return Math.random() * (max - min) + min;
    },
    randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    // Grid snapping (10px grid for finer placement - 2x previous)
    GRID: 10,
    snapToGrid(x, y) {
        const g = Utils.GRID;
        return {
            x: Math.floor(x / g) * g + g / 2,
            y: Math.floor(y / g) * g + g / 2
        };
    },
    gridKey(x, y) {
        const g = Utils.GRID;
        return `${Math.floor(x / g)},${Math.floor(y / g)}`;
    }
};
