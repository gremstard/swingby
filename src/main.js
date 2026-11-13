import * as THREE from 'three';
import { T } from './tuning.js';
import { genSector, WorldView, halfWidthAt } from './world.js';
import { Comet } from './player.js';
import { Input } from './input.js';
import { CameraRig } from './camera.js';
import { dailySeed, randomSeed } from './rng.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Tweens, Particles, Trail, ease } from './feel.js';
import { Audio } from './audio.js';

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
composer.addPass(bloom); composer.addPass(new OutputPass());
const tweens = new Tweens(); const particles = new Particles(scene); const trail = new Trail(scene); const audio = new Audio();
const opts = { shake: localStorage.getItem('peri.shake') !== '0', flash: localStorage.getItem('peri.flash') !== '0' };

// stars (parallax layer far behind)
{
  const n = 900, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i*3] = (Math.random()-0.5)*160; pos[i*3+1] = (Math.random()-0.5)*160; pos[i*3+2] = -30 - Math.random()*40; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fb0ff, size: 0.18, transparent: true, opacity: 0.8 }));
  scene.add(stars); window.__stars = stars;
}

const world = new WorldView(scene);
const comet = new Comet();
const rig = new CameraRig(camera);
const input = new Input(canvas);

// comet mesh + tether + orbit preview
const cometMesh = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: 1.6, roughness: 0.2 }));
scene.add(cometMesh);
const tetherGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const tether = new THREE.Line(tetherGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 })); tether.visible = false; scene.add(tether);
const orbitRing = new THREE.Mesh(new THREE.RingGeometry(0.98, 1.0, 128), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); orbitRing.visible = false; scene.add(orbitRing);

