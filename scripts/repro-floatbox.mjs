// Round 3 (recorded session): revisited — this helper still serves the rebuilt game; see test-rebuild.mjs for the live checks.
// Reproduce the floating rooftop box: walk Mara downtown to the tall
// towers, then orbit/pitch the camera up against a tower and shoot.
import { chromium } from 'playwright-core';

const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:8080/?seed=7', { waitUntil: 'load' });
await page.waitForTimeout(2500); // let the camera lerp settle
await page.click('#start-screen');
await page.waitForTimeout(3000);
// Run east along the z=0 avenue toward downtown (default cam faces +x).
await page.keyboard.down('ShiftLeft');
await page.keyboard.down('KeyW');
await page.waitForTimeout(11000);
await page.keyboard.up('KeyW');
await page.keyboard.up('ShiftLeft');
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/repro-downtown.jpg', type: 'jpeg', quality: 85 });
// Pitch the camera up: drag downward on the canvas.
async function drag(dx, dy) {
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(640 + dx, 360 + dy, { steps: 12 });
  await page.mouse.up();
}
await drag(0, 350);
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/repro-pitchup.jpg', type: 'jpeg', quality: 85 });
// Orbit to face the tower from the side.
await drag(-350, 0);
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/repro-side.jpg', type: 'jpeg', quality: 85 });
await browser.close();
console.log('done');
