// One verb: hold. Space / LMB / touch all map to it. Buffered so a press during hitstop still lands.
export class Input {
  constructor(el) {
    this.held = false; this.pressed = false; this.released = false; this.keys = new Set(); this.onKey = null;
    const down = (e) => { if (!this.held) { this.pressed = true; } this.held = true; e.preventDefault?.(); };
    const up = () => { if (this.held) this.released = true; this.held = false; };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') down(e);
      else this.onKey?.(e.code);
    });
    window.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') up(); });
    el.addEventListener('pointerdown', (e) => { if (e.button === 0 || e.pointerType !== 'mouse') down(e); });
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    window.addEventListener('blur', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  consume() { const r = { pressed: this.pressed, released: this.released, held: this.held }; this.pressed = false; this.released = false; return r; }
}
