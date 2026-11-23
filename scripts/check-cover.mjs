// Round 3 (recorded session): revisited — this helper still serves the rebuilt game; see test-rebuild.mjs for the live checks.
// Regression check: the M1 cover staging still renders after the M2 edits.
import { chromium } from 'playwright-core';

const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:8080/?shot=cover&seed=7', { waitUntil: 'load' });
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 60000 });
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/cover-check.jpg', type: 'jpeg', quality: 85 });
console.log('cover OK');
await browser.close();
