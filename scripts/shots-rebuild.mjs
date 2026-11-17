// Screenshot capture for the Sunset Shores rebuild (gta6-01). Four real
// gameplay frames at 1280x720, JPEG, each checked <= 256 KiB.
// Run: node scripts/shots-rebuild.mjs
import { chromium } from 'playwright-core';
import { writeFileSync, statSync } from 'node:fs';

const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const URL = process.env.GAME_URL || 'http://localhost:8080/';
const OUT = new URL('../screenshots/', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

async function freshPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 30000 });
  await page.click('#start-btn');
  await page.waitForFunction(() => window.__game.state.screen === 'play', null, { timeout: 10000 });
  page.__errors = errors;
  page.__ctx = ctx;
  return page;
}

const ev = (page, fn, arg) => page.evaluate(fn, arg);

async function shoot(page, name) {
  await page.waitForTimeout(600);
  let quality = 82;
  let buf = await page.screenshot({ type: 'jpeg', quality });
  while (buf.length > 262144 && quality > 55) {
    quality -= 8;
    buf = await page.screenshot({ type: 'jpeg', quality });
  }
  writeFileSync(OUT + name, buf);
  console.log(`${name}: ${(buf.length / 1024).toFixed(0)} KiB quality=${quality} errors=${page.__errors.length}`);
  if (page.__errors.length) console.log('  errors:', page.__errors.slice(0, 3).join(' | '));
}

async function stealParked(page) {
  const parked = await ev(page, () => { const c = window.__game.parkedCars[0]; return { x: c.x, z: c.z }; });
  await ev(page, (p) => window.__game.teleport(p.x + 2, p.z), parked);
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__game.state.driving === true, null, { timeout: 10000 });
}

// 1-cover: Mara on the central avenue sidewalk, a patrol car closing in,
// two traffic cars, the downtown tower, HUD + minimap + Mission 1 banner.
{
  const page = await freshPage();
  await ev(page, () => { const g = window.__game; g.teleport(8, 22); g.setWanted(1); });
  // Wait until a patrol car is close and traffic is in frame.
  for (let i = 0; i < 60; i += 1) {
    const ok = await ev(page, () => {
      const g = window.__game;
      const nearCop = g.police.some((c) => Math.hypot(c.x - g.player.pos.x, c.z - g.player.pos.z) < 30);
      const nearTraffic = g.traffic.filter((c) => Math.hypot(c.x - g.player.pos.x, c.z - g.player.pos.z) < 45).length;
      return nearCop && nearTraffic >= 2;
    });
    if (ok) break;
    await page.waitForTimeout(1000);
  }
  await shoot(page, '1-cover.jpg');
  await page.__ctx.close();
}

// 2-drive: Mara driving a car down the avenue, speed + condition + minimap.
{
  const page = await freshPage();
  await stealParked(page);
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => Math.abs(window.__game.G.car.speed) > 6, null, { timeout: 20000 });
  await shoot(page, '2-drive.jpg');
  await page.keyboard.up('KeyW');
  await page.__ctx.close();
}

// 3-chase: two patrol cars flanking the stolen car, red-blue lights, >=2 stars.
{
  const page = await freshPage();
  await stealParked(page);
  await ev(page, () => window.__game.setWanted(2));
  await page.keyboard.down('KeyW');
  // Wait until two cops are close to the car.
  for (let i = 0; i < 90; i += 1) {
    const ok = await ev(page, () => {
      const g = window.__game;
      if (!g.G.car) return false;
      const near = g.police.filter((c) => Math.hypot(c.x - g.G.car.x, c.z - g.G.car.z) < 16).length;
      return g.police.length >= 2 && near >= 2 && g.state.wanted >= 2;
    });
    if (ok) break;
    // Keep the car moving away from the nearest cop so it is not cornered.
    await ev(page, () => {
      const g = window.__game;
      if (!g.G.car || !g.police.length) return;
      let near = g.police[0];
      let nd = Infinity;
      for (const c of g.police) {
        const d = Math.hypot(c.x - g.G.car.x, c.z - g.G.car.z);
        if (d < nd) { nd = d; near = c; }
      }
      if (nd < 12) {
        g.G.car.angle = Math.atan2(g.G.car.x - near.x, g.G.car.z - near.z);
      }
    });
    await page.waitForTimeout(800);
  }
  await shoot(page, '3-chase.jpg');
  await page.keyboard.up('KeyW');
  await page.__ctx.close();
}

// 4-mission: Mara on the beach near the clean yellow mission beacon.
{
  const page = await freshPage();
  await ev(page, () => window.__game.teleport(-146, 6));
  await page.waitForTimeout(1500);
  await shoot(page, '4-mission.jpg');
  await page.__ctx.close();
}

await browser.close();
console.log('done');
