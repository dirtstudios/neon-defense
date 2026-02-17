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
        // Fortification affordability
        const barricadeBtn = document.getElementById('barricade-btn');
        if (barricadeBtn) {
            barricadeBtn.classList.toggle('disabled', gold < Fortification.BARRICADE_COST || Fortification.barricadesRemaining <= 0);
            barricadeBtn.textContent = `🧱 Barricade $${Fortification.BARRICADE_COST} (${Fortification.barricadesRemaining})`;
        }
    },
    
    setFortificationActive(mode) {
        const barricadeBtn = document.getElementById('barricade-btn');
        if (barricadeBtn) barricadeBtn.classList.toggle('active', mode === 'barricade');
    },
    // Bestiary
    bestiaryData: [
        { name: 'Basic', color: '#ff0055', shape: '●', hp: 30, speed: 2, gold: 10, resist: 'None', tip: 'No resistances — any tower works' },
        { name: 'Fast', color: '#ff3388', shape: '◆', hp: 20, speed: 3, gold: 15, resist: 'Weak to Pierce (1.5x)', tip: 'Use Snipers to pick them off' },
        { name: 'Tank', color: '#ff4400', shape: '⬡', hp: 100, speed: 1, gold: 30, resist: 'Kinetic 0.5x, Fire 1.5x', tip: 'AOE fire towers melt these' },
        { name: 'Shield', color: '#4488ff', shape: '🛡', hp: 60, speed: 1.8, gold: 20, resist: 'Fire 0.5x, Pierce 2x', tip: 'Snipers pierce their shields' },
        { name: 'Swarm', color: '#ffaa00', shape: '●', hp: 12, speed: 2.5, gold: 5, resist: 'Pierce 0.3x, Fire 2x', tip: 'AOE fire wipes swarms fast' },
        { name: 'Healer', color: '#44ff88', shape: '✚', hp: 40, speed: 1.5, gold: 25, resist: 'Kinetic 1.5x', tip: 'Kill first! Heals nearby enemies' },
        { name: 'Stealth', color: '#8844aa', shape: '◆', hp: 35, speed: 2.2, gold: 20, resist: 'Fire 0.5x, Kinetic 0.7x', tip: 'Hard to hit — use AOE splash' },
        { name: 'Boss', color: '#ff0055', shape: '⬡', hp: 500, speed: 0.5, gold: 100, resist: 'Kinetic 0.7x, Fire 0.7x', tip: 'Needs everything — focus fire!' }
    ],

    toggleBestiary() {
        const modal = document.getElementById('bestiary-modal');
        if (modal.style.display === 'none') {
            const content = document.getElementById('bestiary-content');
            content.innerHTML = this.bestiaryData.map(e => `
                <div class="bestiary-entry">
                    <div class="bestiary-icon" style="background:${e.color}22;color:${e.color};border:1px solid ${e.color}">${e.shape}</div>
                    <div class="bestiary-info">
                        <div class="bestiary-name" style="color:${e.color}">${e.name}</div>
                        <div class="bestiary-stats">HP ${e.hp} · SPD ${e.speed} · 💰${e.gold} · ${e.resist}</div>
                        <div class="bestiary-tip">💡 ${e.tip}</div>
                    </div>
                </div>
            `).join('');
            modal.style.display = 'flex';
        } else {
            modal.style.display = 'none';
        }
    },

    updateWaveRemaining(enemies) {
        const el = document.getElementById('wave-preview');
        if (!WaveManager.waveActive) return;
        // Count remaining in spawn queue + alive
        const remaining = {};
        for (const type of WaveManager.spawnQueue) {
            remaining[type] = (remaining[type] || 0) + 1;
        }
        for (const e of enemies) {
            if (e.alive) remaining[e.type] = (remaining[e.type] || 0) + 1;
        }
        const parts = Object.entries(remaining).map(([t, c]) => `${c} ${t}`);
        el.textContent = parts.length > 0 ? `Remaining: ${parts.join(' + ')}` : '';
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
