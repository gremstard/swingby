// Seeded RNG (mulberry32) + string hashing, so every sector is reproducible.
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => Math.floor(lo + (hi - lo + 1) * next()),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}
export function subSeed(runSeed, purpose, index) {
  return hashStr(`${runSeed}:${purpose}:${index}`);
}
export function dailySeed() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
export function randomSeed() {
  const words = ['ion','nova','drift','tide','halo','flux','sol','orbit','ember','void','comet','vega','lyra','iris','pulse'];
  return `${words[Math.floor(Math.random()*words.length)]}-${words[Math.floor(Math.random()*words.length)]}-${Math.floor(Math.random()*999)}`;
}
