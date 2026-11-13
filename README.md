# SWINGBY

*A comet, a corridor of gravity wells, and one button.* Named after the gravity-assist swing-by. **Hold** to tether to the nearest well and orbit it. **Release** to fly straight. The tighter the orbit, the faster you go, and the closer you are to burning. The Tide rises behind you. Chain sparks for combo, cash tight orbits for PERIHELION bonuses, climb as high as you can.

Built with three.js r187 + Vite, no art or audio assets (everything is procedural and synthesized).

## What's in it

- **12 authored levels** with a finish gate and three stars each (clear, spark quota, perihelion quota), unlocked sequentially.
- **Endless** with a random seed and **Daily** with the shared UTC-date seed.
- **XP and player level**, 9 comet skins and 6 trails unlocked by level or by total stars. Cosmetics only, never power.
- **Profile** saved locally and versioned, with settings for shake, flashes, reduce motion and mute.
- **Feel**: shockwave rings, chromatic kicks, slow-motion supernova deaths coloured by what killed you, escalating combo visuals, synthesized audio.

## Play

```bash
npm install
npm run dev        # http://localhost:5188
```

| Key | |
|---|---|
| Space / click / touch | hold to tether, release to fly |
| R | retry same seed |
| N | new random seed |
| M | mute |
| S | toggle screen shake |
| F | toggle flashes |
| D | debug HUD |

The default seed is the UTC date, so everyone plays the same corridor each day.

## Platforms

One web build (`dist/`, a single HTML file) wrapped four ways:

| Target | Wrapper | Local command | Needs |
|---|---|---|---|
| macOS | Tauri 2 | `npm run desktop:build` → `src-tauri/target/release/bundle/dmg` | Rust |
| Windows | Tauri 2 | same, on a Windows machine or the CI `desktop` job → `.exe` / `.msi` | Rust + MSVC |
| iOS | Capacitor 8 | `npm run mobile:sync && npm run ios:open` → build in Xcode | Xcode 26+ |
| Android | Capacitor 8 | `npm run android:apk` → `android/app/build/outputs/apk` | Android SDK, JDK 21 |

`.github/workflows/build.yml` builds all four on a `v*` tag or manual dispatch: macOS arm64 and x64 DMGs, a Windows NSIS installer and MSI, an Android debug APK plus release AAB, and an unsigned iOS archive. Signing for the stores needs an Apple App Store Connect API key and an Android keystore added as repository secrets.

Native touches: haptics on latch, spark, perihelion, near-miss, death and clear (Capacitor Haptics, feature-detected), hidden status bar, portrait lock, pause when the app goes to the background, no pinch-zoom.

## Build and test

```bash
npm run build          # dist/
sh scripts_build.sh M6 # dist -> build/swingby-M6.zip, commit + tag
npm run smoke -- http://localhost:5188/   # headless bot playtest + screenshots in build/shots
```

The smoke test loads the game in headless Chromium, runs an in-page bot through a full run (latch, release, spark, death, restart), checks the touch path at phone size, and fails on any console or page error.

## Design

See [docs/DESIGN.md](docs/DESIGN.md) for the one-page GDD, the core loop contract, feel tiers and milestones. Tuning constants live in [src/tuning.js](src/tuning.js).

## Layout

```
src/main.js     loop, hitstop, events -> feedback, HUD, title/death cards
src/player.js   comet physics: tether/orbit/release, perihelion speed rule, drag
src/world.js    seeded sector generation (wells, sparks, mines, sweepers, singularities) + meshes
src/camera.js   follow + look-ahead + trauma shake + FOV punch
src/feel.js     tweens, pooled particles, ribbon trail
src/audio.js    Web Audio synth: drone that tracks speed, SFX per event
src/rng.js      seeded RNG, per-sector sub-seeds, daily seed
tests/smoke.mjs Playwright bot playtest
```
