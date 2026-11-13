// Profile = everything that survives a run. Versioned so later builds can migrate.
const KEY = 'peri.profile';
const DEFAULT = () => ({
  version: 1, xp: 0, equipped: { skin: 'ember', trail: 'classic' }, unlocked: ['ember', 'classic'],
  levels: {},                       // id -> { stars, bestScore, completed, bestSparks, bestPeris }
  endless: { best: 0, bestH: 0 }, daily: { date: '', best: 0 },
  settings: { shake: true, flash: true, mute: false, reduceMotion: false },
  stats: { runs: 0, deaths: 0, sparks: 0, peris: 0, height: 0 }, firstRun: true,
});
export function loadProfile() {
  let p;
  try { p = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { p = null; }
  if (!p) {
    p = DEFAULT();
    // migrate pre-profile builds
    p.endless.best = Number(localStorage.getItem('peri.best') || 0); p.endless.bestH = Number(localStorage.getItem('peri.bestH') || 0);
    p.settings.shake = localStorage.getItem('peri.shake') !== '0'; p.settings.flash = localStorage.getItem('peri.flash') !== '0'; p.settings.mute = localStorage.getItem('peri.mute') === '1';
  }
  // fill missing keys from DEFAULT (forward-compatible)
  const d = DEFAULT(); for (const k of Object.keys(d)) if (p[k] === undefined) p[k] = d[k];
  for (const k of Object.keys(d.settings)) if (p.settings[k] === undefined) p.settings[k] = d.settings[k];
  return p;
}
export function saveProfile(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} }
export function resetProfile() { localStorage.removeItem(KEY); return loadProfile(); }
