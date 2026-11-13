import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/Users/mustafa/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
const p = await b.newPage({ viewport: { width: 1024, height: 1024 } }); await p.goto('file://' + process.cwd() + '/assets/icon.html'); await p.waitForTimeout(300);
await p.screenshot({ path: 'assets/icon.png', omitBackground: false }); await b.close(); console.log('icon ok');
