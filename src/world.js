import * as THREE from 'three';
import { T } from './tuning.js';
import { makeRng, subSeed } from './rng.js';

// Pure data generation: deterministic per (runSeed, sectorIndex).
export function genSector(runSeed, idx, prevWells, P) {
  const rng = makeRng(subSeed(runSeed, 'sector', idx));
  const y0 = idx * T.SECTOR_H, y1 = y0 + T.SECTOR_H;
  const halfW = P.halfW;
  const wells = [];
  if (P.empty) return { idx, y0, y1, halfW, wells, mines: [], sweepers: [], holes: [], sparks: [], spikes: [], portals: [], boss: null };
  if (P.boss) return genBoss(rng, idx, y0, y1, halfW, P);
  const n = P.wells;
  const all = [...prevWells];
  let tries = 0;
  while (wells.length < n && tries++ < 400) {
    const r = rng.range(T.WELL_R_MIN, T.WELL_R_MAX);
    const x = rng.range(-halfW + r + 1.2, halfW - r - 1.2);
    const y = rng.range(y0 + P.startPad, y1 - 2);
    let ok = true;
    for (const w of all) {
      const d = Math.hypot(w.x - x, w.y - y);
      if (d < w.r + r + T.WELL_GAP) { ok = false; break; }
    }
    if (!ok) continue;
    const w = { x, y, r, hue: P.hue == null ? rng.range(0.52, 0.72) : (P.hue + rng.range(-0.06, 0.06) + 1) % 1, spin: rng.range(-1, 1), x0: x, y0: y };
    if (P.moving > 0 && rng.chance(P.moving)) { const amp = Math.min(rng.range(1.5, 4), halfW - r - 1.2 - Math.abs(x)); if (amp > 0.8) w.motion = { ax: amp, ay: rng.chance(0.3) ? rng.range(0.5, 1.5) : 0, w: rng.range(0.4, 0.9), ph: rng.range(0, 6.28) }; }
    wells.push(w); all.push(w);
  }
  // hazards
  const mines = [], sweepers = [], holes = [];
  const nm = P.mines;
  tries = 0;
  while (mines.length < nm && tries++ < 300) {
    const x = rng.range(-halfW + 1, halfW - 1), y = rng.range(y0 + P.startPad + 6, y1 - 1);
    const clear = P.hazardClear === false ? 3.2 : T.REACH + 1.0;
    if (all.some(w => Math.hypot(w.x - x, w.y - y) < w.r + clear) || mines.some(m => Math.hypot(m.x - x, m.y - y) < 3)) continue;
    mines.push({ x, y, r: 0.55 });
  }
  for (const w of wells) if (P.sweeperP > 0 && rng.chance(P.sweeperP)) sweepers.push({ well: w, len: w.r * 1.3, w: rng.pick([-1, 1]) * rng.range(0.7, 1.2), a: rng.range(0, 6.28), thick: 0.28 });
  if (P.holeP > 0 && rng.chance(P.holeP)) {
    tries = 0;
    while (holes.length < 1 && tries++ < 200) {
      const x = rng.range(-halfW + 3, halfW - 3), y = rng.range(y0 + 4, y1 - 4);
      if (all.some(w => Math.hypot(w.x - x, w.y - y) < w.r + 7)) continue;
      holes.push({ x, y, r: 0.9, pull: 70 });
    }
  }
  // sparks: ~40% hug a well's perihelion band (invites tight orbits), the rest sit in open lanes
  const sparks = []; tries = 0;
  while (sparks.length < P.sparks && tries++ < 500) {
    let x, y;
    const mode = rng.next();
    if (wells.length && mode < 0.55) {
      // tangent exit lane: where a release from a comfortable orbit actually sends you (upward-ish)
      const w = rng.pick(wells); const R = w.r * rng.range(1.4, 2.2); const a = rng.range(0, 6.28); const dir = rng.chance(0.5) ? 1 : -1;
      const tx = -Math.sin(a) * dir, ty = Math.cos(a) * dir; if (ty < 0.15) continue;
      const d = rng.range(2.5, 7);
      x = w.x + Math.cos(a) * R + tx * d; y = w.y + Math.sin(a) * R + ty * d;
    } else if (wells.length && mode < 0.7) { const w = rng.pick(wells); const a = rng.range(0, 6.28), rr = w.r * rng.range(1.15, 1.32); x = w.x + Math.cos(a) * rr; y = w.y + Math.sin(a) * rr; }
    else { x = rng.range(-halfW + 1, halfW - 1); y = rng.range(y0 + P.startPad - 6, y1 - 1); }
    if (Math.abs(x) > halfW - 0.8) continue;
    if (all.some(w => Math.hypot(w.x - x, w.y - y) < w.r + 0.9)) continue;
    if (mines.some(m => Math.hypot(m.x - x, m.y - y) < 1.6) || holes.some(h => Math.hypot(h.x - x, h.y - y) < 3)) continue;
    if (sparks.some(s => Math.hypot(s.x - x, s.y - y) < 1.4)) continue;
    sparks.push({ x, y, got: false, phase: rng.range(0, 6.28) });
  }
  // spikes: a row of spikes across the corridor with one gap, the gap always reachable (>= 5 wide)
  const spikes = [];
  for (let k = 0; k < (P.spikes || 0); k++) {
    const y = y0 + P.startPad + 8 + (k + 0.5) * ((T.SECTOR_H - P.startPad - 10) / P.spikes) + rng.range(-3, 3);
    if (all.some(w => Math.abs(w.y - y) < w.r + 1.6 && !sparks.length)) continue;
    const gapW = rng.range(5.5, 8), gapX = rng.range(-halfW + gapW / 2 + 1, halfW - gapW / 2 - 1);
    spikes.push({ y, gapX, gapW, halfW });
    for (const w of all) if (Math.abs(w.y - y) < w.r + 1.2) { spikes.pop(); break; }
  }
  // portals: entrance low, exit higher, velocity preserved
  const portals = [];
  for (let k = 0; k < (P.portals || 0); k++) {
    let a, b, tries2 = 0;
    while (tries2++ < 60) {
      a = { x: rng.range(-halfW + 2, halfW - 2), y: rng.range(y0 + P.startPad + 2, y0 + T.SECTOR_H * 0.45) };
      b = { x: rng.range(-halfW + 2, halfW - 2), y: rng.range(y0 + T.SECTOR_H * 0.55, y1 - 3) };
      const clear = (q) => !all.some(w => Math.hypot(w.x - q.x, w.y - q.y) < w.r + 2.2) && !mines.some(m => Math.hypot(m.x - q.x, m.y - q.y) < 2.5);
      if (clear(a) && clear(b)) { portals.push({ a, b, r: 1.1, hue: rng.range(0, 1) }); break; }
    }
  }
  return { idx, y0, y1, halfW, wells, mines, sweepers, holes, sparks, spikes, portals, boss: null };
}

