// Round 3 (recorded session): revisited — this helper still serves the rebuilt game; see test-rebuild.mjs for the live checks.
// Re-stage only 4-mission.jpg via the game's own ?shot=mission path,
// after the M3 palm fix moved the palm off the mission-1 beacon beam.
import { chromium } from 'playwright-core';
import { statSync } from 'node:fs';

const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR', m.text()); });

await page.goto('http://localhost:8080/?shot=mission&seed=7', { waitUntil: 'load' });
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 60000 });
await page.waitForTimeout(500);
const path = 'screenshots/4-mission.jpg';
await page.screenshot({ path, type: 'jpeg', quality: 85 });
const size = statSync(path).size;
console.log('4-mission.jpg', size, 'bytes', size <= 262144 ? 'OK' : 'TOO BIG');
await browser.close();
console.log('done');
