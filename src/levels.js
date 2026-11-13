// Twelve authored levels. Each is a finite corridor with a finish gate, built from a seed + a
// difficulty profile, so the layout is identical for every player (speedrun-able, shareable).
import { T } from './tuning.js';
const L = (id, name, tier, seed, sectors, p) => ({ id, name, tier, seed, sectors, periGoal: p.periGoal ?? 2, sparkGoal: p.sparkGoal ?? 0.6, tide: p.tide ?? 1, hue: p.hue ?? 0.6,
  profile: (idx) => ({ halfW: p.halfW ?? 12, wells: p.wells ?? 5, mines: p.mines ?? 0, sweeperP: p.sweeperP ?? 0, holeP: p.holeP ?? 0, sparks: p.sparks ?? 10, hue: p.hue ?? 0.6, startPad: idx === 0 ? 14 : 2 }) });
export const LEVELS = [
  L(1,  'First Light',   1, 'first-light',   2, { wells: 4, sparks: 12, tide: 0.65, periGoal: 1, hue: 0.58, halfW: 13 }),
  L(2,  'Tangent',       1, 'tangent',       2, { wells: 5, sparks: 12, tide: 0.75, periGoal: 2, hue: 0.62 }),
  L(3,  'Ember Lane',    1, 'ember-lane',    3, { wells: 6, mines: 2, sparks: 11, tide: 0.85, hue: 0.08 }),
  L(4,  'Sweep',         2, 'sweep',         3, { wells: 6, sweeperP: 0.35, sparks: 11, tide: 0.9, hue: 0.95 }),
  L(5,  'Narrows',       2, 'narrows',       3, { wells: 6, mines: 2, halfW: 9, sparks: 10, tide: 0.95, hue: 0.5 }),
  L(6,  'Singularity',   2, 'singularity',   3, { wells: 6, holeP: 0.8, sparks: 10, tide: 1.0, hue: 0.75 }),
  L(7,  'Riptide',       3, 'riptide',       4, { wells: 7, mines: 2, sparks: 10, tide: 1.3, periGoal: 3, hue: 0.55 }),
  L(8,  'Thicket',       3, 'thicket',       4, { wells: 9, mines: 1, sparks: 12, tide: 1.0, hue: 0.33 }),
  L(9,  'Gauntlet',      3, 'gauntlet',      4, { wells: 7, mines: 3, sweeperP: 0.4, holeP: 0.5, sparks: 10, tide: 1.1, periGoal: 3, hue: 0.0 }),
  L(10, 'Eclipse',       4, 'eclipse',       5, { wells: 8, mines: 2, holeP: 0.7, halfW: 9, sparks: 10, tide: 1.15, periGoal: 3, hue: 0.8 }),
  L(11, 'Perihelion',    4, 'perihelion',    5, { wells: 8, mines: 3, sweeperP: 0.45, halfW: 10, sparks: 10, tide: 1.45, periGoal: 4, hue: 0.12 }),
  L(12, 'Event Horizon', 5, 'event-horizon', 6, { wells: 9, mines: 4, sweeperP: 0.5, holeP: 0.8, halfW: 8.5, sparks: 10, tide: 1.5, periGoal: 5, sparkGoal: 0.7, hue: 0.7 }),
];
export function endlessProfile(idx) {
  return { halfW: Math.max(T.HALF_W_MIN, T.HALF_W0 - idx * T.HALF_W_SHRINK), wells: Math.min(T.WELLS_PER_SECTOR_MAX, T.WELLS_PER_SECTOR0 + Math.floor(idx * 0.6)),
    mines: Math.min(T.MINES_MAX, T.MINES_PER_SECTOR0 + Math.floor(idx * 0.7)), sweeperP: idx >= 1 ? Math.min(0.5, 0.12 + idx * 0.06) : 0, holeP: idx >= 3 ? Math.min(0.6, 0.25 + idx * 0.05) : 0,
    sparks: T.SPARKS_PER_SECTOR, hue: null, startPad: idx === 0 ? 14 : 2 };
}
export function levelFinishY(def) { return def.sectors * T.SECTOR_H; }
