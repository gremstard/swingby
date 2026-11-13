import { T } from './tuning.js';

export class Comet {
  constructor() { this.reset(); }
  reset() {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = T.CRUISE; this.speed = T.CRUISE;
    this.tether = null;      // { well, R, angle, dir }
    this.wantTether = false; this.alive = true; this.cause = null;
    this.minRatio = Infinity; // closest approach ratio during current tether
  }
  nearestReachable(wells) {
    let best = null, bd = Infinity;
    for (const w of wells) {
      const d = Math.hypot(w.x - this.x, w.y - this.y) - w.r;
      if (d < T.REACH && d < bd) { bd = d; best = w; }
    }
    return best;
  }
  latch(w) {
    const rx = this.x - w.x, ry = this.y - w.y;
    const R = Math.hypot(rx, ry);
    const cross = rx * this.vy - ry * this.vx;
    const dir = cross >= 0 ? 1 : -1;
    this.tether = { well: w, R, angle: Math.atan2(ry, rx), dir };
    this.minRatio = R / w.r;
    this.speed = Math.max(this.speed, T.CRUISE * 0.8);
  }
  release() {
    const t = this.tether; if (!t) return null;
    this.tether = null;
    return { ratio: this.minRatio, well: t.well };
  }
  step(dt, wells, events, holes = []) {
    if (!this.alive) return;
    // black holes: pull in free flight (tether ignores them; that's the escape)
    if (!this.tether) for (const h of holes) { const dx = h.x - this.x, dy = h.y - this.y, d2 = Math.max(1, dx*dx + dy*dy), d = Math.sqrt(d2); const f = h.pull / d2 * dt; this.vx += dx / d * f; this.vy += dy / d * f; this.speed = Math.min(T.MAX_SPEED, Math.hypot(this.vx, this.vy)); }
    if (this.tether) {
      const t = this.tether;
      // Perihelion rule: speed grows with 1/r. Tighter orbit = faster = more lethal.
      this.speed = Math.min(T.MAX_SPEED, this.speed + (T.PERI_K / t.R) * dt);
      t.angle += t.dir * (this.speed / t.R) * dt;
      this.x = t.well.x + Math.cos(t.angle) * t.R;
      this.y = t.well.y + Math.sin(t.angle) * t.R;
      this.vx = -Math.sin(t.angle) * t.dir * this.speed;
      this.vy = Math.cos(t.angle) * t.dir * this.speed;
      this.minRatio = Math.min(this.minRatio, t.R / t.well.r);
    } else {
      // Free flight: bleed toward cruise so stalls and runaway are both impossible by accident.
      const k = 1 - Math.exp(-T.DRAG_RATE * dt);
      this.speed += (T.CRUISE - this.speed) * k;
      const s = Math.hypot(this.vx, this.vy) || 1;
      this.vx = this.vx / s * this.speed; this.vy = this.vy / s * this.speed;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.wantTether) { const w = this.nearestReachable(wells); if (w) { this.latch(w); events.push({ type: 'latch', well: w }); } }
    }
    // Near miss / burn
    for (const w of wells) {
      const d = Math.hypot(w.x - this.x, w.y - this.y);
      if (d < w.r) { this.die('BURNED UP IN A WELL'); events.push({ type: 'death' }); return; }
      if (d < w.r * T.NEAR_RATIO && !w._nearFired) { w._nearFired = true; events.push({ type: 'near', well: w }); }
      else if (d > w.r * T.NEAR_RATIO * 1.5) w._nearFired = false;
    }
  }
  die(cause) { this.alive = false; this.cause = cause; this.tether = null; }
}
