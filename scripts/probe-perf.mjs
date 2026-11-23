// Quick perf probe: T1 walk distance + T3 drive distance + approx FPS.
import { chromium } from 'playwright-core';

const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:8080/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 30000 });
await page.click('#start-btn');
await page.waitForFunction(() => window.__game.state.screen === 'play', null, { timeout: 10000 });
// FPS over 5s.
const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0;
  const t0 = performance.now();
  const tick = () => { n += 1; if (performance.now() - t0 < 5000) requestAnimationFrame(tick); else res(n / 5); };
  requestAnimationFrame(tick);
}));
console.log('FPS ~', fps.toFixed(1));
const before = await page.evaluate(() => ({ x: window.__game.player.pos.x, z: window.__game.player.pos.z }));
await page.keyboard.down('KeyW');
await page.waitForTimeout(2500);
await page.keyboard.up('KeyW');
const after = await page.evaluate(() => ({ x: window.__game.player.pos.x, z: window.__game.player.pos.z }));
console.log('T1 walk moved', Math.hypot(after.x - before.x, after.z - before.z).toFixed(1), 'u (need > 2)');
// Drive check.
const parked = await page.evaluate(() => { const c = window.__game.parkedCars[0]; return { x: c.x, z: c.z }; });
await page.evaluate((p) => window.__game.teleport(p.x + 2, p.z), parked);
await page.waitForTimeout(300);
await page.keyboard.press('KeyE');
await page.waitForFunction(() => window.__game.state.driving === true, null, { timeout: 10000 });
const c0 = await page.evaluate(() => ({ x: window.__game.G.car.x, z: window.__game.G.car.z }));
await page.keyboard.down('KeyW');
await page.waitForTimeout(3000);
await page.keyboard.up('KeyW');
const c1 = await page.evaluate(() => ({ x: window.__game.G.car.x, z: window.__game.G.car.z, speed: window.__game.G.car.speed }));
console.log('T3 drive moved', Math.hypot(c1.x - c0.x, c1.z - c0.z).toFixed(1), 'u speed', c1.speed.toFixed(1), '(need > 3)');
// Round 3 additions (written in-session): also probe the new systems —
// rank text, radio state, crew size and the side-job beacon — so a perf
// regression in any of them shows up next to the FPS number.
const extra = await page.evaluate(() => {
  const g = window.__game;
  return {
    rank: document.getElementById('hud-rank').textContent,
    district: document.getElementById('hud-district-text').textContent,
    crew: g.crew.length,
    sidejob: g.G.sidejob.district,
    radio: g.radio,
    weapon: g.weapon,
  };
});
console.log('round3:', JSON.stringify(extra));
console.log('errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
