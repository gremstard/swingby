import * as THREE from 'three';
import { T } from './tuning.js';
import { genSector, WorldView, halfWidthAt } from './world.js';
import { Comet } from './player.js';
import { Input } from './input.js';
import { CameraRig } from './camera.js';
import { dailySeed, randomSeed } from './rng.js';

const canvas = document.querySelector('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060c);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
scene.add(new THREE.AmbientLight(0x8090ff, 0.35));
const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(4, 6, 10); scene.add(key);

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
const tideEdge = new THREE.Mesh(new THREE.PlaneGeometry(400, 0.35), new THREE.MeshBasicMaterial({ color: 0xb04bff }));
scene.add(tideMesh, tideEdge);

const hud = { h: document.querySelector('#h'), score: document.querySelector('#score'), combo: document.querySelector('#combo'), debug: document.querySelector('#debug'), card: document.querySelector('#card') };

const S = { seed: dailySeed(), sectors: new Map(), wells: [], tideY: -T.TIDE_START_GAP, tideV: T.TIDE_V0, maxY: 0, score: 0, timeScale: 1, hitstop: 0, running: false, elapsed: 0, dead: false, deadAt: 0 };

function ensureSectors() {
  const cur = Math.floor(comet.y / T.SECTOR_H);
  for (let i = Math.max(0, cur - 1); i <= cur + 2; i++) {
    if (!S.sectors.has(i)) { const prev = [...S.sectors.values()].flatMap(s => s.wells); const sec = genSector(S.seed, i, prev); S.sectors.set(i, sec); world.add(sec); }
  }
  for (const i of [...S.sectors.keys()]) if (i < cur - 1) { world.remove(i); S.sectors.delete(i); }
  S.wells = [...S.sectors.values()].flatMap(s => s.wells).filter(w => Math.abs(w.y - comet.y) < 40);
}
function start(seed) {
  S.seed = seed; for (const i of [...S.sectors.keys()]) world.remove(i); S.sectors.clear();
  comet.reset(); Object.assign(S, { tideY: -T.TIDE_START_GAP, tideV: T.TIDE_V0, maxY: 0, score: 0, timeScale: 1, hitstop: 0, running: true, elapsed: 0, dead: false });
  rig.snap(0, 4); ensureSectors(); hud.card.classList.add('hidden');
}
function die() {
  S.dead = true; S.deadAt = S.elapsed; S.running = false;
  hud.card.innerHTML = `<h1>PERIHELION</h1><div class="cause">${comet.cause}</div>
  <div class="row"><div><div class="k">HEIGHT</div><div class="v">${Math.floor(S.maxY)}</div></div><div><div class="k">SCORE</div><div class="v">${S.score}</div></div></div>
  <div class="hint">seed <b>${S.seed}</b><br><kbd>R</kbd> retry seed &nbsp; <kbd>N</kbd> new seed</div>`;
  hud.card.classList.remove('hidden');
}
input.onKey = (code) => { if (code === 'KeyR') start(S.seed); if (code === 'KeyN') start(randomSeed()); };

const timer = new THREE.Timer(); timer.connect(document);
const events = [];
function update(realDt) {
  if (S.hitstop > 0) { S.hitstop -= realDt; if (S.hitstop <= 0) S.timeScale = 1; }
  const dt = realDt * S.timeScale;
  const inp = input.consume();
  if (S.dead && (inp.pressed) && S.elapsed - S.deadAt > 0.6) start(S.seed);
  S.elapsed += realDt;
  if (S.running) {
    comet.wantTether = inp.held;
    if (inp.pressed && !comet.tether) { const w = comet.nearestReachable(S.wells); if (w) { comet.latch(w); events.push({ type: 'latch', well: w }); } }
    if (inp.released && comet.tether) { const r = comet.release(); events.push({ type: 'release', ...r }); }
    comet.step(dt, S.wells, events);
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
  rig.update(realDt, comet);
  // views
  cometMesh.position.set(comet.x, comet.y, 0);
  if (comet.tether) {
    const w = comet.tether.well; tether.visible = true; orbitRing.visible = true;
    tetherGeo.attributes.position.setXYZ(0, comet.x, comet.y, 0); tetherGeo.attributes.position.setXYZ(1, w.x, w.y, 0); tetherGeo.attributes.position.needsUpdate = true;
    orbitRing.position.set(w.x, w.y, 0.02); orbitRing.scale.setScalar(comet.tether.R);
  } else { tether.visible = false; orbitRing.visible = false; }
  tideMesh.position.set(camera.position.x, S.tideY - 200, -0.1); tideEdge.position.set(camera.position.x, S.tideY, 0.1);
  window.__stars.position.set(camera.position.x * 0.8, camera.position.y * 0.8, 0);
  hud.h.textContent = Math.floor(S.maxY); hud.score.textContent = S.score;
  hud.debug.textContent = `speed ${comet.speed.toFixed(1)}  tide gap ${(comet.y - S.tideY).toFixed(1)}  tether ${comet.tether ? (comet.tether.R / comet.tether.well.r).toFixed(2) + 'R' : '-'}  wells ${S.wells.length}  ts ${S.timeScale.toFixed(2)}  seed ${S.seed}`;
}
function handle(e) {
  switch (e.type) {
    case 'latch': rig.addTrauma(0.12); break;
    case 'release': break;
    case 'near': rig.addTrauma(0.3); S.timeScale = 0.3; S.hitstop = Math.max(S.hitstop, T.SLOWMO_NEAR); break;
    case 'death': rig.addTrauma(0.9); S.timeScale = 0.02; S.hitstop = T.HITSTOP_DEATH; die(); break;
  }
}
renderer.setAnimationLoop(() => { timer.update(); const dt = Math.min(Math.max(timer.getDelta(), 0), 0.05); update(dt); renderer.render(scene, camera); });
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
start(S.seed);
Object.assign(window, { renderer, scene, camera, S, comet, start, input, T });
