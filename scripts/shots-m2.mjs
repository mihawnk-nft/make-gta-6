// Round 3 (recorded session): revisited — this helper still serves the rebuilt game; see test-rebuild.mjs for the live checks.
// Take the M2 staged screenshots (2-drive, 3-chase, 4-mission) via the
// game's own ?shot= staging paths. Cover (1-cover.jpg) is left alone.
import { chromium } from 'playwright-core';
import { statSync } from 'node:fs';

const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const shots = [
  { name: '2-drive.jpg', query: '?shot=drive&seed=7' },
  { name: '3-chase.jpg', query: '?shot=chase&seed=7' },
  { name: '4-mission.jpg', query: '?shot=mission&seed=7' },
];

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR', m.text()); });

for (const shot of shots) {
  await page.goto('http://localhost:8080/' + shot.query, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  const path = `screenshots/${shot.name}`;
  await page.screenshot({ path, type: 'jpeg', quality: 85 });
  const size = statSync(path).size;
  console.log(shot.name, size, 'bytes', size <= 262144 ? 'OK' : 'TOO BIG');
}
await browser.close();
console.log('done');
