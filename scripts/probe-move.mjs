// Round 3 (recorded session): revisited — this helper still serves the rebuilt game; see test-rebuild.mjs for the live checks.
// Probe: hold W for 3s and read the player's exact position via __sunset.
import { chromium } from 'playwright-core';

const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:8080/?seed=7', { waitUntil: 'load' });
await page.waitForTimeout(2500);
await page.click('#start-screen');
await page.waitForTimeout(1000);
const before = await page.evaluate(() => window.__sunset.player.position());
console.log('before:', JSON.stringify(before));
await page.keyboard.down('KeyW');
await page.waitForTimeout(3000);
await page.keyboard.up('KeyW');
await page.waitForTimeout(300);
const after = await page.evaluate(() => window.__sunset.player.position());
console.log('after:', JSON.stringify(after));
await browser.close();
