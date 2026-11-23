// Round 3 (recorded session): revisited — this helper still serves the rebuilt game; see test-rebuild.mjs for the live checks.
// Smoke test for the Sunset Shores rebuild: loads the game, starts it,
// polls live state, and reports console errors. Run: node scripts/smoke.mjs
import { chromium } from 'playwright-core';

const exe = process.env.CHROMIUM_EXE || '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const url = process.env.GAME_URL || 'http://localhost:8080/';

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 20000 });
console.log('game ready');
await page.click('#start-btn');
await page.waitForTimeout(3000);
const st = await page.evaluate(() => {
  const g = window.__game;
  return {
    screen: g.state.screen, cash: g.state.cash, wanted: g.state.wanted,
    mission: g.state.missionIndex, health: g.state.health,
    px: g.player.pos.x, pz: g.player.pos.z,
    traffic: g.traffic.length, peds: g.peds.length, parked: g.parkedCars.length,
    audioStarted: g.audio.started, banner: document.getElementById('hud-mission').textContent,
  };
});
console.log(JSON.stringify(st, null, 2));
console.log('console errors:', errors.length);
for (const e of errors.slice(0, 10)) console.log('  ERR:', e);
await browser.close();
process.exit(errors.length ? 1 : 0);
