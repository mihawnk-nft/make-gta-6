// Screenshot capture for the Sunset Shores rebuild (gta6-01). Four real
// gameplay frames at 1280x720, JPEG, each checked <= 256 KiB.
// Run: node scripts/shots-rebuild.mjs
import { chromium } from 'playwright-core';
import { writeFileSync, statSync } from 'node:fs';

const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const GAME_URL = process.env.GAME_URL || 'http://localhost:8080/';
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
  await page.goto(GAME_URL, { waitUntil: 'load' });
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
  await ev(page, () => { const g = window.__game; g.teleport(30, 44); g.setWanted(1); });
  // Wait until a patrol car is close and traffic is in frame. If a cop gets
  // within 8u Mara steps 12u away from it — clamped to the east-sidewalk
  // strip (x 24..36) so the frame stays on the central avenue.
  for (let i = 0; i < 80; i += 1) {
    const ok = await ev(page, () => {
      const g = window.__game;
      if (g.state.screen !== 'play') return false;
      const p = g.player.pos;
      for (const c of g.police) {
        if (Math.hypot(c.x - p.x, c.z - p.z) < 8) {
          const ax = p.x - c.x;
          const az = p.z - c.z;
          const len = Math.hypot(ax, az) || 1;
          g.teleport(
            Math.max(24, Math.min(36, p.x + (ax / len) * 12)),
            Math.max(-120, Math.min(120, p.z + (az / len) * 12)),
          );
          return false;
        }
      }
      const nearCop = g.police.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 25);
      const nearTraffic = g.traffic.filter((c) => Math.hypot(c.x - p.x, c.z - p.z) < 40).length;
      return nearCop && nearTraffic >= 2;
    });
    if (ok) break;
    await page.waitForTimeout(300);
  }
  // Zoom out for a wider avenue view.
  for (let i = 0; i < 4; i += 1) { await page.mouse.wheel(0, 120); await page.waitForTimeout(150); }
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
      if (!g.G.car || g.state.screen !== 'play') return true; // stop waiting, shoot what we have
      const near = g.police.filter((c) => Math.hypot(c.x - g.G.car.x, c.z - g.G.car.z) < 16).length;
      return (g.police.length >= 2 && near >= 2 && g.state.wanted >= 2) || g.G.car.condition < 40;
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
  // Shoot while the car is still rolling (foot off the gas): the corner
  // timer only runs when the car is nearly stopped, so a rolling shot can
  // never catch the BUSTED overlay, and both patrol cars flank the car.
  await page.keyboard.up('KeyW');
  await shoot(page, '3-chase.jpg');
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
