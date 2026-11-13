// XP curve, player level, and the unlock table (cosmetics only: power never gates).
export function xpForLevel(n) { return Math.floor(120 * Math.pow(n, 1.45)); }      // cumulative XP needed to REACH level n+1 from n
export function levelFromXp(xp) { let lvl = 1, need = xpForLevel(1), acc = 0; while (xp >= acc + need && lvl < 40) { acc += need; lvl++; need = xpForLevel(lvl); } return { lvl, into: xp - acc, need }; }
export function runXp({ score, sparks, peris, height, levelDef, won, firstWin, newStars }) {
  let xp = Math.floor(score / 6) + sparks * 3 + peris * 15 + Math.floor(height / 10);
  if (won) xp += firstWin ? 120 + levelDef.tier * 60 : 40 + levelDef.tier * 15;
  xp += newStars * 50;
  return xp;
}
export const SKINS = [
  { id: 'ember',   name: 'Ember',    color: 0xffffff, emissive: 0xfff2d0, trail: 0xffd9a0, req: {} },
  { id: 'ion',     name: 'Ion',      color: 0xd8f6ff, emissive: 0x7fe0ff, trail: 0x6fd6ff, req: { lvl: 2 } },
  { id: 'rose',    name: 'Rose',     color: 0xffe0ec, emissive: 0xff6fa8, trail: 0xff7fb8, req: { lvl: 4 } },
  { id: 'verdant', name: 'Verdant',  color: 0xe6ffe0, emissive: 0x7dff8a, trail: 0x8dff9a, req: { lvl: 6 } },
  { id: 'void',    name: 'Void',     color: 0xc9b8ff, emissive: 0x9b5cff, trail: 0xa070ff, req: { stars: 9 } },
  { id: 'solar',   name: 'Solar',    color: 0xffffff, emissive: 0xffd040, trail: 0xffe070, req: { lvl: 9 } },
  { id: 'aurora',  name: 'Aurora',   color: 0xffffff, emissive: 0x80ffd0, trail: 0x90ffe0, req: { stars: 24 } },
  { id: 'prism',   name: 'Prism',    color: 0xffffff, emissive: 0xffffff, trail: 0xffffff, cycle: true, req: { lvl: 14 } },
  { id: 'eclipse', name: 'Eclipse',  color: 0x202030, emissive: 0xff4a1a, trail: 0xff6a2a, req: { stars: 36 } },
];
export const TRAILS = [
  { id: 'classic', name: 'Classic', width: 0.2, len: 48, req: {} },
  { id: 'wisp',    name: 'Wisp',    width: 0.12, len: 90, req: { lvl: 3 } },
  { id: 'blaze',   name: 'Blaze',   width: 0.34, len: 40, sparks: true, req: { lvl: 5 } },
  { id: 'comet',   name: 'Comet',   width: 0.28, len: 120, req: { lvl: 8 } },
  { id: 'ghost',   name: 'Ghost',   width: 0.5, len: 30, req: { stars: 15 } },
  { id: 'nova',    name: 'Nova',    width: 0.4, len: 160, sparks: true, req: { lvl: 12 } },
];
export function totalStars(profile) { return Object.values(profile.levels).reduce((a, l) => a + (l.stars || 0), 0); }
export function meets(req, profile) { const { lvl } = levelFromXp(profile.xp); if (req.lvl && lvl < req.lvl) return false; if (req.stars && totalStars(profile) < req.stars) return false; return true; }
export function reqText(req) { if (req.lvl) return `LEVEL ${req.lvl}`; if (req.stars) return `${req.stars} STARS`; return ''; }
// Returns newly unlocked items after a profile change.
export function syncUnlocks(profile) {
  const fresh = [];
  for (const it of [...SKINS, ...TRAILS]) if (!profile.unlocked.includes(it.id) && meets(it.req, profile)) { profile.unlocked.push(it.id); fresh.push(it); }
  return fresh;
}
