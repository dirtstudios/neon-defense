// UI update helpers
const UI = {
    updateGold(gold) {
        document.getElementById('gold').textContent = `💰 ${gold}`;
    },
    updateWave(current, total, endless) {
        const lvl = game.level || 1;
        const prefix = lvl > 1 ? `Lv${lvl} ` : '';
        const text = endless ? `${prefix}Wave ${current + 1} (Endless)` : `${prefix}Wave ${current + 1}/${total}`;
        document.getElementById('wave-info').textContent = text;
    },
    updateLives(lives) {
        document.getElementById('lives').textContent = `❤️ ${lives}`;
    },
    updateScore(score) {
        document.getElementById('score').textContent = `Score: ${score}`;
    },
    updateWavePreview(text) {
        document.getElementById('wave-preview').textContent = text ? `Next: ${text}` : '';
    },
    setStartWaveEnabled(enabled) {
        const btn = document.getElementById('start-wave-btn');
        btn.classList.toggle('disabled', !enabled);
    },
    setTowerActive(type) {
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
        if (type) {
            const btn = document.querySelector(`[data-tower="${type}"]`);
            if (btn) btn.classList.add('active');
        }
    },
    updateTowerAffordability(gold) {
        document.querySelectorAll('.tower-btn[data-tower]').forEach(btn => {
            const type = btn.dataset.tower;
            if (type === 'sell') return;
            const def = TowerTypes[type] || (typeof TrapTypes !== 'undefined' && TrapTypes[type]);
            if (def) btn.classList.toggle('disabled', gold < def.cost);
        });
    },
    showMenu() {
        document.getElementById('menu-screen').style.display = 'flex';
        document.getElementById('game-over-screen').style.display = 'none';
    },
    hideMenu() {
        document.getElementById('menu-screen').style.display = 'none';
    },
    showGameOver(won, score, wave) {
        const screen = document.getElementById('game-over-screen');
        screen.style.display = 'flex';
        document.getElementById('end-title').textContent = won ? 'VICTORY' : 'GAME OVER';
        document.getElementById('end-title').style.color = won ? '#00ff66' : '#ff0055';
        document.getElementById('end-title').style.textShadow = won ?
            '0 0 30px rgba(0,255,100,0.5)' : '0 0 30px rgba(255,0,85,0.5)';
        document.getElementById('end-message').textContent = won ?
            'All waves defeated!' : `Defeated on wave ${wave + 1}`;
        document.getElementById('end-score').textContent = `Score: ${score}`;
        if (game.mapInfo) {
            document.getElementById('end-map-info').textContent = `${game.mapInfo.name} • Seed: ${game.mapInfo.seed}`;
        }
    }
};
