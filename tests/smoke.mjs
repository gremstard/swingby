// Smoke + bot playtest: loads the game, asserts frames render with no errors, drives the one verb, screenshots.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const url = process.argv[2] || 'http://127.0.0.1:5188/';
const out = process.argv[3] || 'build/shots'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Users/mustafa/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.renderer?.info.render.calls > 0, null, { timeout: 20000 });
await page.waitForTimeout(600);
await page.evaluate(() => { window.G.profile.firstRun = false; window.G.profile.tutorialDone = true; window.G.saveNow(); window.G.abandon(); window.menu.show('main'); }); await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/01-menu.png` });
await page.click('button[data-a="worlds"]'); await page.waitForTimeout(150); await page.screenshot({ path: `${out}/01a-worlds.png` }); await page.click('button[data-a="levels"]'); await page.waitForTimeout(200); await page.screenshot({ path: `${out}/01b-levels.png` });
await page.click('button[data-a="customize"]').catch(() => {});
await page.evaluate(() => window.menu.show('customize')); await page.waitForTimeout(150); await page.screenshot({ path: `${out}/01c-customize.png` });
await page.evaluate(() => window.menu.show('main')); await page.click('button[data-a="endless"]'); await page.waitForTimeout(200);
// bot: runs IN PAGE each frame (no Playwright latency). Policy: grab the nearest well; release when
// velocity points at a spark ahead (±22°) or, failing that, roughly up and not toward a wall.
await page.evaluate(() => {
  const { comet, S, input } = window; window.__bot = { latches: 0, releases: 0 };
  const ang = (ax, ay, bx, by) => Math.acos(Math.max(-1, Math.min(1, (ax*bx + ay*by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1))));
  function target() {
    let best = null, bd = 1e9;
    for (const sp of S.sparks_ || []) { if (sp.got || sp.y < comet.y - 1) continue; const d = Math.hypot(sp.x - comet.x, sp.y - comet.y); if (d < bd) { bd = d; best = sp; } }
    return best;
  }
  function tick() {
    if (S.dead) return;
    const hw = window.halfWidthAt ? window.halfWidthAt(Math.floor(comet.y / 60)) : 9;
    if (comet.tether) {
      const sp = target(); let release = false;
      if (sp) release = ang(comet.vx, comet.vy, sp.x - comet.x, sp.y - comet.y) < 0.38 && comet.vy > -2;
      if (!release) { const a = ang(comet.vx, comet.vy, 0, 1); const xAhead = comet.x + comet.vx * 1.2; release = a < 0.5 && Math.abs(xAhead) < hw - 1.5; }
      if (comet.minRatio < 1.2 && comet.vy > 0 && Math.abs(comet.x + comet.vx) < hw - 1) release = true; // cash perihelion
      if (release) { input.held = false; input.released = true; window.__bot.releases++; }
    } else {
      const w = comet.nearestReachable(S.wells);
      const sp = target(); const onCourse = sp && ang(comet.vx, comet.vy, sp.x - comet.x, sp.y - comet.y) < 0.2;
      const wallDanger = Math.abs(comet.x + comet.vx * 0.8) > hw - 1.2;
      if (w && (!onCourse || wallDanger)) { input.held = true; input.pressed = true; window.__bot.latches++; }
    }
  }
  window.__botTimer = setInterval(tick, 16);
});
await page.waitForTimeout(1200); await page.screenshot({ path: `${out}/02-orbit.png` });
await page.waitForFunction(() => window.S.dead, null, { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(120); await page.screenshot({ path: `${out}/03b-supernova.png` });
const { latches, releases } = await page.evaluate(() => window.__bot);
await page.screenshot({ path: `${out}/03-mid.png` });
const final = await page.evaluate(() => ({ dead: window.S.dead, cause: window.comet.cause, maxY: Math.floor(window.S.maxY), score: window.S.score, sparks: window.S.sparks, peris: window.S.peris, bestCombo: window.S.bestCombo, ts: window.S.timeScale, draws: window.renderer.info.render.calls, tris: window.renderer.info.render.triangles }));
// restart path: wait for death then press R
if (!final.dead) { await page.evaluate(() => { window.comet.die('BOT'); window.S.running = false; }); }
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/04-death.png` });
await page.waitForTimeout(1300); await page.screenshot({ path: `${out}/04b-deathmenu.png` });
await page.keyboard.press('KeyR'); await page.waitForTimeout(300);
const restarted = await page.evaluate(() => window.S.running && window.comet.alive && window.S.timeScale === 1);
// level flow: start level 1, teleport to the gate, expect results + XP + save
await page.evaluate(() => window.startRun('level', 1)); await page.waitForTimeout(300);
await page.evaluate(() => { window.comet.y = window.S.finishY - 0.5; window.S.tideY = window.comet.y - 20; });
await page.waitForTimeout(1500); await page.screenshot({ path: `${out}/07-level-clear.png` });
const levelWin = await page.evaluate(() => ({ won: window.S.won, stars: window.G.profile.levels[1]?.stars, xp: window.G.profile.xp, saved: !!localStorage.getItem('peri.profile'), menu: window.menu.root.dataset.screen }));
// modifiers + boss: run level 8 (wind), 13 (portal), 14 (wrap) briefly for errors; then boss level 6: teleport near boss, collect cores by teleport
const modErrors = [];
for (const id of [8, 13, 14, 19]) { await page.evaluate((id) => window.startRun('level', id), id); await page.waitForTimeout(700); const st = await page.evaluate(() => ({ running: window.S.running, y: window.comet.y })); if (!st.running && st.y < 2) modErrors.push('level ' + id + ' not running'); }
await page.evaluate(() => window.startRun('level', 6)); await page.waitForTimeout(300);
const bossRes = await page.evaluate(async () => {
  const b = window.S.sectors.get(2)?.boss; if (!b) return { boss: false };
  window.S.boss = b; window.S.invuln = 999; window.comet.y = b.y - 12; window.S.tideY = window.comet.y - 25;
  await new Promise(r => setTimeout(r, 400));
  for (const c of b.cores) { if (!c.got) { window.comet.x = c.x; window.comet.y = c.y; window.S.tideY = window.comet.y - 25; await new Promise(r => setTimeout(r, 1500)); } }
  await new Promise(r => setTimeout(r, 800));
  return { boss: true, hp: b.hp, total: b.coresTotal, dead: !!b.dead, alive: window.comet.alive, running: window.S.running };
});
await page.screenshot({ path: `${out}/08-boss.png` });
// mobile viewport: title + a second of play, touch input
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await m.goto(url); await m.waitForFunction(() => window.renderer?.info.render.calls > 0, null, { timeout: 20000 }); await m.waitForTimeout(300);
await m.evaluate(() => { window.G.profile.firstRun = false; window.G.saveNow(); window.G.abandon(); window.menu.show('main'); }); await m.waitForTimeout(150);
await m.screenshot({ path: `${out}/05-mobile-title.png` });
await m.tap('button[data-a="endless"]'); await m.waitForTimeout(200); await m.touchscreen.tap(195, 500); await m.waitForTimeout(900);
const mobileRunning = await m.evaluate(() => window.S.running && window.comet.y > 2);
await m.screenshot({ path: `${out}/06-mobile-play.png` });
await browser.close();
const report = { ...final, latches, releases, restarted, levelWin, modErrors, bossRes, mobileRunning, errors };
console.log(JSON.stringify(report, null, 2));
process.exit(errors.length || modErrors.length || !restarted || !mobileRunning || !levelWin.won || !bossRes.dead ? 1 : 0);
