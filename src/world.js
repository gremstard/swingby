import * as THREE from 'three';
import { T } from './tuning.js';
import { makeRng, subSeed } from './rng.js';

// Pure data generation: deterministic per (runSeed, sectorIndex).
export function genSector(runSeed, idx, prevWells) {
  const rng = makeRng(subSeed(runSeed, 'sector', idx));
  const y0 = idx * T.SECTOR_H, y1 = y0 + T.SECTOR_H;
  const halfW = halfWidthAt(idx);
  const wells = [];
  const n = Math.min(T.WELLS_PER_SECTOR_MAX, T.WELLS_PER_SECTOR0 + Math.floor(idx * 0.6));
  const all = [...prevWells];
  let tries = 0;
  while (wells.length < n && tries++ < 400) {
    const r = rng.range(T.WELL_R_MIN, T.WELL_R_MAX);
    const x = rng.range(-halfW + r + 1.2, halfW - r - 1.2);
    const y = rng.range(y0 + (idx === 0 ? 14 : 2), y1 - 2);
    let ok = true;
    for (const w of all) {
      const d = Math.hypot(w.x - x, w.y - y);
      if (d < w.r + r + T.WELL_GAP) { ok = false; break; }
    }
    if (!ok) continue;
    const w = { x, y, r, hue: rng.range(0.52, 0.72), spin: rng.range(-1, 1) };
    wells.push(w); all.push(w);
  }
  // hazards
  const mines = [], sweepers = [], holes = [];
  const nm = Math.min(T.MINES_MAX, T.MINES_PER_SECTOR0 + Math.floor(idx * 0.7));
  tries = 0;
  while (mines.length < nm && tries++ < 300) {
    const x = rng.range(-halfW + 1, halfW - 1), y = rng.range(y0 + (idx === 0 ? 20 : 3), y1 - 1);
    if (all.some(w => Math.hypot(w.x - x, w.y - y) < w.r + 2.2) || mines.some(m => Math.hypot(m.x - x, m.y - y) < 3)) continue;
    mines.push({ x, y, r: 0.55 });
  }
  if (idx >= 1) for (const w of wells) if (rng.chance(Math.min(0.5, 0.12 + idx * 0.06))) sweepers.push({ well: w, len: w.r * 2.4, w: rng.pick([-1, 1]) * rng.range(0.9, 1.6), a: rng.range(0, 6.28), thick: 0.28 });
  if (idx >= 3 && rng.chance(Math.min(0.6, 0.25 + idx * 0.05))) {
    tries = 0;
    while (holes.length < 1 && tries++ < 200) {
      const x = rng.range(-halfW + 3, halfW - 3), y = rng.range(y0 + 4, y1 - 4);
      if (all.some(w => Math.hypot(w.x - x, w.y - y) < w.r + 7)) continue;
      holes.push({ x, y, r: 0.9, pull: 70 });
    }
  }
  // sparks: ~40% hug a well's perihelion band (invites tight orbits), the rest sit in open lanes
  const sparks = []; tries = 0;
  while (sparks.length < T.SPARKS_PER_SECTOR && tries++ < 500) {
    let x, y;
    if (wells.length && rng.chance(0.4)) { const w = rng.pick(wells); const a = rng.range(0, 6.28), rr = w.r * rng.range(1.15, 1.32); x = w.x + Math.cos(a) * rr; y = w.y + Math.sin(a) * rr; }
    else { x = rng.range(-halfW + 1, halfW - 1); y = rng.range(y0 + (idx === 0 ? 8 : 1), y1 - 1); }
    if (Math.abs(x) > halfW - 0.8) continue;
    if (all.some(w => Math.hypot(w.x - x, w.y - y) < w.r + 0.9)) continue;
    if (mines.some(m => Math.hypot(m.x - x, m.y - y) < 1.6) || holes.some(h => Math.hypot(h.x - x, h.y - y) < 3)) continue;
    if (sparks.some(s => Math.hypot(s.x - x, s.y - y) < 1.4)) continue;
    sparks.push({ x, y, got: false, phase: rng.range(0, 6.28) });
  }
  return { idx, y0, y1, halfW, wells, mines, sweepers, holes, sparks };
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
      w.mesh = m;
    }
    for (const sp of sector.sparks) { const m = new THREE.Mesh(this.sparkGeo, this.sparkMat); m.position.set(sp.x, sp.y, 0); g.add(m); sp.mesh = m; }
    for (const mn of sector.mines) { const m = new THREE.Mesh(this.mineGeo, this.mineMat); m.position.set(mn.x, mn.y, 0); g.add(m); mn.mesh = m; }
    for (const sw of sector.sweepers) {
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
    const extra = sector.idx === 0 ? 80 : 0; // first sector's walls also cover the space below the start
    const wallGeo = new THREE.PlaneGeometry(40, T.SECTOR_H + extra);
    const l = new THREE.Mesh(wallGeo, this.wallMat); l.position.set(-sector.halfW - 20, sector.y0 - extra / 2 + T.SECTOR_H / 2, -0.2); g.add(l);
    const r = new THREE.Mesh(wallGeo, this.wallMat); r.position.set(sector.halfW + 20, sector.y0 - extra / 2 + T.SECTOR_H / 2, -0.2); g.add(r);
    this.group.add(g);
    this.sectors.set(sector.idx, g);
  }
  remove(idx) {
    const g = this.sectors.get(idx); if (!g) return;
    const shared = new Set([this.wellGeo, this.ringGeo, this.sparkGeo, this.mineGeo, this.sparkMat, this.mineMat, this.wallMat, this.holeMat, this.holeRingMat]);
    g.traverse((o) => { if (!o.isMesh) return; if (!shared.has(o.geometry)) o.geometry.dispose(); if (!shared.has(o.material)) o.material.dispose(); });
    this.group.remove(g); this.sectors.delete(idx);
  }
}
