# Neon Defense - Game Specification

## Overview
- **Genre:** Tower Defense
- **Style:** Neon geometric / arcade
- **Platform:** Browser (HTML5 Canvas)
- **Target:** Casual gamers, fans of tower defense

## Visual Design

### Color Palette
- **Background:** Deep black (#0a0a05) with subtle grid
- **Path:** Warm gold glow (rgba(255, 220, 50, ...))
- **Accent Colors:**
  - Cyan (#00f3ff) - UI, blaster towers
  - Purple (#aa88ff) - Snipers  
  - Orange (#ff8800) - AOE towers
  - Blue (#0088ff) - Boats
  - Green (#00ff88) - Sentinels
  - Red (#ff0055) - Enemies/bosses

### Art Style
- Geometric shapes (hexagons, diamonds, circles)
- Neon glow effects with shadowBlur
- Dark silhouettes for contrast
- Particle explosions on enemy death

## Gameplay

### Towers (5 types)
| Tower | Cost | Damage | Range | Fire Rate | Special |
|-------|------|--------|-------|-----------|---------|
| Blaster | 50 | 10 | 100 | 2.0 | - |
| Sniper | 100 | 50 | 200 | 0.3 | Pierce |
| AOE | 150 | 15 | 80 | 0.8 | Splash + Slow |
| Boat | 75 | 20 | 140 | 1.2 | Water only |
| Sentinel | 75 | - | - | - | Deploys drones |

### Enemies (10 types)
| Enemy | HP | Speed | Gold | Resistances |
|-------|-----|-------|------|--------------|
| Basic | 30 | 2.0 | 10 | None |
| Fast | 20 | 3.0 | 15 | Weak to Pierce |
| Tank | 100 | 1.0 | 30 | Armor (kinetic 0.5x) |
| Shield | 60 | 1.8 | 20 | Shield (fire 0.5x) |
| Swarm | 12 | 2.5 | 5 | Hard to snipe |
| Healer | 40 | 1.5 | 25 | Heals allies |
| Stealth | 35 | 2.2 | 20 | Partial invisibility |
| Boss (4 types) | 380-620 | 0.42-0.65 | 100-140 | Multiple resistances |

### Progression
- 5 waves per level (Level 1), scales endlessly
- 3 random perks after each level
- 9 perk types: damage boosts, economy, sentinel buffs
- Tower upgrades: 3 tiers per tower

## Technical

- Single HTML file with modular JS
- Canvas 2D rendering at 60 FPS
- Object pooling for particles/projectiles
- Responsive to window size
- Sound via Web Audio API

## Revenue Model
- Free to play
- Itch.io: potential for donations