// Boss arena: one giant well mid-sector, armed with sweepers, that sheds mine rings. Collect its orbiting
// cores to break it. Deterministic like everything else.
function genBoss(rng, idx, y0, y1, halfW, P) {
  const cy = y0 + T.SECTOR_H * 0.5, r = 3.4;
  const coresTotal = 2 + (P.tier || 2);
  const boss = { x: 0, y: cy, r, hue: P.hue, x0: 0, y0: cy, boss: true, hp: 0, cores: [], phase: 0, t: 0, coresTotal, killR: r * 1.75 };
  // arms reach killR; cores orbit just outside it and inside tether reach (r + REACH), so an orbit at
  // the right radius threads between the arms and the cores. Closer than killR = death, and it's drawn.
  const sweepers = []; const n = 2 + Math.min(2, Math.floor((P.tier || 2) / 2));
  for (let i = 0; i < n; i++) sweepers.push({ well: boss, len: boss.killR - r, w: (i % 2 ? -1 : 1) * rng.range(0.35, 0.55), a: i * (6.28 / n), thick: 0.32 });
  for (let i = 0; i < coresTotal; i++) boss.cores.push({ a: i * (6.28 / coresTotal), R: rng.range(boss.killR + 1.3, r + T.REACH - 0.6), spd: rng.range(0.2, 0.35) * (i % 2 ? -1 : 1), got: false, x: 0, y: 0, phase: rng.range(0, 6.28) });
  // helper wells well outside the arms (and outside any orbit that could swing into them)
  const wells = [boss]; const safe = boss.killR + T.REACH + 2.5;
  for (const [hx, hy] of [[-halfW + 2.4, cy - safe * 0.85], [halfW - 2.4, cy - safe * 0.85], [-halfW + 2.4, cy + safe * 0.9], [halfW - 2.4, cy + safe * 0.9]]) wells.push({ x: hx, y: hy, r: 1.1, hue: P.hue, x0: hx, y0: hy, spin: 0 });
  const sparks = []; for (let i = 0; i < 6; i++) { const a = rng.range(0, 6.28), d = rng.range(boss.killR + 4, boss.killR + 8); sparks.push({ x: Math.max(-halfW + 1, Math.min(halfW - 1, Math.cos(a) * d)), y: cy + Math.sin(a) * d, got: false, phase: rng.range(0, 6.28) }); }
  return { idx, y0, y1, halfW, wells, mines: [], sweepers, holes: [], sparks, spikes: [], portals: [], boss };
}
export function halfWidthAt(idx) {
  return Math.max(T.HALF_W_MIN, T.HALF_W0 - idx * T.HALF_W_SHRINK);
}

