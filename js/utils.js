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
    // Grid snapping (20px grid for finer placement)
    GRID: 20,
    snapToGrid(x, y) {
        return {
            x: Math.floor(x / 20) * 20 + 10,
            y: Math.floor(y / 20) * 20 + 10
        };
    },
    gridKey(x, y) {
        return `${Math.floor(x / 20)},${Math.floor(y / 20)}`;
    }
};
