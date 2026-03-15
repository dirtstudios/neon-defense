# Neon Defense Portrait Rework Plan

## Goal
Rework Neon Defense into a portrait-first mobile game so players do not need to rotate their phone.

## Target screen structure
- **Top 10-12%**: compact stats / wave / gold / lives / speed
- **Middle 78-82%**: gameplay playfield
- **Bottom 10-15%**: tower bar + action buttons

## Core principles
- Mobile-first, not desktop shrunk down
- Thumb-friendly controls
- No horizontal scrolling ever
- Important actions always reachable
- Overlays must not block critical play area unnecessarily

## Layout plan
### Top HUD
- Gold
- Wave info
- Lives
- Speed toggle
- Small active powerup indicators
- Minimal text, icon-first where possible

### Middle playfield
- Taller visible battlefield area
- Keep enemy readability high
- Keep tower range/selection readable on phone screens
- Boss/powerup UI must avoid blocking center combat

### Bottom control dock
- Persistent tower icons
- Separate action row for Sell / Start Wave / Bestiary
- Bigger touch targets
- No overflow
- Designed for one-handed use

## Required technical changes
- Separate portrait CSS/layout mode from desktop mode
- Runtime viewport fit based on portrait shell dimensions
- Reflow HUD and overlays for narrow screens
- Review canvas/UI coordinate assumptions for portrait shell

## Overlay/UI fixes needed for portrait
- Tower upgrade/info card must avoid covering selected tower
- Perk selection must fit on a narrow screen
- Boss toasts should stay out of play area
- Bestiary should become mobile-safe
- Powerup prompts should remain readable without clutter

## Interaction improvements
- Easier tower selection on phone
- Easier tower placement confirmation
- Easier sentinel rally placement
- More forgiving tap targets
- Keep Start Wave always visible/reachable

## Portrait implementation order
1. Create portrait shell structure
2. Build compact top HUD
3. Build bottom control dock
4. Make overlays mobile-safe
5. Tune touch targets and interaction flow
6. Re-test viewport fit on normal phones and foldables

## Risks
- Too much UI can still crowd portrait mode
- Existing desktop assumptions may break on narrow layouts
- Need to preserve desktop support while improving mobile

## Success criteria
- No horizontal scrolling
- No phone rotation required
- Core actions reachable with thumb
- Game readable on standard phone screens
- Overlay panels never feel like desktop leftovers
