# PERIHELION — one-page GDD

*Designed 2026-11-12, ~10 min research + design. Engine: three.js r187 + Vite. Target: desktop browser, 60 fps, keyboard/mouse/touch.*

## Why this is a 10/10 design (the thesis)

A great design is one verb with infinite expression, instant readability, risk the player chooses, and a restart faster than the regret. Slingshotting around gravity wells is all four: anyone understands "hold to orbit, release to fly" in two seconds, yet every release is a trajectory decision, and the tighter you orbit the faster you go and the closer you are to burning. The game never explains itself; the physics does.

## Player promise
"I am a comet. Gravity is my only tool and my only enemy."

## Core loop contract
Player **holds to tether** to the nearest gravity well (circular orbit at current speed/radius) and **releases to fly straight**, to climb the corridor and chain sparks, while **the Tide** (a rising wall of void behind them) and **well surfaces / hazards / corridor edges** create risk; success gives **speed, combo, score, new sector**; failure gives a **readable death card + 1 s restart** with the same or a fresh seed.

Proven in code: verb mapped to Space / LMB / touch · objective visible (height meter, sparks glow, gate markers) · pressure inside first 10 s (Tide visible from frame 1) · reward changes state (speed + combo multiplier, not just VFX) · failure names its cause · restart is one key.

## Rules (small, so they compose)
- **Tether**: while held, you orbit the nearest well within reach at your current speed; orbit direction follows your incoming velocity. Tether line + predicted orbit ring are drawn.
- **Release**: you keep your tangential velocity. Nothing else.
- **Perihelion rule**: orbiting close to a well **adds speed** (`dv = K / r`). Touching the surface kills you. The entire risk/reward curve is this one line.
- **Drag**: free flight slowly bleeds speed toward a cruise speed, so stalling is impossible and overspeed is a choice.
- **Sparks**: gold motes. Collect within 2 s of the last for combo ×(1..8). Combo decays, not resets, on a miss window — forgiving but tense.
- **Perihelion bonus**: release while r < 1.35× well radius → "PERIHELION!" flash, score, FOV punch.
- **Hazards**: mines (static), sweepers (rotating arm around a well), black holes (pull you, can't tether, lethal core).
- **Tide**: rises from below at an accelerating rate. Falling behind = death. Forces commitment.
- **Corridor**: left/right void walls kill. Width shrinks slowly with depth.

## Run structure (roguelike skill)
Endless vertical corridor in **sectors of 60 units**. Each sector is generated from `hash(runSeed, sectorIndex)`, so floors are deterministic regardless of how you flew the previous one. Difficulty ramps per sector: well density ↑, hazard count ↑, Tide speed ↑, corridor width ↓. Daily seed = UTC date; `R` restarts same seed, `N` new seed. Death card shows seed, height, sparks, best combo, cause, and personal best (localStorage).

## Feel (game-feel skill tiers)
| Event | Tier | Bundle |
|---|---|---|
| latch | small | tick SFX, tether snap tween, trauma .12 |
| release | small | whoosh (pitch ∝ speed), comet stretch along velocity |
| spark | medium | pop SFX pitch ∝ combo, particle burst 8, scale pop, trauma .18 |
| perihelion | medium | chime, FOV punch, hitstop 50 ms, trauma .35, text pop |
| near-miss (r<1.15R) | medium | low thud, 120 ms slow-mo 0.3×, trauma .3 |
| death | large | hitstop 130 ms, trauma .9, 40 particles, flash (gated by reduce-flash) |

Rules: shake moves the camera only; hitstop scales gameplay dt only; camera/tweens/HUD use real dt; everything returns to rest; shake strength toggle (`S`), reduce flash toggle (`F`).

## Camera
Top-down perspective looking down −Z, exponential follow `1-exp(-8dt)`, look-ahead 0.35 s along velocity, slight zoom-out with speed. Shake offset composed after follow.

## Audio
Entirely synthesized with Web Audio (no assets): master → sfx + music buses; a 2-oscillator drone whose filter cutoff tracks speed; sfx per table above; unlocked on first gesture.

## Non-goals for this build
Multiplayer, saves beyond best score, mobile layout polish, menus beyond title/death, real assets.

## Milestones (each = tagged build in /build)
1. **M1 Greybox**: corridor, wells, tether/orbit/release, Tide, death+restart, debug HUD.
2. **M2 Loop**: sparks + combo, hazards, sectors + seed, score + death card.
3. **M3 Feel**: shake, hitstop, tweens, particles, trail, bloom, audio, camera look-ahead.
4. **M4 Ship**: title, controls hints, accessibility toggles, best score, touch, README, smoke test.

## Keep / kill signal (prototype-fast skill)
KEEP if a cold player releases on purpose toward a spark within 30 s and immediately presses R after dying. KILL if orbiting feels like waiting.
