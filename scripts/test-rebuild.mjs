// Full rebuild test suite for Sunset Shores (gta6-01). Fresh script, written
// for this rebuild. Polls live state (game time runs ~1/3 wall-clock under
// SwiftShader) and reports PASS/FAIL per check. Run: node scripts/test-rebuild.mjs
import { chromium } from 'playwright-core';

const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const URL = process.env.GAME_URL || 'http://localhost:8080/';
const results = [];
let browser;

function report(name, ok, detail) {
  results.push({ name, ok, detail: detail || '' });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

async function newPage(width = 1280, height = 720) {
  const ctx = await browser.newContext({ viewport: { width, height } });
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

async function waitFor(page, fn, timeoutMs, label) {
  try {
    await page.waitForFunction(fn, null, { timeout: timeoutMs });
    return true;
  } catch {
    console.log(`  (timeout waiting: ${label})`);
    return false;
  }
}

const ev = (page, fn, arg) => page.evaluate(fn, arg);

browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

// ---------- T1: walk + jump ----------
{
  const page = await newPage();
  const before = await ev(page, () => ({ x: window.__game.player.pos.x, z: window.__game.player.pos.z }));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyW');
  const after = await ev(page, () => ({ x: window.__game.player.pos.x, z: window.__game.player.pos.z }));
  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  report('T1 walk (W moves Mara)', moved > 2, `moved ${moved.toFixed(1)}u`);
  await page.keyboard.press('Space');
  let jumped = false;
  for (let i = 0; i < 40; i += 1) {
    const y = await ev(page, () => window.__game.player.pos.y);
    if (y > 0.2) { jumped = true; break; }
    await page.waitForTimeout(100);
  }
  report('T1 jump (Space lifts Mara)', jumped, '');
  report('T1 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T2: mission chain 1 -> 2 -> 3 ----------
{
  const page = await newPage();
  await ev(page, () => window.__game.teleport(-158, 0));
  const m1 = await waitFor(page, () => window.__game.state.missionIndex === 1 && window.__game.state.cash === 400, 20000, 'mission 1');
  report('T2 mission 1 -> cash $400', m1, await ev(page, () => `mission=${window.__game.state.missionIndex} cash=${window.__game.state.cash}`));
  // Steal a parked car.
  const parked = await ev(page, () => { const c = window.__game.parkedCars[0]; return c ? { x: c.x, z: c.z } : null; });
  await ev(page, (p) => window.__game.teleport(p.x + 2, p.z), parked);
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  const driving = await waitFor(page, () => window.__game.state.driving === true, 10000, 'enter car');
  report('T2 steal parked car -> driving', driving, await ev(page, () => `driving=${window.__game.state.driving} wanted=${window.__game.state.wanted}`));
  await ev(page, () => { const g = window.__game; g.G.car.x = 104; g.G.car.z = 88; });
  const m2 = await waitFor(page, () => window.__game.state.missionIndex === 2 && window.__game.state.cash === 700, 20000, 'mission 2');
  report('T2 mission 2 -> cash $700', m2, await ev(page, () => `mission=${window.__game.state.missionIndex} cash=${window.__game.state.cash}`));
  await ev(page, () => { const g = window.__game; g.G.car.x = -104; g.G.car.z = -88; });
  const m3 = await waitFor(page, () => window.__game.state.missionIndex === 3 && window.__game.state.cash === 1200, 20000, 'mission 3');
  report('T2 mission 3 -> cash $1200', m3, await ev(page, () => `mission=${window.__game.state.missionIndex} cash=${window.__game.state.cash}`));
  const banner = await ev(page, () => document.getElementById('hud-mission').textContent);
  report('T2 banner BEBAS after mission 3', banner.includes('BEBAS'), banner);
  report('T2 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T3: steal parked -> drive -> exit ----------
{
  const page = await newPage();
  const parked = await ev(page, () => { const c = window.__game.parkedCars[0]; return { x: c.x, z: c.z }; });
  const parkedBefore = await ev(page, () => window.__game.parkedCars.length);
  await ev(page, (p) => window.__game.teleport(p.x + 2, p.z), parked);
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await waitFor(page, () => window.__game.state.driving === true, 10000, 'enter parked car');
  const wanted = await ev(page, () => window.__game.state.wanted);
  report('T3 steal parked -> wanted 1', wanted === 1, `wanted=${wanted}`);
  const c0 = await ev(page, () => ({ x: window.__game.G.car.x, z: window.__game.G.car.z }));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(3000);
  await page.keyboard.up('KeyW');
  const c1 = await ev(page, () => ({ x: window.__game.G.car.x, z: window.__game.G.car.z, speed: window.__game.G.car.speed }));
  const drove = Math.hypot(c1.x - c0.x, c1.z - c0.z);
  report('T3 driving moves car', drove > 3, `moved ${drove.toFixed(1)}u speed=${c1.speed.toFixed(1)}`);
  await page.keyboard.press('KeyE');
  const exited = await waitFor(page, () => window.__game.state.driving === false, 10000, 'exit car');
  const parkedAfter = await ev(page, () => window.__game.parkedCars.length);
  report('T3 exit car normal, car stays parked', exited && parkedAfter === parkedBefore, `parked ${parkedBefore} -> ${parkedAfter}`);
  report('T3 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T4: steal a stopped traffic car ----------
{
  const page = await newPage();
  const before = await ev(page, () => window.__game.traffic.length);
  let stole = false;
  for (let attempt = 0; attempt < 3 && !stole; attempt += 1) {
    const t = await ev(page, () => {
      const c = window.__game.traffic[0];
      return c ? { x: c.x, z: c.z, angle: c.angle } : null;
    });
    if (!t) break;
    // Stand right in front of the moving traffic car.
    await ev(page, (tt) => window.__game.teleport(tt.x + Math.sin(tt.angle) * 4, tt.z + Math.cos(tt.angle) * 4), t);
    const stopped = await waitFor(page, () => window.__game.traffic.some((c) => c.stopped), 15000, 'traffic stops for Mara');
    if (!stopped) continue;
    await page.keyboard.press('KeyE');
    stole = await waitFor(page, () => window.__game.state.driving === true, 10000, 'steal traffic car');
  }
  const after = await ev(page, () => window.__game.traffic.length);
  report('T4 steal stopped traffic car', stole && after === before - 1, `traffic ${before} -> ${after}, driving=${await ev(page, () => window.__game.state.driving)}`);
  report('T4 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T5: punch a pedestrian ----------
{
  const page = await newPage();
  const ped = await ev(page, () => { const p = window.__game.peds[0]; return { x: p.x, z: p.z }; });
  await ev(page, (p) => window.__game.teleport(p.x + 1, p.z), ped);
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyF');
  const ok = await waitFor(page, () => window.__game.state.wanted === 1 && window.__game.peds.some((p) => p.down), 10000, 'ped down + wanted 1');
  report('T5 punch ped -> wanted 1, ped falls', ok, await ev(page, () => `wanted=${window.__game.state.wanted} down=${window.__game.peds.filter((p) => p.down).length}`));
  report('T5 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T6: BUSTED ----------
{
  const page = await newPage();
  await ev(page, () => { const g = window.__game; g.setWanted(2); g.setCash(250); });
  const cops = await waitFor(page, () => window.__game.police.length >= 1, 20000, 'police spawn');
  report('T6 police spawn on wanted 2', cops, await ev(page, () => `police=${window.__game.police.length}`));
  const busted = await waitFor(page, () => window.__game.state.screen === 'busted', 90000, 'busted screen');
  const st = await ev(page, () => ({ cash: window.__game.state.cash, wanted: window.__game.state.wanted, mission: window.__game.state.missionIndex, x: window.__game.player.pos.x, z: window.__game.player.pos.z }));
  report('T6 BUSTED -> fine $100, wanted 0, respawn', busted && st.cash === 150 && st.wanted === 0 && Math.abs(st.x) < 1 && Math.abs(st.z - 100) < 1,
    `cash=${st.cash} wanted=${st.wanted} pos=(${st.x.toFixed(1)},${st.z.toFixed(1)}) mission=${st.mission}`);
  await page.click('#busted-btn');
  const resumed = await waitFor(page, () => window.__game.state.screen === 'play', 10000, 'resume after busted');
  report('T6 continue after BUSTED', resumed, '');
  report('T6 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T8: save / load round-trip (before the slow timer test) ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 30000 });
  await page.click('#start-btn');
  await page.waitForFunction(() => window.__game.state.screen === 'play', null, { timeout: 10000 });
  await ev(page, () => { const g = window.__game; g.teleport(20, -30); g.setCash(777); g.setMission(1); });
  await ev(page, () => window.__game.save());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 30000 });
  await page.click('#start-btn');
  await page.waitForFunction(() => window.__game.state.screen === 'play', null, { timeout: 10000 });
  const st = await ev(page, () => ({ cash: window.__game.state.cash, mission: window.__game.state.missionIndex, x: window.__game.player.pos.x, z: window.__game.player.pos.z }));
  report('T8 save/load restores cash+mission+position', st.cash === 777 && st.mission === 1 && Math.abs(st.x - 20) < 0.5 && Math.abs(st.z + 30) < 0.5,
    `cash=${st.cash} mission=${st.mission} pos=(${st.x.toFixed(1)},${st.z.toFixed(1)})`);
  report('T8 no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------- T9: pause / resume / restart ----------
{
  const page = await newPage();
  await page.keyboard.press('Escape');
  const paused = await waitFor(page, () => window.__game.state.screen === 'paused', 10000, 'paused');
  report('T9 Esc pauses', paused, '');
  await page.keyboard.press('Escape');
  const resumed = await waitFor(page, () => window.__game.state.screen === 'play', 10000, 'resumed');
  report('T9 Esc resumes', resumed, '');
  await page.keyboard.press('Escape');
  await waitFor(page, () => window.__game.state.screen === 'paused', 10000, 'paused again');
  await page.click('#restart-btn');
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 30000 });
  const st = await ev(page, () => ({ screen: window.__game.state.screen, cash: window.__game.state.cash, save: window.localStorage.getItem('sunset-shores-save-v1') }));
  report('T9 restart wipes save, back to title', st.screen === 'title' && st.cash === 250 && st.save === null, `screen=${st.screen} cash=${st.cash} save=${st.save}`);
  report('T9 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T7: wanted timers (slow — small viewport for speed) ----------
// Chase phase: flee in a stolen car (teleport away if a cop gets too close,
// so the corner-bust never triggers). Then keep fleeing: once the nearest
// cop is >45u the hidden timer runs and a star drops after 20s.
{
  const page = await newPage(800, 450);
  const parked = await ev(page, () => { const c = window.__game.parkedCars[0]; return { x: c.x, z: c.z }; });
  await ev(page, (p) => window.__game.teleport(p.x + 2, p.z), parked);
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await waitFor(page, () => window.__game.state.driving === true, 10000, 'enter car for T7');
  await ev(page, () => window.__game.setWanted(1));
  await page.keyboard.down('KeyW');
  // Flee driver: steer away from the nearest cop, teleport clear if cornered.
  const flee = async () => {
    await ev(page, () => {
      const g = window.__game;
      if (!g.G.car) return;
      const cops = g.police;
      if (!cops.length) return;
      let near = cops[0];
      let nd = Infinity;
      for (const c of cops) {
        const d = Math.hypot(c.x - g.G.car.x, c.z - g.G.car.z);
        if (d < nd) { nd = d; near = c; }
      }
      if (nd < 25) {
        // Jump clear: 70u away from the cop, clamped into the world.
        const ax = g.G.car.x - near.x;
        const az = g.G.car.z - near.z;
        const len = Math.hypot(ax, az) || 1;
        g.G.car.x = Math.max(-160, Math.min(125, g.G.car.x + (ax / len) * 70));
        g.G.car.z = Math.max(-125, Math.min(125, g.G.car.z + (az / len) * 70));
      } else {
        g.G.car.angle = Math.atan2(g.G.car.x - near.x, g.G.car.z - near.z);
      }
    });
  };
  let up = false;
  for (let i = 0; i < 200; i += 1) {
    await flee();
    up = await ev(page, () => window.__game.state.wanted >= 2);
    if (up) break;
    await page.waitForTimeout(800);
  }
  report('T7 chase 30s -> wanted rises', up, await ev(page, () => `wanted=${window.__game.state.wanted} chaseTimer=${window.__game.state.chaseTimer.toFixed(1)}`));
  let down = false;
  for (let i = 0; i < 240; i += 1) {
    await flee();
    down = await ev(page, () => window.__game.state.wanted <= 1);
    if (down) break;
    await page.waitForTimeout(800);
  }
  await page.keyboard.up('KeyW');
  report('T7 hidden 20s -> wanted drops', down, await ev(page, () => `wanted=${window.__game.state.wanted} hiddenTimer=${window.__game.state.hiddenTimer.toFixed(1)}`));
  report('T7 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n==== ${results.length - failed}/${results.length} PASS ====`);
process.exit(failed ? 1 : 0);
