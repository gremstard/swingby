import { chromium } from 'playwright';
const url = 'http://localhost:5188/', out = 'build/shots';
const browser = await chromium.launch({ executablePath: '/Users/mustafa/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url); await page.waitForFunction(() => window.renderer?.info.render.calls > 0); await page.waitForTimeout(300);
await page.evaluate(() => { const p = window.G.profile; p.firstRun = false; p.tutorialDone = true; p.coins = 777; window.G.saveNow(); window.G.abandon(); window.menu.show('shop'); }); await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/20-shop.png` });
for (const [id, name] of [[7, 'ember-spikes'], [13, 'abyss-portal'], [19, 'zenith-drift']]) { await page.evaluate((id) => window.startRun('level', id), id); await page.waitForTimeout(2500); await page.screenshot({ path: `${out}/21-${name}.png` }); }
await browser.close(); console.log(JSON.stringify({ errors }));
