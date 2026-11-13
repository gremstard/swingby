// XP curve, player level, and the unlock table (cosmetics only: power never gates).
export function xpForLevel(n) { return Math.floor(120 * Math.pow(n, 1.45)); }      // cumulative XP needed to REACH level n+1 from n
export function levelFromXp(xp) { let lvl = 1, need = xpForLevel(1), acc = 0; while (xp >= acc + need && lvl < 40) { acc += need; lvl++; need = xpForLevel(lvl); } return { lvl, into: xp - acc, need }; }
export function runXp({ score, sparks, peris, height, levelDef, won, firstWin, newStars }) {
  let xp = Math.floor(score / 6) + sparks * 3 + peris * 15 + Math.floor(height / 10);
  if (won) xp += firstWin ? 120 + levelDef.tier * 60 : 40 + levelDef.tier * 15;
  xp += newStars * 50;
  return xp;
}
// shape: sphere | gem | dart | ring | star | cube | shard
export const SKINS = [
  { id: 'ember',   name: 'Ember',    shape: 'sphere', color: 0xffffff, emissive: 0xfff2d0, trail: 0xffd9a0, req: {} },
  { id: 'ion',     name: 'Ion',      shape: 'gem',    color: 0xd8f6ff, emissive: 0x7fe0ff, trail: 0x6fd6ff, req: { lvl: 2 } },
  { id: 'dart',    name: 'Dart',     shape: 'dart',   color: 0xe0e6ff, emissive: 0x9fb4ff, trail: 0xb0c4ff, req: { lvl: 3 } },
  { id: 'rose',    name: 'Rose',     shape: 'star',   color: 0xffe0ec, emissive: 0xff6fa8, trail: 0xff7fb8, req: { lvl: 4 } },
  { id: 'halo',    name: 'Halo',     shape: 'ring',   color: 0xffffff, emissive: 0xffe9a8, trail: 0xffe9a8, req: { stars: 6 } },
  { id: 'verdant', name: 'Verdant',  shape: 'cube',   color: 0xe6ffe0, emissive: 0x7dff8a, trail: 0x8dff9a, req: { lvl: 6 } },
  { id: 'void',    name: 'Void',     shape: 'shard',  color: 0xc9b8ff, emissive: 0x9b5cff, trail: 0xa070ff, req: { stars: 12 } },
  { id: 'solar',   name: 'Solar',    shape: 'star',   color: 0xffffff, emissive: 0xffd040, trail: 0xffe070, req: { lvl: 9 } },
  { id: 'aurora',  name: 'Aurora',   shape: 'gem',    color: 0xffffff, emissive: 0x80ffd0, trail: 0x90ffe0, req: { stars: 24 } },
  { id: 'prism',   name: 'Prism',    shape: 'dart',   color: 0xffffff, emissive: 0xffffff, trail: 0xffffff, cycle: true, req: { lvl: 14 } },
  { id: 'eclipse', name: 'Eclipse',  shape: 'ring',   color: 0x202030, emissive: 0xff4a1a, trail: 0xff6a2a, req: { stars: 36 } },
];
// fx: none | sparkle | fire | electric | plasma
export const TRAILS = [
  { id: 'classic',  name: 'Classic',  width: 0.2,  len: 48,  fx: 'none', req: {} },
  { id: 'wisp',     name: 'Wisp',     width: 0.12, len: 90,  fx: 'none', req: { lvl: 2 } },
  { id: 'fire',     name: 'Fire',     width: 0.42, len: 44,  fx: 'fire', color: 0xff8a2a, color2: 0xff2a1a, req: { lvl: 3 } },
  { id: 'electric', name: 'Electric', width: 0.14, len: 60,  fx: 'electric', color: 0x8fe8ff, color2: 0xffffff, jitter: 0.35, req: { lvl: 5 } },
  { id: 'blaze',    name: 'Blaze',    width: 0.34, len: 40,  fx: 'sparkle', req: { lvl: 7 } },
  { id: 'comet',    name: 'Comet',    width: 0.28, len: 120, fx: 'none', req: { lvl: 8 } },
  { id: 'plasma',   name: 'Plasma',   width: 0.3,  len: 80,  fx: 'plasma', color: 0xb06bff, color2: 0x4af0ff, jitter: 0.12, req: { stars: 15 } },
  { id: 'ghost',    name: 'Ghost',    width: 0.55, len: 30,  fx: 'none', req: { stars: 21 } },
  { id: 'nova',     name: 'Nova',     width: 0.4,  len: 160, fx: 'sparkle', req: { lvl: 12 } },
];
// Shop: coins come from sparks (1 each) and clears. Cosmetics with `price` are coin-only; consumables stack.
export const SHOP = [
  { id: 'shield',  kind: 'item', name: 'Shield',  desc: 'survive one hit', price: 60, max: 9 },
  { id: 'magnet',  kind: 'item', name: 'Magnet',  desc: 'double pull range for one run', price: 40, max: 9 },
  { id: 'rose',    kind: 'skin',  price: 250 }, { id: 'halo', kind: 'skin', price: 400 }, { id: 'void', kind: 'skin', price: 600 },
  { id: 'fire',    kind: 'trail', price: 300 }, { id: 'plasma', kind: 'trail', price: 500 }, { id: 'ghost', kind: 'trail', price: 450 },
];
export function coinsFor({ sparks, won, firstWin, levelDef, boss }) { return sparks + (won ? (firstWin ? 40 : 10) + levelDef.tier * 5 : 0) + (boss && won ? 60 : 0); }
export function totalStars(profile) { return Object.values(profile.levels).reduce((a, l) => a + (l.stars || 0), 0); }
export function meets(req, profile) { const { lvl } = levelFromXp(profile.xp); if (req.lvl && lvl < req.lvl) return false; if (req.stars && totalStars(profile) < req.stars) return false; return true; }
export function reqText(req) { if (req.lvl) return `LEVEL ${req.lvl}`; if (req.stars) return `${req.stars} STARS`; return ''; }
// Returns newly unlocked items after a profile change.
export function syncUnlocks(profile) {
  const fresh = [];
  for (const it of [...SKINS, ...TRAILS]) if (!profile.unlocked.includes(it.id) && meets(it.req, profile)) { profile.unlocked.push(it.id); fresh.push(it); }
  return fresh;
}
