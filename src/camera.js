import * as THREE from 'three';
import { T } from './tuning.js';

function noise(t, seed) { return 0.6 * Math.sin(t * 11 + seed) + 0.4 * Math.sin(t * 23 + seed * 2); }

export class CameraRig {
  constructor(camera) {
    this.camera = camera; this.fx = 0; this.fy = 0; this.trauma = 0; this.t = 0; this.strength = 0.8; this.fovPunch = 0; this.baseFov = 50; this.reduceMotion = false;
  }
  snap(x, y) { this.fx = x; this.fy = y; }
  addTrauma(a) { this.trauma = Math.min(1, this.trauma + a); }
  punch(a) { this.fovPunch = Math.max(this.fovPunch, a); }
  update(realDt, comet) {
    // follow + look-ahead (exp smoothing, frame-rate independent)
    const tx = comet.x * 0.35 + comet.vx * T.LOOK_AHEAD * 0.5;
    const ty = comet.y + 4 + comet.vy * T.LOOK_AHEAD;
    const k = 1 - Math.exp(-T.CAM_FOLLOW * realDt);
    this.fx += (tx - this.fx) * k; this.fy += (ty - this.fy) * k;
    // portrait screens pull back so the whole corridor (±13.5) stays in view
    const halfTan = Math.tan(this.baseFov * 0.5 * Math.PI / 180);
    const zFit = 13.5 / (halfTan * Math.max(0.3, this.camera.aspect));
    const z = Math.max(T.CAM_Z, zFit) + (comet.speed - T.CRUISE) * T.CAM_SPEED_ZOOM;
    // shake rides on top
    this.t += realDt; this.trauma = Math.max(0, this.trauma - 1.4 * realDt);
    const s = this.trauma * this.trauma * this.strength;
    const ox = 0.6 * s * noise(this.t * 3, 1), oy = 0.45 * s * noise(this.t * 3, 2), roll = (this.reduceMotion ? 0 : 0.06) * s * noise(this.t * 3, 3);
    this.camera.position.set(this.fx + ox, this.fy + oy, z);
    this.camera.rotation.set(0, 0, roll);
    this.fovPunch = Math.max(0, this.fovPunch - 3.5 * realDt * (this.fovPunch + 0.2));
    const fov = this.baseFov + (this.reduceMotion ? 0 : this.fovPunch * 14);
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
  }
}
