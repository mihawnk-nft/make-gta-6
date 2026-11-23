// Round 3 (recorded session): revisited — this helper still serves the rebuilt game; see test-rebuild.mjs for the live checks.
// Probe: hold W, turn once toward the mission target, sample the trail.
import { chromium } from 'playwright-core';

const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:8080/?seed=7', { waitUntil: 'load' });
await page.waitForTimeout(2000);
await page.click('#start-screen');
await page.waitForTimeout(800);
const t0 = Date.now();
async function sample(tag) {
  const s = await page.evaluate(() => ({
    pos: window.__sunset.player.position(),
    heading: window.__sunset.player.state.heading,
    clock: document.getElementById('hud-clock').textContent,
    focus: document.hasFocus(),
  }));
  console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', tag, JSON.stringify(s));
}
await sample('start');
// Turn +3.927 rad (two drags: -500px then -285px).
for (const dx of [-500, -285]) {
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(640 + dx, 360, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}
await sample('after-turn');
await page.keyboard.down('ShiftLeft');
await page.keyboard.down('KeyW');
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(2000);
  await sample('run' + i);
}
await page.keyboard.up('KeyW');
await page.keyboard.up('ShiftLeft');
await browser.close();
