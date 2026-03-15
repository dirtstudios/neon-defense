# Neon Defense Branching Upgrades Plan

## Goal
Replace simple linear upgrades with a more replayable branching system that creates distinct builds.

## New tower upgrade structure
- **Tier 1**: base tower
- **Tier 2**: straight upgrade
- **Tier 3**: choose one of two branches
- **Tier 4**: final capstone upgrade unique to the chosen branch

## Why this matters
- Makes runs feel different
- Creates stronger build identity
- Supports more addicting progression
- Gives players meaningful choices instead of pure stat bumps

## Branching rules
- Branch choice happens when upgrading from Tier 2 -> Tier 3
- Once chosen, the other branch is locked out for that run
- Tier 4 is specific to the chosen branch
- Branch choice UI must be clear and mobile-safe

## Proposed branches
### Blaster
- **Minigun Path**: very fast fire rate, suppression, lots of shots
- **Shock Path**: heavier shots, arc/stun potential, burst feel

### Sniper
- **Railgun Path**: piercing line shots, anti-lineup damage
- **Hunter Path**: crit/execute style, anti-elite/boss identity

### AOE
- **Inferno Path**: burn, lingering damage zones
- **Cryo Path**: freeze/slow/shatter control style

### Boat
- **Torpedo Path**: anti-tank/boss burst
- **Carrier Path**: faster support fire, lane control

### Sentinel
- **Legion Path**: more units, fast respawns, swarm/blocking
- **Guardian Path**: fewer but tankier stronger units, anti-elite role

## Tier 4 concept
Each branch gets one final upgrade that amplifies its specialization.
Examples:
- Minigun IV = overheating barrage
- Shock IV = chain shock/stun burst
- Railgun IV = full pierce beam
- Hunter IV = huge crit multiplier / mark mechanic
- Inferno IV = persistent burning pool
- Cryo IV = freeze nova/shatter bonus
- Torpedo IV = boss breaker volley
- Carrier IV = support barrage / wake control
- Legion IV = max troop flood
- Guardian IV = elite shield wall

## UI requirements
- Branch choice panel after tapping upgrade on Tier 2 tower
- Must show both branches side-by-side
- Must include short identity text, not just numbers
- Must work on mobile screens
- Must not cover the selected tower awkwardly

## Technical changes needed
- Refactor upgrade data model to support branches
- Track branch choice per tower
- Update upgrade UI and tooltip logic
- Update sell value / total invested logic
- Support branch-specific visuals later

## Addicting progression tie-ins
Branching upgrades should combine with:
- perks
- powerup drops
- boss counters
- run identity

## Recommended implementation order
1. Refactor upgrade data structure
2. Support branch state per tower
3. Build branch choice UI
4. Implement one tower fully as a test case
5. Expand to all towers
6. Add branch-specific Tier 4 capstones

## Success criteria
- Players can describe a run by its build identity
- Upgrade decisions feel meaningful
- Branch choice is clear and exciting
- Tier 4 feels like a payoff, not just more numbers
