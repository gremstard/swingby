// Worlds -> levels. Each world has a theme (colours), a signature modifier set, and ends in a boss.
// Level ids are global (1..24) so the profile keys stay stable.
import { T } from './tuning.js';

export const WORLDS = [
  { id: 1, name: 'DAWN',   hue: 0.58, bg: 0x05060c, tide: 0xb04bff, star: 0x9fb0ff, blurb: 'learn the swing' },
  { id: 2, name: 'EMBER',  hue: 0.06, bg: 0x0c0604, tide: 0xff5a2a, star: 0xffb080, blurb: 'spikes and gravity' },
  { id: 3, name: 'ABYSS',  hue: 0.76, bg: 0x06040f, tide: 0x40e0ff, star: 0xc0a0ff, blurb: 'portals, no walls' },
  { id: 4, name: 'ZENITH', hue: 0.48, bg: 0x030a0c, tide: 0xffffff, star: 0xa0ffe0, blurb: 'everything moves' },
];

// mods: gravity (+right/-left, units/s^2) · spikes (rows per sector) · portals (pairs per sector) · wrap (no side walls)
//       moving (fraction of wells that drift) · boss (final encounter)
const L = (id, world, name, tier, seed, sectors, p = {}) => ({
  id, world, name, tier, seed, sectors, boss: !!p.boss,
  periGoal: p.periGoal ?? 2, sparkGoal: p.sparkGoal ?? 0.6, tide: p.tide ?? 1,
  mods: { gravity: p.gravity ?? 0, spikes: p.spikes ?? 0, portals: p.portals ?? 0, wrap: !!p.wrap, moving: p.moving ?? 0, boss: !!p.boss },
  profile(idx) {
    const W = WORLDS[world - 1];
    return { halfW: p.halfW ?? 12, wells: p.wells ?? 5, mines: p.mines ?? 0, sweeperP: p.sweeperP ?? 0, holeP: p.holeP ?? 0, sparks: p.sparks ?? 10, hue: W.hue,
      startPad: idx === 0 ? 14 : 2, tier, hazardClear: world <= 2, spikes: p.spikes ?? 0, portals: p.portals ?? 0, moving: p.moving ?? 0, wrap: !!p.wrap, boss: !!p.boss && idx === sectors - 1 };
  },
});
export const LEVELS = [
  // WORLD 1 · DAWN — the swing, sparks, perihelion, first moving wells
  L(1,  1, 'First Light', 1, 'first-light', 2, { wells: 4, sparks: 12, tide: 0.65, periGoal: 1, halfW: 13 }),
  L(2,  1, 'Tangent',     1, 'tangent',     2, { wells: 5, sparks: 12, tide: 0.75 }),
  L(3,  1, 'Drift',       1, 'drift',       3, { wells: 5, sparks: 11, tide: 0.8, moving: 0.4 }),
  L(4,  1, 'Mines',       1, 'ember-lane',  3, { wells: 5, mines: 1, sparks: 11, tide: 0.85 }),
  L(5,  1, 'Sweep',       2, 'sweep',       3, { wells: 6, sweeperP: 0.35, sparks: 11, tide: 0.9, moving: 0.3 }),
  L(6,  1, 'The Warden',  2, 'warden',      3, { wells: 3, sparks: 8, tide: 0.7, periGoal: 2, boss: true, halfW: 13 }),
  // WORLD 2 · EMBER — spikes, sideways gravity, narrow
  L(7,  2, 'Thorns',      2, 'thorns',      3, { wells: 6, spikes: 2, sparks: 11, tide: 0.95 }),
  L(8,  2, 'Leeward',     2, 'leeward',     3, { wells: 6, gravity: 3.5, sparks: 11, tide: 0.95 }),
  L(9,  2, 'Narrows',     2, 'narrows',     3, { wells: 6, mines: 2, halfW: 9, spikes: 1, sparks: 10, tide: 1.0 }),
  L(10, 2, 'Windward',    3, 'windward',    4, { wells: 7, gravity: -5, spikes: 2, sparks: 10, tide: 1.05, moving: 0.3 }),
  L(11, 2, 'Furnace',     3, 'furnace',     4, { wells: 7, mines: 3, sweeperP: 0.4, spikes: 2, sparks: 10, tide: 1.1, periGoal: 3 }),
  L(12, 2, 'The Kiln',    3, 'kiln',        3, { wells: 4, sparks: 8, tide: 0.8, gravity: 2.5, periGoal: 3, boss: true }),
  // WORLD 3 · ABYSS — portals, no side walls (wrap), singularities
  L(13, 3, 'Threshold',   3, 'threshold',   3, { wells: 6, portals: 1, sparks: 11, tide: 1.0 }),
  L(14, 3, 'Open Sea',    3, 'open-sea',    3, { wells: 7, wrap: true, sparks: 11, tide: 1.05 }),
  L(15, 3, 'Singularity', 3, 'singularity', 4, { wells: 6, holeP: 0.8, portals: 1, sparks: 10, tide: 1.05 }),
  L(16, 3, 'Riptide',     4, 'riptide',     4, { wells: 7, mines: 2, wrap: true, portals: 1, sparks: 10, tide: 1.35, periGoal: 3 }),
  L(17, 3, 'Undertow',    4, 'undertow',    4, { wells: 8, holeP: 0.6, portals: 2, wrap: true, sparks: 10, tide: 1.15, moving: 0.4, periGoal: 3 }),
  L(18, 3, 'The Maw',     4, 'maw',         3, { wells: 4, sparks: 8, tide: 0.85, wrap: true, periGoal: 3, boss: true }),
  // WORLD 4 · ZENITH — everything, moving
  L(19, 4, 'Thicket',     4, 'thicket',     4, { wells: 9, mines: 1, sparks: 12, tide: 1.1, moving: 0.6 }),
  L(20, 4, 'Gauntlet',    4, 'gauntlet',    4, { wells: 7, mines: 3, sweeperP: 0.4, spikes: 2, sparks: 10, tide: 1.15, periGoal: 3, moving: 0.4 }),
  L(21, 4, 'Eclipse',     5, 'eclipse',     5, { wells: 8, mines: 2, holeP: 0.7, halfW: 9, portals: 1, sparks: 10, tide: 1.2, periGoal: 3, moving: 0.5 }),
  L(22, 4, 'Perihelion',  5, 'perihelion',  5, { wells: 8, mines: 3, sweeperP: 0.45, halfW: 10, gravity: 4, spikes: 1, sparks: 10, tide: 1.45, periGoal: 4, moving: 0.5 }),
  L(23, 4, 'Event Horizon', 5, 'event-horizon', 6, { wells: 9, mines: 4, sweeperP: 0.5, holeP: 0.8, halfW: 8.5, portals: 2, wrap: true, sparks: 10, tide: 1.5, periGoal: 5, sparkGoal: 0.7, moving: 0.6 }),
  L(24, 4, 'The Sun',     5, 'the-sun',     4, { wells: 5, sparks: 10, tide: 0.9, gravity: 2, moving: 0.5, periGoal: 4, boss: true }),
];
export const levelsOf = (worldId) => LEVELS.filter(l => l.world === worldId);
export function endlessProfile(idx) {
  return { halfW: Math.max(T.HALF_W_MIN, T.HALF_W0 - idx * T.HALF_W_SHRINK), wells: Math.min(T.WELLS_PER_SECTOR_MAX, T.WELLS_PER_SECTOR0 + Math.floor(idx * 0.6)),
    mines: Math.min(T.MINES_MAX, T.MINES_PER_SECTOR0 + Math.floor(idx * 0.7)), sweeperP: idx >= 1 ? Math.min(0.5, 0.12 + idx * 0.06) : 0, holeP: idx >= 3 ? Math.min(0.6, 0.25 + idx * 0.05) : 0,
    sparks: T.SPARKS_PER_SECTOR, hue: null, startPad: idx === 0 ? 14 : 2, tier: Math.min(5, 1 + Math.floor(idx / 3)), hazardClear: idx < 5,
    spikes: idx >= 4 ? Math.min(2, Math.floor((idx - 2) / 3)) : 0, portals: idx >= 6 && idx % 3 === 0 ? 1 : 0, moving: idx >= 2 ? Math.min(0.5, (idx - 1) * 0.08) : 0, wrap: false, boss: false };
}
export function levelFinishY(def) { return def.sectors * T.SECTOR_H; }
