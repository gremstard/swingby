// All sound is synthesized: no assets, no decode errors, instant load. Unlocked on first gesture.
export class Audio {
  constructor() { this.ctx = null; this.muted = localStorage.getItem('peri.mute') === '1'; this.speedK = 0; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 0.0; this.music.connect(this.master);
    // drone: two detuned saws through a lowpass whose cutoff follows speed
    this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 220; this.filter.Q.value = 2; this.filter.connect(this.music);
    for (const [f, type] of [[55, 'sawtooth'], [55.4, 'sawtooth'], [110.2, 'triangle']]) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.18; o.connect(g); g.connect(this.filter); o.start(); }
    this.lfo = ctx.createOscillator(); this.lfo.frequency.value = 0.13; const lg = ctx.createGain(); lg.gain.value = 60; this.lfo.connect(lg); lg.connect(this.filter.frequency); this.lfo.start();
    this.music.gain.setTargetAtTime(0.55, ctx.currentTime, 2.5);
    // noise buffer for whooshes
    const n = ctx.sampleRate * 1.5, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.noise = buf;
  }
  toggleMute() { this.muted = !this.muted; localStorage.setItem('peri.mute', this.muted ? '1' : '0'); if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05); return this.muted; }
  update(speedK, tethered, tideFear) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.filter.frequency.setTargetAtTime(200 + speedK * 1400 + tideFear * 600, t, 0.15);
    this.filter.Q.setTargetAtTime(tethered ? 6 : 2, t, 0.1);
  }
  tone(freq, dur, { type = 'sine', vol = 0.3, slide = 1, attack = 0.005 } = {}) {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.02);
  }
  whoosh(dur, { from = 400, to = 2400, vol = 0.25, q = 1 } = {}) {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t); s.stop(t + dur + 0.02);
  }
  latch() { this.tone(660, 0.08, { type: 'square', vol: 0.12, slide: 1.5 }); this.whoosh(0.12, { from: 300, to: 900, vol: 0.12 }); }
  release(speedK) { this.whoosh(0.35, { from: 600 + speedK * 800, to: 3000 + speedK * 2000, vol: 0.2 + speedK * 0.2, q: 0.8 }); }
  spark(combo) { const f = 520 * Math.pow(1.0595, Math.min(combo, 8) * 2); this.tone(f, 0.18, { type: 'triangle', vol: 0.25, slide: 1.02 }); this.tone(f * 2, 0.12, { vol: 0.08 }); }
  perihelion() { this.tone(880, 0.5, { vol: 0.25 }); this.tone(1320, 0.6, { vol: 0.18 }); this.tone(1760, 0.8, { vol: 0.1, attack: 0.08 }); this.whoosh(0.5, { from: 2000, to: 400, vol: 0.15 }); }
  near() { this.tone(110, 0.25, { type: 'sine', vol: 0.3, slide: 0.5 }); this.whoosh(0.25, { from: 200, to: 80, vol: 0.2, q: 2 }); }
  death() { this.tone(180, 0.7, { type: 'sawtooth', vol: 0.35, slide: 0.15 }); this.whoosh(0.7, { from: 3000, to: 100, vol: 0.4, q: 0.5 }); if (this.music) this.music.gain.setTargetAtTime(0.15, this.ctx.currentTime, 0.1); }
  restart() { if (this.music) this.music.gain.setTargetAtTime(0.55, this.ctx.currentTime, 1.0); this.whoosh(0.4, { from: 200, to: 1500, vol: 0.15 }); }
}
