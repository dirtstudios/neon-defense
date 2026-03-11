// Fortification system removed.
// Keeping a no-op stub so older code paths don't explode while the game evolves.
const Fortification = {
    placementMode: null,
    unlocked: false,
    init() {},
    reset() { this.placementMode = null; },
    onLevelStart() {},
    onWaveStart() {},
    update() {},
    draw() {},
    drawPreview() {}
};
