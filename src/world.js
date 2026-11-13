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
  return { idx, y0, y1, halfW, wells };
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
  }
  add(sector) {
    const g = new THREE.Group();
    for (const w of sector.wells) {
      const col = new THREE.Color().setHSL(w.hue, 0.75, 0.6);
      const m = new THREE.Mesh(this.wellGeo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, roughness: 0.4 }));
      m.position.set(w.x, w.y, 0); m.scale.setScalar(w.r); g.add(m);
      const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
      ring.position.set(w.x, w.y, -0.05); ring.scale.setScalar(w.r * T.PERI_RATIO); g.add(ring);
      const reach = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.07, side: THREE.DoubleSide }));
      reach.position.set(w.x, w.y, -0.06); reach.scale.setScalar(w.r + T.REACH); g.add(reach);
      w.mesh = m;
    }
    // void walls
    const wallGeo = new THREE.PlaneGeometry(40, T.SECTOR_H);
    const l = new THREE.Mesh(wallGeo, this.wallMat); l.position.set(-sector.halfW - 20, sector.y0 + T.SECTOR_H / 2, -0.2); g.add(l);
    const r = new THREE.Mesh(wallGeo, this.wallMat); r.position.set(sector.halfW + 20, sector.y0 + T.SECTOR_H / 2, -0.2); g.add(r);
    this.group.add(g);
    this.sectors.set(sector.idx, g);
  }
  remove(idx) {
    const g = this.sectors.get(idx); if (!g) return;
    g.traverse((o) => { if (o.isMesh && o.material && o.geometry !== this.wellGeo && o.geometry !== this.ringGeo) o.geometry.dispose(); if (o.isMesh && o.material !== this.wallMat) o.material?.dispose?.(); });
    this.group.remove(g); this.sectors.delete(idx);
  }
}
