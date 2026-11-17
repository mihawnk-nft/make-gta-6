// Probe: do Playwright keyboard events reach the page's window keydown?
import { chromium } from 'playwright-core';

const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:8080/?seed=7', { waitUntil: 'load' });
await page.waitForTimeout(2000);
await page.evaluate(() => {
  window.__keys = [];
  window.addEventListener('keydown', (e) => window.__keys.push(e.code));
  window.addEventListener('keyup', (e) => window.__keys.push('up:' + e.code));
});
await page.click('#start-screen');
await page.waitForTimeout(500);
await page.keyboard.down('KeyW');
await page.waitForTimeout(800);
await page.keyboard.up('KeyW');
const keys = await page.evaluate(() => window.__keys);
console.log('keys seen:', JSON.stringify(keys));
const hud = await page.evaluate(() => document.getElementById('hud-clock').textContent);
console.log('clock:', hud);
await browser.close();
