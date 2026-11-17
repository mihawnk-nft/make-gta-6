// Diagnostic playtest shots: live game, orbit the camera and walk a bit,
// to find the floating rooftop box reported from M1 playtesting.
import { chromium } from 'playwright-core';

const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR', m.text()); });
await page.goto('http://localhost:8080/?seed=7', { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.click('#start-screen');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/diag-spawn.jpg', type: 'jpeg', quality: 85 });

// Orbit the camera around (drag right-to-left) and shoot again.
async function drag(dx) {
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(640 + dx, 360, { steps: 12 });
  await page.mouse.up();
}
await drag(-400);
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/diag-orbit1.jpg', type: 'jpeg', quality: 85 });
await drag(-400);
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/diag-orbit2.jpg', type: 'jpeg', quality: 85 });

// Walk forward (downtown) for 5 seconds, then shoot.
await drag(800);
await page.keyboard.down('KeyW');
await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(5000);
await page.keyboard.up('KeyW');
await page.keyboard.up('ShiftLeft');
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/diag-downtown.jpg', type: 'jpeg', quality: 85 });
await browser.close();
console.log('done');
