import * as THREE from 'three';
import { T } from './tuning.js';
import { genSector, WorldView } from './world.js';
import { Comet } from './player.js';
import { Input } from './input.js';
import { CameraRig } from './camera.js';
import { dailySeed, randomSeed } from './rng.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Tweens, Particles, Trail, Shockwaves, ease } from './feel.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { Audio } from './audio.js';
import { loadProfile, saveProfile, resetProfile } from './save.js';
import { LEVELS, endlessProfile, levelFinishY } from './levels.js';
import { SKINS, TRAILS, runXp, syncUnlocks, levelFromXp } from './progression.js';
import { Menu } from './menu.js';
import { initNative, haptic } from './native.js';
initNative();

// ---------- renderer / scene ----------
const canvas = document.querySelector('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060c);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
scene.add(new THREE.AmbientLight(0x8090ff, 0.35));
const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(4, 6, 10); scene.add(key);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.5, 0.75);
composer.addPass(bloom);
const rgb = new ShaderPass(RGBShiftShader); rgb.uniforms.amount.value = 0; rgb.uniforms.angle.value = 0.6; composer.addPass(rgb);
composer.addPass(new OutputPass());
const tweens = new Tweens(); const particles = new Particles(scene, 900); const trail = new Trail(scene, 160); const shock = new Shockwaves(scene); const audio = new Audio();
const hintEl = document.querySelector('#hint'); let hintT = 0;
function hint(html, secs = 6) { hintEl.innerHTML = html; hintEl.classList.add('show'); hintT = secs; }

// stars (parallax layer far behind)
let stars;
{
  const n = 900, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i*3] = (Math.random()-0.5)*160; pos[i*3+1] = (Math.random()-0.5)*160; pos[i*3+2] = -30 - Math.random()*40; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fb0ff, size: 0.18, transparent: true, opacity: 0.8 }));
  scene.add(stars);
}
const world = new WorldView(scene);
const comet = new Comet();
const rig = new CameraRig(camera);
const input = new Input(canvas);

