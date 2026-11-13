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
await page.screenshot({ path: `${out}/01-start.png` });
// bot: hold Space when a well is reachable, release after ~0.9 s of orbit; repeat
let latches = 0, releases = 0;
const t0 = Date.now();
while (Date.now() - t0 < 14000) {
  const st = await page.evaluate(() => ({ dead: window.S.dead, tethered: !!window.comet.tether, reach: !!window.comet.nearestReachable(window.S.wells), y: window.comet.y, speed: window.comet.speed }));
  if (st.dead) break;
  if (!st.tethered && st.reach) { await page.keyboard.down('Space'); latches++; await page.waitForTimeout(700 + Math.random() * 500); await page.keyboard.up('Space'); releases++; if (latches === 1) await page.screenshot({ path: `${out}/02-orbit.png` }); }
  await page.waitForTimeout(80);
}
await page.screenshot({ path: `${out}/03-mid.png` });
const final = await page.evaluate(() => ({ dead: window.S.dead, cause: window.comet.cause, maxY: Math.floor(window.S.maxY), score: window.S.score, ts: window.S.timeScale, draws: window.renderer.info.render.calls, tris: window.renderer.info.render.triangles }));
// restart path: wait for death then press R
if (!final.dead) { await page.evaluate(() => { window.comet.die('BOT'); window.S.running = false; }); }
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/04-death.png` });
await page.keyboard.press('KeyR'); await page.waitForTimeout(300);
const restarted = await page.evaluate(() => window.S.running && window.comet.alive && window.S.timeScale === 1);
await browser.close();
const report = { ...final, latches, releases, restarted, errors };
console.log(JSON.stringify(report, null, 2));
process.exit(errors.length || !restarted ? 1 : 0);
