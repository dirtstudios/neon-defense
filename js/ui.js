// UI update helpers
const UI = {
    updateGold(gold, flash = false) {
        const el = document.getElementById('gold');
        el.textContent = `💰 ${gold}`;
        if (flash) {
            el.style.textShadow = '0 0 12px #ffdd44, 0 0 24px #ffaa00';
            el.style.transform = 'scale(1.15)';
            setTimeout(() => {
                el.style.textShadow = '';
                el.style.transform = 'scale(1)';
            }, 250);
        }
    },
    updateWave(current, total, endless) {
        const lvl = game.level || 1;
        const prefix = lvl > 1 ? `Lv${lvl} ` : '';
        const text = endless ? `${prefix}Wave ${current + 1} (Endless)` : `${prefix}Wave ${current + 1}/${total}`;
        // Add star display
        const stars = game.stars || {};
        const currentStars = stars[lvl - 1] || 0;
        const starDisplay = currentStars > 0 ? ' ⭐'.repeat(currentStars) : '';
        document.getElementById('wave-info').textContent = text + starDisplay;
    },
    updateLives(lives) {
        document.getElementById('lives').textContent = `❤️ ${lives}`;
    },
    updateScore(score) {
        document.getElementById('score').textContent = `Score: ${score}`;
    },
    updateWavePreview(text) {
        let displayText = text ? `Next: ${text}` : '';
        // Add boss warning
        if (WaveManager.hasBoss()) {
            const bossCount = WaveManager.getBossCount();
            displayText = `⚠️ BOSS INCOMING (${bossCount}) ⚠️\n` + displayText;
        }
        document.getElementById('wave-preview').textContent = displayText;
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
    
    updateActivePerks(perkState, perkHistory) {
        const container = document.getElementById('active-perks');
        if (!container) return;
        
        const activePerks = [];
        // Map perk IDs to their colors
        const perkColors = {
            'kinetic_boost': '#00f3ff',
            'sniper_focus': '#aa88ff',
            'reactor_core': '#ff9a3d',
            'sentinel_drill': '#44ffbb',
            'reinforced_armor': '#7dd3fc',
            'trap_engineering': '#ffd166',
            'war_chest': '#facc15',
            'blood_sport': '#fb7185',
            'field_repairs': '#4ade80',
            'scavenger': '#f59e0b',
            'quick_reflexes': '#60a5fa',
            'glass_cannon': '#ff6677',
            'last_stand': '#22d3d3',
            'golden_touch': '#ffd700',
            'chain_lightning': '#a855f7',
            'critical_strike': '#f43f5e'
        };
        
        // Check which perks are active based on perkState
        if (perkState.goldBonusChance > 0) activePerks.push({ color: perkColors.golden_touch, title: 'Golden Touch' });
        if (perkState.lifeOnKill) activePerks.push({ color: perkColors.last_stand, title: 'Last Stand' });
        if (perkState.chainLightning) activePerks.push({ color: perkColors.chain_lightning, title: 'Chain Lightning' });
        if (perkState.critChance > 0) activePerks.push({ color: perkColors.critical_strike, title: 'Critical Strike' });
        if (perkState.globalDamageMult > 1) activePerks.push({ color: perkColors.glass_cannon, title: 'Glass Cannon' });
        if (perkState.economyBonusGold > 0) activePerks.push({ color: perkColors.war_chest, title: 'War Chest' });
        
        container.innerHTML = activePerks.map(p => 
            `<span class="perk-dot" style="color: ${p.color}; background: ${p.color};" title="${p.title}"></span>`
        ).join('');
    },
    
    setFortificationActive(mode) {},
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
        // Show high score on menu
        const highScoreEl = document.getElementById('menu-high-score');
        if (game.highScore > 0) {
            highScoreEl.textContent = `🏆 Best Score: ${game.highScore}`;
        } else {
            highScoreEl.textContent = '';
        }
        // Show stats
        const statsEl = document.getElementById('menu-stats');
        const bestWave = game.bestWave || 0;
        const totalKills = game.totalKills || 0;
        const stars = game.stars ? Object.values(game.stars).reduce((a,b) => a + b, 0) : 0;
        if (bestWave > 0 || totalKills > 0 || stars > 0) {
            statsEl.textContent = `🎯 Best Wave: ${bestWave} | 💀 Kills: ${totalKills} | ⭐ Total Stars: ${stars}`;
        } else {
            statsEl.textContent = '';
        }
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
        // High score
        const highScoreEl = document.getElementById('end-high-score');
        if (score >= game.highScore && score > 0) {
            highScoreEl.textContent = '🏆 NEW HIGH SCORE!';
            highScoreEl.style.textShadow = '0 0 10px rgba(255,170,0,0.5)';
        } else {
            highScoreEl.textContent = `Best: ${game.highScore}`;
        }
        // Best wave
        document.getElementById('end-best-wave').textContent = `Best Wave: ${game.bestWave}`;
        // Total kills
        document.getElementById('end-total-kills').textContent = `Total Kills: ${game.totalKills}`;
        if (game.mapInfo) {
            document.getElementById('end-map-info').textContent = `${game.mapInfo.name} • Seed: ${game.mapInfo.seed}`;
        }
    },

    showUpgradeShop(upgradeOptions, gold, currentUpgrades) {
        let modal = document.getElementById('upgrade-shop-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'upgrade-shop-modal';
            modal.innerHTML = `
                <div id="upgrade-shop-inner">
                    <h2>🛒 UPGRADE SHOP</h2>
                    <p style="color:#aaa;font-size:12px;margin-bottom:15px;">Choose an upgrade or skip</p>
                    <div id="upgrade-options"></div>
                    <button onclick="game.skipShop()" style="margin-top:15px;background:#444;">Skip ></button>
                </div>
            `;
            document.getElementById('game-container').appendChild(modal);
        }
        
        const container = document.getElementById('upgrade-options');
        container.innerHTML = '';
        
        upgradeOptions.forEach((upgrade, i) => {
            const current = currentUpgrades[upgrade.id] || 0;
            const canAfford = gold >= upgrade.cost;
            const btn = document.createElement('button');
            btn.className = 'upgrade-option';
            btn.style.cssText = 'display:block;width:100%;padding:12px;margin:8px 0;background:#222;border:2px solid #444;border-radius:8px;color:#fff;cursor:pointer;transition:all 0.2s;';
            btn.innerHTML = `
                <div style="font-size:14px;font-weight:bold;">${upgrade.name} <span style="color:#888;">(${current}/${upgrade.max})</span></div>
                <div style="font-size:11px;color:#aaa;">${upgrade.desc}</div>
                <div style="font-size:13px;margin-top:5px;${canAfford ? 'color:#ffd700;' : 'color:#ff4444;'}">💰 ${upgrade.cost}</div>
            `;
            if (canAfford && current < upgrade.max) {
                btn.style.borderColor = '#44ff88';
                btn.onmouseover = () => btn.style.background = '#333';
                btn.onmouseout = () => btn.style.background = '#222';
            } else {
                btn.style.opacity = '0.5';
            }
            btn.onclick = () => game.buyUpgrade(i);
            container.appendChild(btn);
        });
        
        modal.style.display = 'flex';
    },

    hideUpgradeShop() {
        const modal = document.getElementById('upgrade-shop-modal');
        if (modal) modal.style.display = 'none';
    }
};