const SHAPES = {
  sphere: () => new THREE.SphereGeometry(0.42, 24, 16),
  gem: () => new THREE.OctahedronGeometry(0.5, 0),
  dart: () => { const g = new THREE.ConeGeometry(0.34, 1.1, 4); g.rotateZ(-Math.PI / 2); return g; },
  ring: () => new THREE.TorusGeometry(0.36, 0.13, 10, 28),
  star: () => { const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.22 : 0.52, a = i / 10 * Math.PI * 2; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false }).translate(0, 0, -0.1); },
  cube: () => new THREE.BoxGeometry(0.62, 0.62, 0.62),
  shard: () => new THREE.TetrahedronGeometry(0.58, 0),
};
const cometMesh = new THREE.Mesh(SHAPES.sphere(), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: 1.6, roughness: 0.2 }));
scene.add(cometMesh);
const tetherGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const tether = new THREE.Line(tetherGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 })); tether.visible = false; scene.add(tether);
const aimGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 24 }, () => new THREE.Vector3()));
const aim = new THREE.LineSegments(aimGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })); aim.visible = false; scene.add(aim);
const orbitRing = new THREE.Mesh(new THREE.RingGeometry(0.98, 1.0, 128), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); orbitRing.visible = false; scene.add(orbitRing);
const tideMesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: 0x1a0a2e }));
const tideEdge = new THREE.Mesh(new THREE.PlaneGeometry(400, 0.3), new THREE.MeshBasicMaterial({ color: 0xd98bff }));
const tideGlow = new THREE.Mesh(new THREE.PlaneGeometry(400, 6), new THREE.MeshBasicMaterial({ color: 0x6a2bbf, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(tideMesh, tideEdge, tideGlow);
// finish gate (levels)
const gate = new THREE.Group();
gate.add(new THREE.Mesh(new THREE.PlaneGeometry(40, 0.25), new THREE.MeshBasicMaterial({ color: 0xffd166 })));
const gateGlow = new THREE.Mesh(new THREE.PlaneGeometry(40, 5), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false })); gateGlow.position.y = 2.5; gate.add(gateGlow);
gate.visible = false; scene.add(gate);

const hud = { h: document.querySelector('#h'), score: document.querySelector('#score'), combo: document.querySelector('#combo'), debug: document.querySelector('#debug'), card: document.querySelector('#card'), top: document.querySelector('#top') };
const popsEl = document.querySelector('#pops'); const _v = new THREE.Vector3();
function pop(text, x, y, color = '#fff', big = false) {
  _v.set(x, y, 0).project(camera);
  const el = document.createElement('div'); el.className = 'pop'; el.textContent = text; el.style.color = color; if (big) el.style.fontSize = '28px';
  el.style.left = `${(_v.x * 0.5 + 0.5) * window.innerWidth}px`; el.style.top = `${(-_v.y * 0.5 + 0.5) * window.innerHeight}px`;
  popsEl.appendChild(el); setTimeout(() => el.remove(), 950);
}

// ---------- game state ----------
const S = { mode: 'endless', level: null, seed: dailySeed(), sectors: new Map(), wells: [], sparks_: [], mines: [], sweepers: [], holes: [], tideY: -T.TIDE_START_GAP, tideV: T.TIDE_V0, maxY: 0, score: 0,
  timeScale: 1, hitstop: 0, running: false, elapsed: 0, dead: false, deadAt: 0, won: false, popScale: 1, combo: 1, comboT: 0, bestCombo: 1, sparks: 0, peris: 0, totalSparks: 0, finishY: Infinity, tideMul: 1, shock: 0, glow: 0 };
const G = { profile: loadProfile(), saveNow() { saveProfile(this.profile); }, resetProfile() { this.profile = resetProfile(); this.applyCosmetics(); this.applySettings(); },
  play(mode, id) { startRun(mode, id); }, retry() { startRun(S.mode, S.level?.id, S.seed); }, applyCosmetics, applySettings,
  abandon() { S.paused = false; S.running = false; },
  pause() { if (!S.running || S.paused) return; S.paused = true; S.running = false; menu.show('pause'); },
  resume() { if (!S.paused) return; S.paused = false; S.running = true; menu.hide(); input.held = false; },
  demo(on) { S.demo = on; world.group.visible = !on; tideMesh.visible = tideEdge.visible = tideGlow.visible = !on; if (on) { S.running = false; trail.reset(comet.x, comet.y); } else { cometMesh.visible = false; } } };
const menu = new Menu(document.querySelector('#menu'), G);

function profileFor(idx) {
  if (S.mode === 'level') { if (idx >= S.level.sectors) return { ...S.level.profile(idx), empty: true }; return S.level.profile(idx); }
  return endlessProfile(idx);
}
function halfWidth(idx) { return profileFor(Math.max(0, idx)).halfW; }
function ensureSectors() {
  const cur = Math.floor(comet.y / T.SECTOR_H);
  for (let i = Math.max(0, cur - 1); i <= cur + 2; i++) {
    if (!S.sectors.has(i)) { const prev = [...S.sectors.values()].flatMap(s => s.wells); const sec = genSector(S.seed, i, prev, profileFor(i)); S.sectors.set(i, sec); world.add(sec); }
  }
  for (const i of [...S.sectors.keys()]) if (i < cur - 1) { world.remove(i); S.sectors.delete(i); }
  const near = (o) => Math.abs(o.y - comet.y) < 40; const secs = [...S.sectors.values()];
  S.wells = secs.flatMap(s => s.wells).filter(near); S.sparks_ = secs.flatMap(s => s.sparks).filter(near);
  S.mines = secs.flatMap(s => s.mines).filter(near); S.sweepers = secs.flatMap(s => s.sweepers).filter(sw => near(sw.well)); S.holes = secs.flatMap(s => s.holes).filter(near);
}
function clearWorld() { for (const i of [...S.sectors.keys()]) world.remove(i); S.sectors.clear(); }
function startRun(mode, levelId, seed) {
  S.mode = mode; S.level = mode === 'level' ? LEVELS.find(L => L.id === levelId) : null;
  S.seed = mode === 'level' ? S.level.seed : mode === 'daily' ? dailySeed() : (seed || randomSeed());
  S.tideMul = S.level ? S.level.tide : 1; S.finishY = S.level ? levelFinishY(S.level) : Infinity;
  clearWorld(); comet.reset();
  Object.assign(S, { tideY: -T.TIDE_START_GAP, tideV: T.TIDE_V0, maxY: 0, score: 0, timeScale: 1, hitstop: 0, running: true, elapsed: 0, dead: false, won: false, combo: 1, comboT: 0, bestCombo: 1, sparks: 0, peris: 0, maxFired: false, demo: false, paused: false });
  rig.snap(0, 4); ensureSectors();
  // levels: count every spark up front (finite corridor) for the star goal
  S.totalSparks = 0; if (S.level) { const prev = []; for (let i = 0; i < S.level.sectors; i++) { const sec = S.sectors.get(i) || genSector(S.seed, i, prev, profileFor(i)); S.totalSparks += sec.sparks.length; prev.push(...sec.wells); } }
  gate.visible = !!S.level; gate.position.set(0, S.finishY, 0.1);
  trail.reset(0, 0); cometMesh.visible = true; S.popScale = 1; audio.restart(); menu.hide(); hud.top.style.opacity = 1;
  G.profile.stats.runs++; G.profile.firstRun = false; G.saveNow();
  hintEl.classList.remove('show'); hintT = 0;
  S.tut = (!G.profile.tutorialDone && S.level?.id === 1) ? 'hold' : null;
}
// Tutorial: one or two words, shown when they matter, game slows until you do the thing.
function tutorial(dt) {
  if (!S.tut || !S.running) return;
  if (S.tut === 'hold') {
    if (comet.nearestReachable(S.wells)) { hint('HOLD', 99); S.timeScale = 0.25; if (comet.tether) { S.tut = 'release'; S.timeScale = 1; hintEl.classList.remove('show'); } }
  } else if (S.tut === 'release') {
    if (comet.tether) { const up = comet.vy / (Math.hypot(comet.vx, comet.vy) || 1); if (up > 0.8) { hint('RELEASE', 99); S.timeScale = 0.3; } else { hintEl.classList.remove('show'); S.timeScale = 1; } }
    else { S.timeScale = 1; hintEl.classList.remove('show'); S.tut = 'spark'; }
  } else if (S.tut === 'spark') {
    if (S.sparks > 0) { S.tut = 'tight'; hint('TIGHT ORBIT = SPEED', 3); }
  } else if (S.tut === 'tight') {
    if (comet.tether && comet.minRatio < T.PERI_RATIO) { hint('RELEASE HERE = BONUS', 3); S.tut = 'done'; G.profile.tutorialDone = true; G.saveNow(); }
  }
}
function endRun(won) {
  S.paused = false; S.running = false; S.won = won; S.dead = !won; S.deadAt = S.elapsed; hintEl.classList.remove('show'); hintT = 0;
  const p = G.profile; const before = levelFromXp(p.xp).lvl;
  p.stats.sparks += S.sparks; p.stats.peris += S.peris; p.stats.height += Math.floor(S.maxY); if (!won) p.stats.deaths++;
  let data;
  if (S.level) {
    const L = S.level; const st = p.levels[L.id] || (p.levels[L.id] = { stars: 0, bestScore: 0, completed: false });
    const sparkNeed = Math.ceil(S.totalSparks * L.sparkGoal); const sparkOk = S.sparks >= sparkNeed, periOk = S.peris >= L.periGoal;
    const stars = won ? 1 + (sparkOk ? 1 : 0) + (periOk ? 1 : 0) : 0;
    const newStars = Math.max(0, stars - st.stars); const firstWin = won && !st.completed;
    const xp = runXp({ score: S.score, sparks: S.sparks, peris: S.peris, height: S.maxY, levelDef: L, won, firstWin, newStars });
    st.stars = Math.max(st.stars, stars); st.bestScore = Math.max(st.bestScore, S.score); if (won) st.completed = true;
    p.xp += xp; const unlocks = syncUnlocks(p); G.saveNow();
    data = { level: L, won, cause: comet.cause, stars, sparkOk, periOk, sparks: S.sparks, sparkNeed, peris: S.peris, score: S.score, xp, unlocks };
    setTimeout(() => menu.show('results', data), won ? 900 : 1100);
  } else {
    const xp = runXp({ score: S.score, sparks: S.sparks, peris: S.peris, height: S.maxY, levelDef: { tier: 0 }, won: false, firstWin: false, newStars: 0 });
    let newBest = false, best;
    if (S.mode === 'daily') { if (p.daily.date !== dailySeed()) { p.daily.date = dailySeed(); p.daily.best = 0; } newBest = S.score > p.daily.best; if (newBest) p.daily.best = S.score; best = p.daily.best; }
    else { newBest = S.score > p.endless.best; if (newBest) p.endless.best = S.score; p.endless.bestH = Math.max(p.endless.bestH, Math.floor(S.maxY)); best = p.endless.best; }
    p.xp += xp; const unlocks = syncUnlocks(p); G.saveNow();
    data = { mode: S.mode, cause: comet.cause, height: Math.floor(S.maxY), score: S.score, sparks: S.sparks, bestCombo: S.bestCombo, xp, newBest, best, seed: S.seed, unlocks };
    setTimeout(() => menu.show('dead', data), 1100);
  }
  if (levelFromXp(p.xp).lvl > before) setTimeout(() => pop(`LEVEL ${levelFromXp(p.xp).lvl}!`, comet.x, comet.y + 3, '#ffd166', true), 600);
}

// ---------- cosmetics / settings ----------
let skin = SKINS[0], trailDef = TRAILS[0];
function applyCosmetics() {
  skin = SKINS.find(s => s.id === G.profile.equipped.skin) || SKINS[0]; trailDef = TRAILS.find(t => t.id === G.profile.equipped.trail) || TRAILS[0];
  cometMesh.material.color.set(skin.color); cometMesh.material.emissive.set(skin.emissive);
  if (cometMesh.userData.shape !== skin.shape) { cometMesh.geometry.dispose(); cometMesh.geometry = SHAPES[skin.shape](); cometMesh.userData.shape = skin.shape; }
  trail.color.set(trailDef.color ?? skin.trail); trail.color2 = trailDef.color2 ? new THREE.Color(trailDef.color2) : null; trail.jitter = trailDef.jitter || 0; trail.width = trailDef.width; trail.setLength(trailDef.len);
  tether.material.color.set(skin.trail); orbitRing.material.color.set(skin.trail);
}
function applySettings() { const s = G.profile.settings; rig.strength = s.shake ? 0.8 : 0; rig.reduceMotion = s.reduceMotion; if (audio.muted !== s.mute) audio.toggleMute(); }
function flash(color = '#fff', ms = 200) { if (!G.profile.settings.flash) { color = color === '#fff' ? 'rgba(255,255,255,.25)' : color.replace(')', ',.3)').replace('rgb', 'rgba'); } const el = document.createElement('div'); el.className = 'flash c'; el.style.setProperty('--c', color); el.style.animationDuration = ms + 'ms'; document.body.appendChild(el); setTimeout(() => el.remove(), ms + 20); }
function trailFx(speedK) {
  const fx = trailDef.fx; if (fx === 'none') return;
  const r = Math.random();
  if (fx === 'sparkle' && r < 0.3 + speedK) particles.burst(comet.x, comet.y, 1, trail.color, 1.5, 0.5, 0.3);
  else if (fx === 'fire' && r < 0.9) { particles.burst(comet.x - comet.vx * 0.03, comet.y - comet.vy * 0.03, 2, r < 0.45 ? 0xff8a2a : 0xffd27a, 2.2, 0.45, 0.6); if (r < 0.2) particles.burst(comet.x, comet.y, 1, 0xff2a1a, 1, 0.8, 0.9); }
  else if (fx === 'electric' && r < 0.5) particles.burst(comet.x + (Math.random() - 0.5) * 1.2, comet.y + (Math.random() - 0.5) * 1.2, 1, 0xdfffff, 5, 0.18, 0.35);
  else if (fx === 'plasma' && r < 0.6) particles.burst(comet.x, comet.y, 1, r < 0.3 ? 0xb06bff : 0x4af0ff, 1.2, 0.7, 0.55);
}
function kick(amount) { S.shock = Math.min(1.5, S.shock + amount); }
applyCosmetics(); applySettings();

input.onKey = (code) => {
  if (code === 'Escape') { if (S.running) G.pause(); else if (S.paused) G.resume(); else if (menu.visible) menu.back(); return; }
  if (code === 'KeyR' && (S.running || S.dead || S.won)) G.retry();
  if (code === 'KeyN' && S.mode !== 'level' && (S.running || S.dead)) startRun('endless');
  if (code === 'KeyM') { G.profile.settings.mute = audio.toggleMute(); G.saveNow(); }
  if (code === 'KeyD') hud.debug.style.display = hud.debug.style.display === 'none' ? '' : 'none';
};
document.addEventListener('visibilitychange', () => { if (document.hidden) G.pause(); });
window.addEventListener('pointerdown', () => audio.unlock()); window.addEventListener('keydown', () => audio.unlock());
hud.debug.style.display = 'none';

// ---------- loop ----------
const timer = new THREE.Timer(); timer.connect(document);
const events = [];
function addCombo() { S.combo = Math.min(T.COMBO_MAX, S.combo + 1); S.comboT = T.COMBO_WINDOW; S.bestCombo = Math.max(S.bestCombo, S.combo); }
function kill(cause) { if (!comet.alive) return; comet.die(cause); events.push({ type: 'death' }); }
function update(realDt) {
  if (S.hitstop > 0) { S.hitstop -= realDt; if (S.hitstop <= 0) S.timeScale = 1; }
  if (S.won) { /* keep clear slow-mo */ }
  const dt = realDt * S.timeScale;
  const inp = input.consume();
  S.elapsed += realDt;
  if (S.running) {
    tutorial(dt);
    comet.wantTether = inp.held;
    if (inp.pressed && !comet.tether) { const w = comet.nearestReachable(S.wells); if (w) { comet.latch(w); events.push({ type: 'latch', well: w }); } }
    if (inp.released && comet.tether) { const r = comet.release(); events.push({ type: 'release', ...r }); }
    comet.step(dt, S.wells, events, S.holes);
    if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0 && S.combo > 1) { S.combo = Math.max(1, Math.ceil(S.combo / 2)); S.comboT = T.COMBO_WINDOW * 0.6; if (S.combo < T.COMBO_MAX) S.maxFired = false; } }
    for (const sp of S.sparks_) {
      if (sp.got) continue;
      const sd = Math.hypot(sp.x - comet.x, sp.y - comet.y);
      if (sd < T.MAGNET_R && sd > 0.01) { const k = Math.min(1, T.MAGNET_V * dt / sd) * (1 - sd / T.MAGNET_R + 0.35); sp.x += (comet.x - sp.x) * k; sp.y += (comet.y - sp.y) * k; sp.mesh.position.x = sp.x; sp.mesh.position.y = sp.y; }
      if (sd < T.PICKUP_R) { sp.got = true; sp.mesh.visible = false; addCombo(); const pts = T.SPARK_SCORE * S.combo; S.score += pts; S.sparks++; events.push({ type: 'spark', x: sp.x, y: sp.y, pts }); }
      else { sp.mesh.rotation.y += dt * 2; sp.mesh.position.z = Math.sin(S.elapsed * 3 + sp.phase) * 0.15; }
    }
    if (comet.alive) {
      for (const m of S.mines) { m.mesh.rotation.x += dt * 0.7; m.mesh.rotation.y += dt; if (Math.hypot(m.x - comet.x, m.y - comet.y) < m.r + 0.4) { kill('STRUCK A MINE'); break; } }
      for (const sw of S.sweepers) {
        sw.a += sw.w * dt; sw.mesh.rotation.z = sw.a;
        const ax = sw.well.x + Math.cos(sw.a) * sw.well.r, ay = sw.well.y + Math.sin(sw.a) * sw.well.r, bx = sw.well.x + Math.cos(sw.a) * (sw.well.r + sw.len), by = sw.well.y + Math.sin(sw.a) * (sw.well.r + sw.len);
        const px = comet.x - ax, py = comet.y - ay, dx = bx - ax, dy = by - ay; const t = Math.max(0, Math.min(1, (px*dx + py*dy) / (dx*dx + dy*dy))); const d = Math.hypot(px - dx*t, py - dy*t);
        if (d < sw.thick / 2 + 0.4) kill('CUT DOWN BY A SWEEPER');
      }
      for (const h of S.holes) { h.ring.rotation.z += dt * 2; h.ring.scale.setScalar(h.r * (1.4 + 0.3 * Math.sin(S.elapsed * 4))); if (Math.hypot(h.x - comet.x, h.y - comet.y) < h.r + 0.3) kill('CRUSHED BY A SINGULARITY'); }
    }
    const idx = Math.floor(comet.y / T.SECTOR_H); const hw = halfWidth(idx);
    if (Math.abs(comet.x) > hw) kill('LOST TO THE VOID');
    S.tideV = (T.TIDE_V0 + Math.max(0, idx) * T.TIDE_V_PER_SECTOR) * S.tideMul;
    const gap = comet.y - S.tideY; const rubber = gap > T.TIDE_MAX_GAP ? (gap - T.TIDE_MAX_GAP) * 0.8 : 0;
    S.tideY += (S.tideV + rubber) * dt;
    if (comet.y < S.tideY) kill('SWALLOWED BY THE TIDE');
    if (comet.y > S.maxY) { const a = Math.floor(S.maxY), b = Math.floor(comet.y); S.score += (b - a) * T.HEIGHT_SCORE; S.maxY = comet.y; }
    if (comet.alive && comet.y >= S.finishY) events.push({ type: 'win' });
    ensureSectors();
  }
  if (S.demo) { // live preview: fly a figure-8 behind the customize panel
    const t = S.elapsed * 1.6; const cx = window.innerWidth > 700 ? 7.5 : 0, cy = window.innerWidth > 700 ? 8 : 14;
    comet.x = cx + Math.sin(t) * 3.4; comet.y = cy + Math.sin(t * 2) * 1.8; comet.vx = Math.cos(t) * 3.4 * 1.6; comet.vy = Math.cos(t * 2) * 1.8 * 3.2; comet.speed = T.CRUISE + 6; comet.alive = true;
    cometMesh.visible = true; 
  }
  for (const e of events) handle(e); events.length = 0;
  rig.update(realDt, comet); if (S.demo) { camera.position.set(window.innerWidth > 700 ? 2.5 : 0, window.innerWidth > 700 ? 8 : 8, 26); camera.rotation.set(0, 0, 0); } tweens.update(realDt); particles.update(realDt); shock.update(realDt);
  S.shock = Math.max(0, S.shock - realDt * 2.2); S.glow += ((S.combo >= 4 ? (S.combo - 3) * 0.06 : 0) - S.glow) * Math.min(1, realDt * 4);
  const rm = G.profile.settings.reduceMotion;
  rgb.uniforms.amount.value = rm ? 0 : S.shock * S.shock * 0.006; rgb.uniforms.angle.value += realDt * 3;
  bloom.strength = 0.55 + S.shock * 0.7 + S.glow;
  if (hintT > 0) { hintT -= realDt; if (hintT <= 0) hintEl.classList.remove('show'); }
  if (S.running && comet.alive && S.combo >= 6 && Math.random() < 0.5) particles.burst(comet.x, comet.y, 1, 0xffd166, 2, 0.5, 0.35);
  const speedK = Math.max(0, Math.min(1, (comet.speed - T.CRUISE) / (T.MAX_SPEED - T.CRUISE)));
  stars.material.size = 0.18 + speedK * 0.25; trail.width = trailDef.width * (1 + S.glow * 3);
  audio.update(speedK, !!comet.tether, S.running ? Math.max(0, 1 - (comet.y - S.tideY) / 12) : 0);
  // views
  cometMesh.position.set(comet.x, comet.y, 0);
  if ((comet.alive && S.running) || S.demo) { trail.push(comet.x, comet.y, speedK); trailFx(speedK); }
  cometMesh.rotation.x += realDt * (skin.shape === 'ring' ? 4 : skin.shape === 'sphere' || skin.shape === 'dart' ? 0 : 2.5);
  if (skin.cycle) { const h = (S.elapsed * 0.25) % 1; cometMesh.material.emissive.setHSL(h, 0.9, 0.65); trail.color.setHSL(h, 0.9, 0.6); }
  cometMesh.rotation.z = Math.atan2(comet.vy, comet.vx);
  const stretch = 1 + speedK * 0.9; cometMesh.scale.set(stretch * S.popScale, (1 / Math.sqrt(stretch)) * S.popScale, S.popScale);
  cometMesh.material.emissiveIntensity = 1.4 + speedK * 1.6;
  if (comet.tether) {
    const w = comet.tether.well; tether.visible = true; orbitRing.visible = true;
    tetherGeo.attributes.position.setXYZ(0, comet.x, comet.y, 0); tetherGeo.attributes.position.setXYZ(1, w.x, w.y, 0); tetherGeo.attributes.position.needsUpdate = true;
    orbitRing.position.set(w.x, w.y, 0.02); orbitRing.scale.setScalar(comet.tether.R);
    aim.visible = true; const sp = Math.hypot(comet.vx, comet.vy) || 1, ux = comet.vx / sp, uy = comet.vy / sp; const ap = aimGeo.attributes.position;
    for (let i = 0; i < 12; i++) { const d0 = 1 + i * 1.4, d1 = d0 + 0.7; ap.setXYZ(i * 2, comet.x + ux * d0, comet.y + uy * d0, 0.05); ap.setXYZ(i * 2 + 1, comet.x + ux * d1, comet.y + uy * d1, 0.05); }
    ap.needsUpdate = true;
  } else { tether.visible = false; orbitRing.visible = false; aim.visible = false; }
  tideMesh.position.set(camera.position.x, S.tideY - 200, -0.1); tideEdge.position.set(camera.position.x, S.tideY, 0.1); tideGlow.position.set(camera.position.x, S.tideY - 3, 0.05); tideGlow.material.opacity = 0.3 + 0.12 * Math.sin(S.elapsed * 5);
  stars.position.set(camera.position.x * 0.8, camera.position.y * 0.8, 0);
  hud.h.textContent = S.level ? `${Math.floor(Math.max(0, S.finishY - comet.y))}m` : Math.floor(S.maxY); hud.score.textContent = S.score; hud.combo.textContent = `×${S.combo}`; hud.combo.classList.toggle('hot', S.combo >= 3); hud.combo.classList.toggle('max', S.combo >= T.COMBO_MAX);
  hud.debug.textContent = `speed ${comet.speed.toFixed(1)}  tide gap ${(comet.y - S.tideY).toFixed(1)}  tether ${comet.tether ? (comet.tether.R / comet.tether.well.r).toFixed(2) + 'R' : '-'}  wells ${S.wells.length}  ts ${S.timeScale.toFixed(2)}  ${S.mode} ${S.seed}`;
}
function handle(e) {
  switch (e.type) {
    case 'latch': haptic.light(); rig.addTrauma(0.12); audio.latch(); tweens.add(0.22, (k) => { S.popScale = 1 + (1 - k) * 0.35; }, ease.outBack, 'pop'); particles.burst(comet.x, comet.y, 4, e.well.mesh.material.color, 3, 0.35, 0.35); break;
    case 'release':
      audio.release(Math.max(0, (comet.speed - T.CRUISE) / (T.MAX_SPEED - T.CRUISE)));
      tweens.add(0.3, (k) => { S.popScale = 1 + (1 - k) * 0.25; }, ease.outBack, 'pop');
      if (e.ratio < T.PERI_RATIO) { haptic.success(); audio.perihelion(); particles.burst(comet.x, comet.y, 26, 0x8fd3ff, 11, 0.8, 0.7); particles.burst(comet.x, comet.y, 12, 0xffffff, 18, 0.4, 0.4); shock.spawn(comet.x, comet.y, { r: 7, dur: 0.55, color: 0x8fd3ff }); shock.spawn(e.well.x, e.well.y, { r: e.well.r * 3, dur: 0.7, color: e.well.mesh.material.color, opacity: 0.6 }); kick(0.7); flash('rgb(143,211,255)', 120); addCombo(); const pts = T.PERI_SCORE * S.combo; S.score += pts; S.peris++; rig.addTrauma(0.35); rig.punch(1); S.timeScale = 0.05; S.hitstop = Math.max(S.hitstop, T.HITSTOP_PERI); pop(`PERIHELION +${pts}`, comet.x, comet.y, '#8fd3ff'); }
      break;
    case 'spark': haptic.light(); rig.addTrauma(0.18 + S.combo * 0.02); audio.spark(S.combo); particles.burst(e.x, e.y, 10 + S.combo * 3, 0xffd166, 7 + S.combo, 0.55, 0.55); if (S.combo >= 4) { shock.spawn(e.x, e.y, { r: 2 + S.combo * 0.5, dur: 0.4, color: 0xffd166, opacity: 0.7 }); kick(0.15); } if (S.combo >= T.COMBO_MAX && !S.maxFired) { S.maxFired = true; shock.spawn(e.x, e.y, { r: 9, dur: 0.6, color: 0xff6fa8, opacity: 0.8 }); kick(0.5); flash('rgb(255,111,168)', 100); pop('MAX', e.x, e.y + 1.5, '#ff6fa8', true); } tweens.add(0.25, (k) => { S.popScale = 1 + (1 - k) * 0.4; }, ease.outBack, 'pop'); pop(`+${e.pts}`, e.x, e.y, '#ffd166');
      hud.combo.animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' }); break;
    case 'near': haptic.medium(); rig.addTrauma(0.3); audio.near(); S.timeScale = 0.3; S.hitstop = Math.max(S.hitstop, T.SLOWMO_NEAR); particles.burst(comet.x, comet.y, 6, e.well.mesh.material.color, 4, 0.4, 0.4); shock.spawn(e.well.x, e.well.y, { r: e.well.r * 1.6, dur: 0.35, color: e.well.mesh.material.color, opacity: 0.5 }); kick(0.35); tweens.add(0.4, (k) => { e.well.mesh.material.emissiveIntensity = 0.28 + (1 - k) * 2.2; }, ease.outCubic, 'wellflash'); break;
    case 'death': {
      // supernova: freeze, then a slow-motion blast in the killer's colour, rings, chromatic tear
      const c = comet.cause || ''; const col = c.includes('TIDE') ? 0xb04bff : c.includes('WELL') ? 0xffa040 : c.includes('SINGULARITY') ? 0x9b5cff : c.includes('VOID') ? 0x6080ff : 0xff4060;
      const css = c.includes('TIDE') ? 'rgb(176,75,255)' : c.includes('WELL') ? 'rgb(255,160,64)' : c.includes('VOID') ? 'rgb(96,128,255)' : 'rgb(255,64,96)';
      haptic.error(); rig.addTrauma(1); audio.death(); flash(css, 260); kick(1.5);
      particles.burst(comet.x, comet.y, 90, 0xffffff, 16, 1.2, 0.9); particles.burst(comet.x, comet.y, 120, col, 9, 1.8, 1.1); particles.burst(comet.x, comet.y, 40, skin.trail, 24, 0.6, 0.5);
      shock.spawn(comet.x, comet.y, { r: 14, dur: 0.9, color: 0xffffff }); shock.spawn(comet.x, comet.y, { r: 22, dur: 1.3, color: col, opacity: 0.7 }); shock.spawn(comet.x, comet.y, { r: 5, dur: 0.4, color: 0xffffff });
      tweens.add(0.9, (k) => { bloom.strength = Math.max(bloom.strength, 0.55 + (1 - k) * 1.6); });
      cometMesh.visible = false; S.timeScale = 0.08; S.hitstop = 0.5; endRun(false); break; }
    case 'win': haptic.success(); audio.perihelion(); rig.addTrauma(0.5); rig.punch(1.4); kick(0.9); flash('rgb(255,209,102)', 220);
      particles.burst(comet.x, comet.y, 80, 0xffd166, 14, 1.4, 0.9); particles.burst(comet.x, comet.y, 60, 0xffffff, 8, 1.8, 0.7);
      for (let i = 0; i < 4; i++) tweens.add(0.12 * i + 0.01, (k) => { if (k >= 1) shock.spawn(comet.x, comet.y, { r: 10 + i * 6, dur: 0.8 + i * 0.2, color: i % 2 ? 0xffffff : 0xffd166, opacity: 0.8 }); });
      pop('CLEAR', comet.x, comet.y, '#ffd166', true); comet.tether = null; S.timeScale = 0.25; S.hitstop = 0.6; endRun(true); break;
  }
}
renderer.setAnimationLoop(() => { timer.update(); const dt = Math.min(Math.max(timer.getDelta(), 0), 0.05); try { update(dt); composer.render(); window.__frames = (window.__frames || 0) + 1; } catch (e) { window.__err = String(e.stack || e); console.error(e); } });
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight); });
// boot: world behind the menu, menu on top
S.mode = 'endless'; S.seed = dailySeed(); comet.reset(); rig.snap(0, 4); ensureSectors(); trail.reset(0, 0); hud.top.style.opacity = 0;
cometMesh.visible = false;
menu.show('main');
Object.assign(window, { renderer, scene, camera, S, comet, input, T, audio, G, menu, startRun, LEVELS, cometMesh, rig });
