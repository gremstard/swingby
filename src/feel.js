import * as THREE from 'three';

// Tiny tween manager (real-dt driven so feedback stays live during hitstop).
export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
export class Tweens {
  constructor() { this.list = []; }
  add(dur, fn, e = ease.outCubic, key = null) { if (key) this.list = this.list.filter(t => t.key !== key); this.list.push({ t: 0, dur, fn, e, key }); }
  update(dt) { for (let i = this.list.length - 1; i >= 0; i--) { const t = this.list[i]; t.t += dt; const k = Math.min(1, t.t / t.dur); t.fn(t.e(k), k); if (k >= 1) this.list.splice(i, 1); } }
}

// Pooled additive particles: one Points mesh, no per-burst allocation.
export class Particles {
  constructor(scene, n = 400) {
    this.n = n; this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.size = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.maxLife = new Float32Array(n); this.head = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3)); g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      vertexShader: `attribute float size; varying vec3 vc; void main(){ vc = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vc; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(d)); gl_FragColor = vec4(vc * a, a); }` });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; scene.add(this.points);
    for (let i = 0; i < n; i++) this.pos[i * 3 + 2] = -999;
  }
  burst(x, y, count, color, speed = 6, life = 0.6, size = 0.5) {
    const c = new THREE.Color(color);
    for (let k = 0; k < count; k++) {
      const i = this.head; this.head = (this.head + 1) % this.n;
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65);
      this.pos.set([x, y, 0.3], i * 3); this.vel.set([Math.cos(a) * s, Math.sin(a) * s, 0], i * 3);
      this.col.set([c.r, c.g, c.b], i * 3); this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.6); this.size[i] = size * (0.6 + Math.random() * 0.8);
    }
  }
  update(dt) {
    const p = this.pos, v = this.vel, s = this.size;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt; const k = Math.max(0, this.life[i] / this.maxLife[i]);
      p[i*3] += v[i*3] * dt; p[i*3+1] += v[i*3+1] * dt; v[i*3] *= 1 - 2.5 * dt; v[i*3+1] *= 1 - 2.5 * dt;
      s[i] = s[i] * (1 - 0.5 * dt) * (k < 0.3 ? k / 0.3 : 1) + (k < 0.3 ? 0 : 0);
      if (this.life[i] <= 0) p[i*3+2] = -999;
    }
    const g = this.points.geometry; g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true;
  }
}

// Ribbon trail: fixed-length history of positions, width tapers and alpha fades toward the tail.
export class Trail {
  constructor(scene, n = 48) {
    this.max = n; this.n = n; this.hist = new Float32Array(n * 2); this.filled = 0;
    const pos = new Float32Array(n * 2 * 3), col = new Float32Array(n * 2 * 3), idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; scene.add(this.mesh); this.color = new THREE.Color(0xffd9a0); this.width = 0.2;
  }
  setLength(n) { this.n = Math.min(this.max, n); this.mesh.geometry.setDrawRange(0, (this.n - 1) * 6); }
  reset(x, y) { for (let i = 0; i < this.n; i++) { this.hist[i*2] = x; this.hist[i*2+1] = y; } }
  push(x, y, speedK) {
    this.hist.copyWithin(2, 0, (this.n - 1) * 2); this.hist[0] = x; this.hist[1] = y;
    const pos = this.mesh.geometry.attributes.position.array, col = this.mesh.geometry.attributes.color.array;
    for (let i = 0; i < this.n; i++) {
      const px = this.hist[i*2], py = this.hist[i*2+1];
      const nx = this.hist[Math.min(this.n-1, i+1)*2], ny = this.hist[Math.min(this.n-1, i+1)*2+1];
      let dx = px - nx, dy = py - ny; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const k = 1 - i / this.n; const w = this.width * k * (0.6 + 0.6 * speedK);
      pos.set([px - dy * w, py + dx * w, -0.02, px + dy * w, py - dx * w, -0.02], i * 6);
      const a = k * k * k * k * (0.5 + 0.7 * speedK);
      col.set([this.color.r * a, this.color.g * a, this.color.b * a, this.color.r * a, this.color.g * a, this.color.b * a], i * 6);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.attributes.color.needsUpdate = true;
  }
}

// Pooled expanding rings (additive). The signature "something big happened" shape.
export class Shockwaves {
  constructor(scene, n = 16) {
    this.geo = new THREE.RingGeometry(0.86, 1.0, 96); this.pool = [];
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.visible = false; m.position.z = 0.4; scene.add(m); this.pool.push({ m, t: 0, dur: 1, r: 1, o: 1 }); }
    this.i = 0;
  }
  spawn(x, y, { r = 8, dur = 0.6, color = 0xffffff, opacity = 0.9, thick = 1 } = {}) {
    const s = this.pool[this.i]; this.i = (this.i + 1) % this.pool.length;
    s.t = 0; s.dur = dur; s.r = r; s.o = opacity; s.m.position.set(x, y, 0.4); s.m.material.color.set(color); s.m.visible = true; s.m.scale.setScalar(0.01); s.thick = thick;
  }
  update(dt) {
    for (const s of this.pool) {
      if (!s.m.visible) continue; s.t += dt; const k = Math.min(1, s.t / s.dur); const e = 1 - Math.pow(1 - k, 3);
      s.m.scale.setScalar(0.01 + s.r * e); s.m.material.opacity = s.o * (1 - k) * (1 - k);
      if (k >= 1) s.m.visible = false;
    }
  }
}