// tide: a big plane whose top edge is the tide line, plus a bright edge
const tideMesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: 0x1a0a2e }));
const tideEdge = new THREE.Mesh(new THREE.PlaneGeometry(400, 0.3), new THREE.MeshBasicMaterial({ color: 0xd98bff }));
const tideGlow = new THREE.Mesh(new THREE.PlaneGeometry(400, 6), new THREE.MeshBasicMaterial({ color: 0x6a2bbf, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(tideMesh, tideEdge, tideGlow);

const hud = { h: document.querySelector('#h'), score: document.querySelector('#score'), combo: document.querySelector('#combo'), debug: document.querySelector('#debug'), card: document.querySelector('#card') };

const S = { seed: dailySeed(), sectors: new Map(), wells: [], tideY: -T.TIDE_START_GAP, tideV: T.TIDE_V0, maxY: 0, score: 0, timeScale: 1, hitstop: 0, running: false, elapsed: 0, dead: false, deadAt: 0,
  popScale: 1, combo: 1, comboT: 0, bestCombo: 1, sparks: 0, peris: 0, best: Number(localStorage.getItem('peri.best') || 0), bestH: Number(localStorage.getItem('peri.bestH') || 0) };
const popsEl = document.querySelector('#pops');
const _v = new THREE.Vector3();
function pop(text, x, y, color = '#fff') {
  _v.set(x, y, 0).project(camera);
  const el = document.createElement('div'); el.className = 'pop'; el.textContent = text; el.style.color = color;
  el.style.left = `${(_v.x * 0.5 + 0.5) * window.innerWidth}px`; el.style.top = `${(-_v.y * 0.5 + 0.5) * window.innerHeight}px`;
  popsEl.appendChild(el); setTimeout(() => el.remove(), 950);
}
function addCombo() { S.combo = Math.min(T.COMBO_MAX, S.combo + 1); S.comboT = T.COMBO_WINDOW; S.bestCombo = Math.max(S.bestCombo, S.combo); }

function ensureSectors() {
  const cur = Math.floor(comet.y / T.SECTOR_H);
  for (let i = Math.max(0, cur - 1); i <= cur + 2; i++) {
    if (!S.sectors.has(i)) { const prev = [...S.sectors.values()].flatMap(s => s.wells); const sec = genSector(S.seed, i, prev); S.sectors.set(i, sec); world.add(sec); }
  }
  for (const i of [...S.sectors.keys()]) if (i < cur - 1) { world.remove(i); S.sectors.delete(i); }
  const near = (o) => Math.abs(o.y - comet.y) < 40;
  const secs = [...S.sectors.values()];
  S.wells = secs.flatMap(s => s.wells).filter(near); S.sparks_ = secs.flatMap(s => s.sparks).filter(near);
  S.mines = secs.flatMap(s => s.mines).filter(near); S.sweepers = secs.flatMap(s => s.sweepers).filter(sw => near(sw.well)); S.holes = secs.flatMap(s => s.holes).filter(near);
}
function start(seed) {
  S.seed = seed; for (const i of [...S.sectors.keys()]) world.remove(i); S.sectors.clear();
  comet.reset(); Object.assign(S, { tideY: -T.TIDE_START_GAP, tideV: T.TIDE_V0, maxY: 0, score: 0, timeScale: 1, hitstop: 0, running: true, elapsed: 0, dead: false, combo: 1, comboT: 0, bestCombo: 1, sparks: 0, peris: 0 });
  rig.snap(0, 4); ensureSectors(); hud.card.classList.add('hidden'); trail.reset(0, 0); cometMesh.scale.setScalar(1); audio.restart();
}
function die() {
  S.dead = true; S.deadAt = S.elapsed; S.running = false;
  const newBest = S.score > S.best; if (newBest) { S.best = S.score; localStorage.setItem('peri.best', S.best); }
  if (S.maxY > S.bestH) { S.bestH = Math.floor(S.maxY); localStorage.setItem('peri.bestH', S.bestH); }
  hud.card.innerHTML = `<h1>PERIHELION</h1><div class="cause">${comet.cause}</div>
  <div class="row"><div><div class="k">HEIGHT</div><div class="v">${Math.floor(S.maxY)}</div></div><div><div class="k">SCORE</div><div class="v">${S.score}</div></div><div><div class="k">SPARKS</div><div class="v">${S.sparks}</div></div><div><div class="k">BEST COMBO</div><div class="v">×${S.bestCombo}</div></div><div><div class="k">PERIHELIA</div><div class="v">${S.peris}</div></div></div>
  <div class="sub">${newBest ? 'NEW BEST' : 'BEST ' + S.best}</div>
  <div class="hint">seed <b>${S.seed}</b><br><kbd>R</kbd> retry seed &nbsp; <kbd>N</kbd> new seed</div>`;
  hud.card.classList.remove('hidden');
}
input.onKey = (code) => {
  if (code === 'KeyR') { S.title = false; start(S.seed); } if (code === 'KeyN') { S.title = false; start(randomSeed()); }
  if (code === 'KeyM') audio.toggleMute();
  if (code === 'KeyS') { opts.shake = !opts.shake; localStorage.setItem('peri.shake', opts.shake ? '1' : '0'); rig.strength = opts.shake ? 0.8 : 0; }
  if (code === 'KeyF') { opts.flash = !opts.flash; localStorage.setItem('peri.flash', opts.flash ? '1' : '0'); }
};
rig.strength = opts.shake ? 0.8 : 0;
window.addEventListener('pointerdown', () => audio.unlock(), { once: false }); window.addEventListener('keydown', () => audio.unlock());
function flash() { if (!opts.flash) return; const el = document.createElement('div'); el.className = 'flash'; document.body.appendChild(el); setTimeout(() => el.remove(), 200); }

const timer = new THREE.Timer(); timer.connect(document);
const events = [];
function update(realDt) {
  if (S.hitstop > 0) { S.hitstop -= realDt; if (S.hitstop <= 0) S.timeScale = 1; }
  const dt = realDt * S.timeScale;
  const inp = input.consume();
  if (S.title && inp.pressed) { S.title = false; start(S.seed); input.held = false; }
  if (S.dead && (inp.pressed) && S.elapsed - S.deadAt > 0.6) start(S.seed);
  S.elapsed += realDt;
  if (S.running) {
    comet.wantTether = inp.held;
    if (inp.pressed && !comet.tether) { const w = comet.nearestReachable(S.wells); if (w) { comet.latch(w); events.push({ type: 'latch', well: w }); } }
    if (inp.released && comet.tether) { const r = comet.release(); events.push({ type: 'release', ...r }); }
    comet.step(dt, S.wells, events, S.holes);
    // combo decays one step per window, never resets: forgiving but tense
    if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0 && S.combo > 1) { S.combo--; S.comboT = T.COMBO_WINDOW * 0.6; } }
    // sparks
    for (const sp of S.sparks_) {
      if (sp.got) continue;
      if (Math.hypot(sp.x - comet.x, sp.y - comet.y) < 1.0) { sp.got = true; sp.mesh.visible = false; addCombo(); const pts = T.SPARK_SCORE * S.combo; S.score += pts; S.sparks++; events.push({ type: 'spark', x: sp.x, y: sp.y, pts }); }
      else { sp.mesh.rotation.y += dt * 2; sp.mesh.position.z = Math.sin(S.elapsed * 3 + sp.phase) * 0.15; }
    }
    // hazards
    if (comet.alive) {
      for (const m of S.mines) { m.mesh.rotation.x += dt * 0.7; m.mesh.rotation.y += dt; if (Math.hypot(m.x - comet.x, m.y - comet.y) < m.r + 0.4) { comet.die('STRUCK A MINE'); events.push({ type: 'death' }); break; } }
      for (const sw of S.sweepers) {
        sw.a += sw.w * dt; sw.mesh.rotation.z = sw.a;
        const ax = sw.well.x + Math.cos(sw.a) * sw.well.r, ay = sw.well.y + Math.sin(sw.a) * sw.well.r, bx = sw.well.x + Math.cos(sw.a) * (sw.well.r + sw.len), by = sw.well.y + Math.sin(sw.a) * (sw.well.r + sw.len);
        const px = comet.x - ax, py = comet.y - ay, dx = bx - ax, dy = by - ay; const t = Math.max(0, Math.min(1, (px*dx + py*dy) / (dx*dx + dy*dy))); const d = Math.hypot(px - dx*t, py - dy*t);
        if (comet.alive && d < sw.thick / 2 + 0.4) { comet.die('CUT DOWN BY A SWEEPER'); events.push({ type: 'death' }); }
      }
      for (const h of S.holes) { h.ring.rotation.z += dt * 2; h.ring.scale.setScalar(h.r * (1.4 + 0.3 * Math.sin(S.elapsed * 4))); if (comet.alive && Math.hypot(h.x - comet.x, h.y - comet.y) < h.r + 0.3) { comet.die('CRUSHED BY A SINGULARITY'); events.push({ type: 'death' }); } }
    }
    // bounds + tide
    const idx = Math.floor(comet.y / T.SECTOR_H); const hw = halfWidthAt(Math.max(0, idx));
    if (comet.alive && Math.abs(comet.x) > hw) { comet.die('LOST TO THE VOID'); events.push({ type: 'death' }); }
    S.tideV = T.TIDE_V0 + Math.max(0, idx) * T.TIDE_V_PER_SECTOR;
    const gap = comet.y - S.tideY; const rubber = gap > T.TIDE_MAX_GAP ? (gap - T.TIDE_MAX_GAP) * 0.8 : 0;
    S.tideY += (S.tideV + rubber) * dt;
    if (comet.alive && comet.y < S.tideY) { comet.die('SWALLOWED BY THE TIDE'); events.push({ type: 'death' }); }
    if (comet.y > S.maxY) { const a = Math.floor(S.maxY), b = Math.floor(comet.y); S.score += (b - a) * T.HEIGHT_SCORE; S.maxY = comet.y; }
    ensureSectors();
  }
  for (const e of events) handle(e); events.length = 0;
  rig.update(realDt, comet); tweens.update(realDt); particles.update(realDt);
  const speedK = Math.max(0, Math.min(1, (comet.speed - T.CRUISE) / (T.MAX_SPEED - T.CRUISE)));
  audio.update(speedK, !!comet.tether, S.running ? Math.max(0, 1 - (comet.y - S.tideY) / 12) : 0);
  // views
  cometMesh.position.set(comet.x, comet.y, 0);
  if (comet.alive) { trail.push(comet.x, comet.y, speedK); cometMesh.visible = true; }
  // stretch along velocity with speed (visual only)
  cometMesh.rotation.z = Math.atan2(comet.vy, comet.vx);
  const stretch = 1 + speedK * 0.9; cometMesh.scale.set(stretch * S.popScale, (1 / Math.sqrt(stretch)) * S.popScale, S.popScale);
  cometMesh.material.emissiveIntensity = 1.4 + speedK * 1.6;
  if (comet.tether) {
    const w = comet.tether.well; tether.visible = true; orbitRing.visible = true;
    tetherGeo.attributes.position.setXYZ(0, comet.x, comet.y, 0); tetherGeo.attributes.position.setXYZ(1, w.x, w.y, 0); tetherGeo.attributes.position.needsUpdate = true;
    orbitRing.position.set(w.x, w.y, 0.02); orbitRing.scale.setScalar(comet.tether.R);
  } else { tether.visible = false; orbitRing.visible = false; }
  tideMesh.position.set(camera.position.x, S.tideY - 200, -0.1); tideEdge.position.set(camera.position.x, S.tideY, 0.1); tideGlow.position.set(camera.position.x, S.tideY - 3, 0.05); tideGlow.material.opacity = 0.3 + 0.12 * Math.sin(S.elapsed * 5);
  window.__stars.position.set(camera.position.x * 0.8, camera.position.y * 0.8, 0);
  hud.h.textContent = Math.floor(S.maxY); hud.score.textContent = S.score; hud.combo.textContent = `×${S.combo}`; hud.combo.classList.toggle('hot', S.combo >= 3);
  hud.debug.textContent = `speed ${comet.speed.toFixed(1)}  tide gap ${(comet.y - S.tideY).toFixed(1)}  tether ${comet.tether ? (comet.tether.R / comet.tether.well.r).toFixed(2) + 'R' : '-'}  wells ${S.wells.length}  ts ${S.timeScale.toFixed(2)}  seed ${S.seed}`;
}
function handle(e) {
  switch (e.type) {
    case 'latch': rig.addTrauma(0.12); audio.latch(); tweens.add(0.22, (k) => { S.popScale = 1 + (1 - k) * 0.35; }, ease.outBack, 'pop'); particles.burst(comet.x, comet.y, 4, e.well.mesh.material.color, 3, 0.35, 0.35); break;
    case 'release':
      audio.release(Math.max(0, (comet.speed - T.CRUISE) / (T.MAX_SPEED - T.CRUISE)));
      tweens.add(0.3, (k) => { S.popScale = 1 + (1 - k) * 0.25; }, ease.outBack, 'pop');
      if (e.ratio < T.PERI_RATIO) { audio.perihelion(); particles.burst(comet.x, comet.y, 16, 0x8fd3ff, 9, 0.7, 0.6); addCombo(); const pts = T.PERI_SCORE * S.combo; S.score += pts; S.peris++; rig.addTrauma(0.35); rig.punch(1); S.timeScale = 0.05; S.hitstop = Math.max(S.hitstop, T.HITSTOP_PERI); pop(`PERIHELION +${pts}`, comet.x, comet.y, '#8fd3ff'); }
      break;
    case 'spark': rig.addTrauma(0.18); audio.spark(S.combo); particles.burst(e.x, e.y, 10, 0xffd166, 7, 0.55, 0.55); tweens.add(0.25, (k) => { S.popScale = 1 + (1 - k) * 0.4; }, ease.outBack, 'pop'); pop(`+${e.pts}`, e.x, e.y, '#ffd166');
      hud.combo.animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' }); break;
    case 'near': rig.addTrauma(0.3); audio.near(); S.timeScale = 0.3; S.hitstop = Math.max(S.hitstop, T.SLOWMO_NEAR); particles.burst(comet.x, comet.y, 6, e.well.mesh.material.color, 4, 0.4, 0.4); break;
    case 'death': rig.addTrauma(0.9); audio.death(); flash(); particles.burst(comet.x, comet.y, 40, 0xffe0c0, 12, 1.1, 0.8); particles.burst(comet.x, comet.y, 20, 0xff6a4a, 6, 1.4, 1.0); cometMesh.visible = false; S.timeScale = 0.02; S.hitstop = T.HITSTOP_DEATH; die(); break;
  }
}
renderer.setAnimationLoop(() => { timer.update(); const dt = Math.min(Math.max(timer.getDelta(), 0), 0.05); update(dt); composer.render(); });
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight); });
function title() {
  S.running = false; S.dead = false; S.title = true;
  hud.card.innerHTML = `<h1>PERIHELION</h1><div class="sub">HOLD TO ORBIT &nbsp;·&nbsp; RELEASE TO FLY</div>
  <div class="hint">The tighter the orbit, the faster you go.<br>Touch a well and you burn. Fall behind the Tide and you drown.<br><br>
  <kbd>SPACE</kbd> / <kbd>CLICK</kbd> / <kbd>TOUCH</kbd> &nbsp; hold to tether<br>
  <kbd>R</kbd> retry seed &nbsp; <kbd>N</kbd> new seed &nbsp; <kbd>M</kbd> mute &nbsp; <kbd>S</kbd> shake &nbsp; <kbd>F</kbd> flash<br><br>
  <span style="opacity:.6">daily seed ${S.seed}${S.best ? ' · best ' + S.best : ''}</span></div>`;
  hud.card.classList.remove('hidden');
}
hud.debug.style.display = 'none';
const _onKey = input.onKey; input.onKey = (code) => { if (code === 'KeyD') hud.debug.style.display = hud.debug.style.display === 'none' ? '' : 'none'; _onKey(code); };
// pre-generate so the title shows the world behind it
for (const i of [...S.sectors.keys()]) world.remove(i); S.sectors.clear(); comet.reset(); rig.snap(0, 4); ensureSectors(); trail.reset(0, 0);
title();
Object.assign(window, { renderer, scene, camera, S, comet, start, input, T, halfWidthAt, audio, opts });