// Scene-side: builds meshes for a sector, disposes them when it scrolls off.
export class WorldView {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.sectors = new Map();
    this.wellGeo = new THREE.SphereGeometry(1, 36, 24);
    this.ringGeo = new THREE.RingGeometry(0.985, 1.0, 96);
    this.wallMat = new THREE.MeshBasicMaterial({ color: 0x3a2a66, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    this.sparkGeo = new THREE.OctahedronGeometry(0.32, 0);
    this.sparkMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb000, emissiveIntensity: 1.2, roughness: 0.3 });
    this.mineGeo = new THREE.IcosahedronGeometry(0.55, 0);
    this.mineMat = new THREE.MeshStandardMaterial({ color: 0xff4060, emissive: 0xff2040, emissiveIntensity: 1.2, flatShading: true });
    this.holeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.holeRingMat = new THREE.MeshBasicMaterial({ color: 0xb04bff, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    this.spikeGeo = new THREE.ConeGeometry(0.32, 0.9, 4); this.spikeMat = new THREE.MeshStandardMaterial({ color: 0xff6a4a, emissive: 0xff3020, emissiveIntensity: 0.9, flatShading: true });
    this.coreGeo = new THREE.OctahedronGeometry(0.45, 0); this.coreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff5ab0, emissiveIntensity: 2.2 });
    this.dynamic = []; // objects that move every frame
  }
  add(sector) {
    const g = new THREE.Group();
    for (const w of sector.wells) {
      const col = new THREE.Color().setHSL(w.hue, 0.75, 0.6);
      const m = new THREE.Mesh(this.wellGeo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.28, roughness: 0.5 }));
      m.position.set(w.x, w.y, 0); m.scale.setScalar(w.r); g.add(m);
      const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
      ring.position.set(w.x, w.y, -0.05); ring.scale.setScalar(w.r * T.PERI_RATIO); g.add(ring);
      const reach = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.07, side: THREE.DoubleSide }));
      reach.position.set(w.x, w.y, -0.06); reach.scale.setScalar(w.r + T.REACH); g.add(reach);
      w.mesh = m; w.rings = [ring, reach];
      if (w.motion) this.dynamic.push(w);
      if (w.boss) { m.material.emissiveIntensity = 0.5; const halo = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xff5ab0, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); halo.position.set(w.x, w.y, -0.04); halo.scale.setScalar(w.r * 1.1); g.add(halo); w.halo = halo;
        for (const c of w.cores) { const cm = new THREE.Mesh(this.coreGeo, this.coreMat); g.add(cm); c.mesh = cm; } }
    }
    for (const sp of sector.spikes) {
      const row = new THREE.Group(); row.position.set(0, sp.y, 0);
      for (let x = -sp.halfW + 0.4; x < sp.halfW; x += 0.8) { if (Math.abs(x - sp.gapX) < sp.gapW / 2) continue; const m = new THREE.Mesh(this.spikeGeo, this.spikeMat); m.position.set(x, 0, 0); m.rotation.z = (x < sp.gapX ? 1 : -1) * 0; g.add(row); row.add(m); }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(sp.halfW * 2, 0.18, 0.3), this.spikeMat); row.add(bar); g.add(row); sp.mesh = row;
    }
    for (const pt of sector.portals) {
      const col = new THREE.Color().setHSL(pt.hue, 0.9, 0.6);
      for (const end of [pt.a, pt.b]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(pt.r, 0.14, 10, 40), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.6 })); ring.position.set(end.x, end.y, 0); g.add(ring); end.mesh = ring; end.col = col;
        const disc = new THREE.Mesh(new THREE.CircleGeometry(pt.r * 0.9, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })); disc.position.set(end.x, end.y, -0.05); g.add(disc); end.disc = disc; }
      pt.mesh = pt.a.mesh;
    }
    for (const sp of sector.sparks) { const m = new THREE.Mesh(this.sparkGeo, this.sparkMat); m.position.set(sp.x, sp.y, 0); g.add(m); sp.mesh = m; }
    for (const mn of sector.mines) { const m = new THREE.Mesh(this.mineGeo, this.mineMat); m.position.set(mn.x, mn.y, 0); g.add(m); mn.mesh = m; }
    const dangerDone = new Set();
    for (const sw of sector.sweepers) {
      if (!dangerDone.has(sw.well)) { dangerDone.add(sw.well); const kr = sw.well.r + sw.len + 0.5; const dz = new THREE.Mesh(new THREE.RingGeometry(0.94, 1.0, 96), new THREE.MeshBasicMaterial({ color: 0xff4060, transparent: true, opacity: 0.45, side: THREE.DoubleSide })); dz.position.set(sw.well.x, sw.well.y, -0.03); dz.scale.setScalar(kr); g.add(dz); (sw.well.rings ||= []).push(dz);
        const fill = new THREE.Mesh(new THREE.CircleGeometry(kr, 64), new THREE.MeshBasicMaterial({ color: 0xff4060, transparent: true, opacity: 0.06, depthWrite: false })); fill.position.set(sw.well.x, sw.well.y, -0.07); g.add(fill); sw.well.rings.push(fill); }
      const m = new THREE.Mesh(new THREE.BoxGeometry(sw.len, sw.thick, 0.3), new THREE.MeshStandardMaterial({ color: 0xff4060, emissive: 0xff2040, emissiveIntensity: 1.1 }));
      m.position.set(sw.well.x, sw.well.y, 0.15); g.add(m); sw.mesh = m;
      // offset so the arm extends outward from the well's surface
      m.geometry.translate(sw.well.r + sw.len / 2, 0, 0);
    }
    for (const h of sector.holes) {
      const m = new THREE.Mesh(this.wellGeo, this.holeMat); m.position.set(h.x, h.y, 0.2); m.scale.setScalar(h.r); g.add(m);
      const ring = new THREE.Mesh(this.ringGeo, this.holeRingMat); ring.position.set(h.x, h.y, 0.1); ring.scale.setScalar(h.r * 1.6); g.add(ring); h.ring = ring;
      const ring2 = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xb04bff, transparent: true, opacity: 0.12, side: THREE.DoubleSide })); ring2.position.set(h.x, h.y, -0.06); ring2.scale.setScalar(6); g.add(ring2);
    }
    // void walls
    if (sector.halfW >= 50) { this.group.add(g); this.sectors.set(sector.idx, g); return; } // wrap levels: no walls
    const extra = sector.idx === 0 ? 80 : 0; // first sector's walls also cover the space below the start
    const wallGeo = new THREE.PlaneGeometry(40, T.SECTOR_H + extra);
    const l = new THREE.Mesh(wallGeo, this.wallMat); l.position.set(-sector.halfW - 20, sector.y0 - extra / 2 + T.SECTOR_H / 2, -0.2); g.add(l);
    const r = new THREE.Mesh(wallGeo, this.wallMat); r.position.set(sector.halfW + 20, sector.y0 - extra / 2 + T.SECTOR_H / 2, -0.2); g.add(r);
    g.userData.sector = sector; this.group.add(g);
    this.sectors.set(sector.idx, g);
  }
  // Moving wells, boss cores, portal spin. Called every gameplay frame with scaled dt.
  update(dt, t) {
    for (const w of this.dynamic) {
      if (!w.motion) continue; const m = w.motion; w.x = w.x0 + Math.sin(t * m.w + m.ph) * m.ax; w.y = w.y0 + Math.sin(t * m.w * 0.7 + m.ph) * m.ay;
      w.mesh.position.set(w.x, w.y, 0); for (const r of w.rings) r.position.set(w.x, w.y, r.position.z);
    }
  }
  remove(idx) {
    const g = this.sectors.get(idx); if (!g) return;
    const sec = g.userData.sector; if (sec) this.dynamic = this.dynamic.filter(w => !sec.wells.includes(w));
    const shared = new Set([this.wellGeo, this.ringGeo, this.sparkGeo, this.mineGeo, this.sparkMat, this.mineMat, this.wallMat, this.holeMat, this.holeRingMat, this.spikeGeo, this.spikeMat, this.coreGeo, this.coreMat]);
    g.traverse((o) => { if (!o.isMesh) return; if (!shared.has(o.geometry)) o.geometry.dispose(); if (!shared.has(o.material)) o.material.dispose(); });
    this.group.remove(g); this.sectors.delete(idx);
  }
}
