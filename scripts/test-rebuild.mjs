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

async function waitFor(page, fn, timeoutMs, label, arg) {
  try {
    await page.waitForFunction(fn, arg ?? null, { timeout: timeoutMs });
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

// ---------- T2: mission chain 1 -> 8 ----------
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
  const driveTo = async (x, z, mission, cash, label) => {
    await ev(page, (t) => { const g = window.__game; g.G.car.x = t.x; g.G.car.z = t.z; }, { x, z });
    const ok = await waitFor(page, (t) => window.__game.state.missionIndex === t.mission && window.__game.state.cash === t.cash, 20000, label, { mission, cash });
    report(label, ok, await ev(page, () => `mission=${window.__game.state.missionIndex} cash=${window.__game.state.cash}`));
  };
  await driveTo(104, 88, 2, 700, 'T2 mission 2 -> cash $700');
  await driveTo(-104, -88, 3, 1200, 'T2 mission 3 -> cash $1200');
  await driveTo(88, -104, 4, 1800, 'T2 mission 4 -> cash $1800');
  await driveTo(-44, 44, 5, 2500, 'T2 mission 5 -> cash $2500');
  await driveTo(22, -110, 6, 3400, 'T2 mission 6 -> cash $3400');
  await driveTo(-110, 110, 7, 4500, 'T2 mission 7 -> cash $4500');
  await driveTo(110, -22, 8, 6000, 'T2 mission 8 -> cash $6000');
  await driveTo(66, 66, 9, 7500, 'T2 mission 9 -> cash $7500');
  await driveTo(-22, -66, 10, 10000, 'T2 mission 10 -> cash $10000');
  const banner = await ev(page, () => document.getElementById('hud-mission').textContent);
  report('T2 banner BEBAS after mission 10', banner.includes('BEBAS'), banner);
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
// The car moves fast in wall-time now (16 sim steps/frame), so a position
// read goes stale in one evaluate round-trip: re-read fresh and re-place
// Mara ahead of the car until it stops for her.
{
  const page = await newPage();
  const before = await ev(page, () => window.__game.traffic.length);
  let stole = false;
  for (let attempt = 0; attempt < 10 && !stole; attempt += 1) {
    const t = await ev(page, () => {
      const c = window.__game.traffic[0];
      return c ? { x: c.x, z: c.z, angle: c.angle } : null;
    });
    if (!t) break;
    await ev(page, (tt) => window.__game.teleport(tt.x + Math.sin(tt.angle) * 5, tt.z + Math.cos(tt.angle) * 5), t);
    const stopped = await waitFor(page, () => window.__game.traffic.some((c) => c.stopped), 4000, 'traffic stops for Mara');
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
  if (busted) {
    await page.click('#busted-btn');
    const resumed = await waitFor(page, () => window.__game.state.screen === 'play', 10000, 'resume after busted');
    report('T6 continue after BUSTED', resumed, '');
  } else {
    report('T6 continue after BUSTED', false, 'never busted, nothing to resume');
  }
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
// On foot: dodge the cop (jump clear whenever it gets within 8u, so the
// corner-bust never triggers) while the chase timer runs; then keep jumping
// clear whenever a cop gets within 50u, so the hidden timer can drop a star.
{
  const page = await newPage(800, 450);
  await ev(page, () => window.__game.setWanted(1));
  const dodge = async (minDist, jump) => {
    await ev(page, (cfg) => {
      const g = window.__game;
      const p = g.player.pos;
      if (!g.police.length) return;
      let near = g.police[0];
      let nd = Infinity;
      for (const c of g.police) {
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < nd) { nd = d; near = c; }
      }
      if (nd < cfg.minDist) {
        const ax = p.x - near.x;
        const az = p.z - near.z;
        const len = Math.hypot(ax, az) || 1;
        g.teleport(
          Math.max(-160, Math.min(125, p.x + (ax / len) * cfg.jump)),
          Math.max(-125, Math.min(125, p.z + (az / len) * cfg.jump)),
        );
      }
    }, { minDist, jump });
  };
  let up = false;
  for (let i = 0; i < 200; i += 1) {
    await dodge(8, 20);
    up = await ev(page, () => window.__game.state.wanted >= 2);
    if (up) break;
    await page.waitForTimeout(800);
  }
  report('T7 chase 30s -> wanted rises', up, await ev(page, () => `wanted=${window.__game.state.wanted} chaseTimer=${window.__game.state.chaseTimer.toFixed(1)}`));
  let down = false;
  for (let i = 0; i < 240; i += 1) {
    await dodge(50, 70);
    down = await ev(page, () => window.__game.state.wanted <= 1);
    if (down) break;
    await page.waitForTimeout(800);
  }
  report('T7 hidden 20s -> wanted drops', down, await ev(page, () => `wanted=${window.__game.state.wanted} hiddenTimer=${window.__game.state.hiddenTimer.toFixed(1)}`));
  report('T7 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T10: weapon wheel (Q cycle, 1-4 select, pistol shoots a ped) ----------
{
  const page = await newPage();
  await page.keyboard.press('KeyQ');
  const w1 = await waitFor(page, () => window.__game.weapon === 1, 5000, 'Q -> pistol');
  report('T10 Q cycles fists -> pistol', w1, await ev(page, () => `weapon=${window.__game.weapon}`));
  await page.keyboard.press('Digit4');
  const w4 = await waitFor(page, () => window.__game.weapon === 3, 5000, 'Digit4 -> shotgun');
  report('T10 Digit4 selects shotgun', w4, await ev(page, () => `weapon=${window.__game.weapon}`));
  const slotActive = await ev(page, () => document.getElementById('weapon-3').classList.contains('active'));
  report('T10 HUD weapon slot highlights shotgun', slotActive, '');
  // Rank 1 cannot equip the molotov (Rank 3) — the wheel refuses.
  await page.keyboard.press('Digit8');
  await page.waitForTimeout(800);
  const stillShotgun = await ev(page, () => window.__game.weapon === 3);
  report('T10 Digit8 blocked at Rank 1 (molotov needs Rank 3)', stillShotgun, await ev(page, () => `weapon=${window.__game.weapon}`));
  await ev(page, () => window.__game.setRP(800));
  await page.keyboard.press('Digit8');
  const w8 = await waitFor(page, () => window.__game.weapon === 7, 5000, 'Digit8 -> molotov');
  report('T10 Digit8 selects molotov at Rank 3 (8 weapons)', w8, await ev(page, () => `weapon=${window.__game.weapon}`));
  await page.keyboard.press('Digit7');
  const w7 = await waitFor(page, () => window.__game.weapon === 6, 5000, 'Digit7 -> RPG');
  report('T10 Digit7 selects RPG', w7, await ev(page, () => `weapon=${window.__game.weapon}`));
  await page.keyboard.press('Digit2');
  await waitFor(page, () => window.__game.weapon === 1, 5000, 'Digit2 -> pistol');
  const ped = await ev(page, () => { const p = window.__game.peds.find((pp) => !pp.down); return { x: p.x, z: p.z }; });
  await ev(page, (p) => {
    const g = window.__game;
    const px = p.x;
    const pz = p.z + 5;
    g.teleport(px, pz);
    g.G.player.heading = Math.atan2(p.x - px, p.z - pz);
  }, ped);
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyF');
  const shot = await waitFor(page, () => window.__game.state.wanted === 1 && window.__game.peds.some((p) => p.down), 10000, 'pistol shot downs ped');
  report('T10 pistol shot -> wanted 1, ped falls', shot, await ev(page, () => `wanted=${window.__game.state.wanted} down=${window.__game.peds.filter((p) => p.down).length}`));
  report('T10 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T11: Air-1 heli at wanted 3, roadblock at wanted 4, both clear below 3 ----------
{
  const page = await newPage(800, 450);
  const dodge = async () => {
    await ev(page, () => {
      const g = window.__game;
      const p = g.player.pos;
      if (!g.police.length) return;
      let near = g.police[0];
      let nd = Infinity;
      for (const c of g.police) {
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < nd) { nd = d; near = c; }
      }
      if (nd < 15) {
        const ax = p.x - near.x;
        const az = p.z - near.z;
        const len = Math.hypot(ax, az) || 1;
        g.teleport(
          Math.max(-160, Math.min(125, p.x + (ax / len) * 25)),
          Math.max(-125, Math.min(125, p.z + (az / len) * 25)),
        );
      }
    });
  };
  const pollWhileDodging = async (fn, tries) => {
    for (let i = 0; i < tries; i += 1) {
      await dodge();
      if (await ev(page, fn)) return true;
      await page.waitForTimeout(500);
    }
    return false;
  };
  await ev(page, () => window.__game.setWanted(3));
  const heli = await pollWhileDodging(() => !!window.__game.heli, 30);
  report('T11 Air-1 spawns at wanted 3', heli, await ev(page, () => `heli=${!!window.__game.heli}`));
  const badge = await ev(page, () => !document.getElementById('hud-heli').classList.contains('hidden'));
  report('T11 heli badge shows', badge, '');
  await ev(page, () => window.__game.setWanted(4));
  const rb = await pollWhileDodging(() => window.__game.roadblocks.length === 2, 30);
  report('T11 roadblock forms at wanted 4', rb, await ev(page, () => `roadblocks=${window.__game.roadblocks.length}`));
  await ev(page, () => window.__game.setWanted(2));
  const gone = await pollWhileDodging(() => !window.__game.heli && window.__game.roadblocks.length === 0, 30);
  report('T11 heli + roadblock clear below wanted 3', gone, await ev(page, () => `heli=${!!window.__game.heli} roadblocks=${window.__game.roadblocks.length}`));
  report('T11 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T12: cheat codes (direct + typed) ----------
{
  const page = await newPage();
  await ev(page, () => window.__game.setWanted(3));
  await page.waitForTimeout(500);
  const cashBefore = await ev(page, () => window.__game.state.cash);
  await ev(page, () => window.__game.cheat('DUITBANYAK'));
  const cashAfter = await ev(page, () => window.__game.state.cash);
  report('T12 cheat DUITBANYAK -> +$5000', cashAfter === cashBefore + 5000, `cash ${cashBefore} -> ${cashAfter}`);
  await ev(page, () => window.__game.cheat('SEHATSELALU'));
  const armor = await ev(page, () => ({ health: window.__game.state.health, armor: window.__game.state.armor }));
  report('T12 cheat SEHATSELALU -> health+armor 100', armor.health === 100 && armor.armor === 100, `health=${armor.health} armor=${armor.armor}`);
  await ev(page, () => window.__game.cheat('BEBASPOLISI'));
  const wanted = await ev(page, () => window.__game.state.wanted);
  report('T12 cheat BEBASPOLISI -> wanted 0', wanted === 0, `wanted=${wanted}`);
  await ev(page, () => window.__game.cheat('SENJATALENGKAP'));
  const weapon = await ev(page, () => window.__game.weapon);
  report('T12 cheat SENJATALENGKAP -> RPG equipped', weapon === 6, `weapon=${weapon}`);
  // Typed live, the GTA way: MOBILMEWAH spawns a supercar nearby.
  await page.keyboard.type('MOBILMEWAH');
  const spawned = await waitFor(page, () => window.__game.parkedCars.some((c) => c.style === 'supercar'), 8000, 'typed MOBILMEWAH spawns supercar');
  report('T12 typed MOBILMEWAH spawns supercar', spawned, await ev(page, () => `supercars=${window.__game.parkedCars.filter((c) => c.style === 'supercar').length}`));
  const cheatList = await ev(page, () => window.__game.cheats.join(','));
  report('T12 cheat list exposed (5 codes)', cheatList.split(',').length === 5, cheatList);
  report('T12 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T13: luxury car stealable, faster than a normal car ----------
{
  const page = await newPage();
  const spot = await ev(page, () => { const c = window.__game.parkedCars.find((cc) => cc.style === 'supercar'); return c ? { x: c.x, z: c.z, name: c.name, value: c.value } : null; });
  report('T13 supercar parked in town', !!spot, spot ? `${spot.name} $${spot.value}` : 'none found');
  if (spot) {
    await ev(page, (p) => window.__game.teleport(p.x + 2, p.z), spot);
    await page.waitForTimeout(300);
    // Rank 1 cannot drive a supercar (needs Rank 2).
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(1500);
    const refused = await ev(page, () => window.__game.state.driving === false);
    report('T13 supercar refused at Rank 1', refused, await ev(page, () => `driving=${window.__game.state.driving} rank=${window.__game.rank}`));
    await ev(page, () => window.__game.setRP(300));
    await page.keyboard.press('KeyE');
    const driving = await waitFor(page, () => window.__game.state.driving === true, 10000, 'steal supercar');
    const st = await ev(page, () => ({ style: window.__game.G.car.style, maxSpeed: window.__game.G.car.maxSpeed, name: window.__game.G.car.name }));
    report('T13 steal supercar at Rank 2 -> driving, maxSpeed 38', driving && st.style === 'supercar' && st.maxSpeed === 38, `${st.name} style=${st.style} maxSpeed=${st.maxSpeed}`);
    const hudName = await ev(page, () => document.getElementById('hud-car-name').textContent);
    report('T13 HUD shows luxury value', hudName.includes('$85,000'), hudName);
  } else {
    report('T13 supercar refused at Rank 1', false, 'no supercar spawned');
    report('T13 steal supercar at Rank 2 -> driving, maxSpeed 38', false, 'no supercar spawned');
    report('T13 HUD shows luxury value', false, 'no supercar spawned');
  }
  report('T13 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T14: HD rendering settings ----------
{
  const page = await newPage();
  const hd = await ev(page, () => {
    const r = window.__game.renderer;
    return { shadows: r.shadowMap.enabled, type: r.shadowMap.type, tone: r.toneMapping, dpr: r.getPixelRatio() };
  });
  // ACESFilmicToneMapping = 4, PCFSoftShadowMap = 2.
  report('T14 ACES tone mapping + soft shadows on', hd.shadows && hd.type === 2 && hd.tone === 4, `shadows=${hd.shadows} type=${hd.type} tone=${hd.tone} dpr=${hd.dpr}`);
  const sky = await ev(page, () => {
    const g = window.__game.G;
    return { fog: !!g.scene.fog, lights: g.scene.children.filter((o) => o.isLight).length };
  });
  report('T14 fog + lights present', sky.fog && sky.lights >= 3, `fog=${sky.fog} lights=${sky.lights}`);
  report('T14 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T15: rank, acts, mission card ----------
{
  const page = await newPage();
  const act = await ev(page, () => document.getElementById('hud-act').textContent);
  report('T15 mission card shows Babak 1, Misi 1/10', act.includes('Babak 1') && act.includes('Misi 1/10'), act);
  const rankLabel = await ev(page, () => document.getElementById('hud-rank').textContent);
  report('T15 HUD rank starts at Rank 1 Pemula', rankLabel.includes('Rank 1') && rankLabel.includes('Pemula'), rankLabel);
  // Rifle (Rank 2) is locked at Rank 1.
  await page.keyboard.press('Digit5');
  await page.waitForTimeout(800);
  const locked = await ev(page, () => window.__game.weapon === 0);
  report('T15 rifle locked at Rank 1', locked, await ev(page, () => `weapon=${window.__game.weapon}`));
  await ev(page, () => window.__game.setRP(300));
  const rank2 = await ev(page, () => document.getElementById('hud-rank').textContent);
  report('T15 setRP(300) -> Rank 2 Jalanan', rank2.includes('Rank 2') && rank2.includes('Jalanan'), rank2);
  await page.keyboard.press('Digit5');
  const rifle = await waitFor(page, () => window.__game.weapon === 4, 5000, 'Digit5 -> rifle at Rank 2');
  report('T15 rifle unlocks at Rank 2', rifle, await ev(page, () => `weapon=${window.__game.weapon}`));
  // Finishing mission 1 pays +100 RP (on top of the 300 set above).
  await ev(page, () => window.__game.teleport(-158, 0));
  const m1 = await waitFor(page, () => window.__game.state.missionIndex === 1, 20000, 'mission 1 done');
  const rp = await ev(page, () => window.__game.rp);
  report('T15 mission 1 -> +100 RP', m1 && rp === 400, `mission=${await ev(page, () => window.__game.state.missionIndex)} rp=${rp}`);
  const act2 = await ev(page, () => document.getElementById('hud-act').textContent);
  report('T15 mission card advances to Misi 2/10', act2.includes('Misi 2/10'), act2);
  report('T15 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T16: crew abilities (Rex / Dex / Maya) ----------
// Rex first, while the streets are still quiet: no cops, no bust risk.
{
  const page = await newPage();
  const dodge = async () => {
    await ev(page, () => {
      const g = window.__game;
      const p = g.player.pos;
      if (!g.police.length) return;
      let near = g.police[0];
      let nd = Infinity;
      for (const c of g.police) {
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < nd) { nd = d; near = c; }
      }
      if (nd < 15) {
        const ax = p.x - near.x;
        const az = p.z - near.z;
        const len = Math.hypot(ax, az) || 1;
        g.teleport(
          Math.max(-160, Math.min(125, p.x + (ax / len) * 25)),
          Math.max(-125, Math.min(125, p.z + (az / len) * 25)),
        );
      }
    });
  };
  // Rex is locked at Rank 1, unlocks at Rank 2.
  const before = await ev(page, () => window.__game.parkedCars.length);
  await page.keyboard.press('KeyC');
  await page.waitForTimeout(1200);
  const rexLocked = (await ev(page, () => window.__game.parkedCars.length)) === before;
  report('T16 Rex (C) locked at Rank 1', rexLocked, `parked=${before}`);
  await ev(page, () => window.__game.setRP(300));
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyC');
  const rex = await waitFor(page, (t) => window.__game.parkedCars.length === t, 8000, 'Rex sends getaway car', before + 1);
  report('T16 Rex (C) sends getaway car at Rank 2', rex, await ev(page, () => `parked=${window.__game.parkedCars.length}`));
  // Dex clears one star.
  await ev(page, () => window.__game.setWanted(2));
  await waitFor(page, () => window.__game.police.length >= 1, 15000, 'police spawn');
  await page.keyboard.press('KeyZ');
  const dexed = await waitFor(page, () => window.__game.state.wanted === 1, 8000, 'Dex clears a star');
  report('T16 Dex (Z) clears 1 wanted star', dexed, await ev(page, () => `wanted=${window.__game.state.wanted}`));
  await dodge();
  await page.keyboard.press('KeyZ');
  await page.waitForTimeout(1200);
  const stillOne = await ev(page, () => window.__game.state.wanted === 1);
  report('T16 Dex on cooldown does nothing twice', stillOne, await ev(page, () => `wanted=${window.__game.state.wanted}`));
  // Maya repairs the car to 100%.
  const parked = await ev(page, () => { const c = window.__game.parkedCars[0]; return { x: c.x, z: c.z }; });
  await ev(page, (p) => window.__game.teleport(p.x + 2, p.z), parked);
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await waitFor(page, () => window.__game.state.driving === true, 10000, 'enter car');
  await ev(page, () => { window.__game.G.car.condition = 40; });
  await page.keyboard.press('KeyX');
  const repaired = await waitFor(page, () => window.__game.G.car.condition === 100, 8000, 'Maya repairs');
  report('T16 Maya (X) repairs car to 100%', repaired, await ev(page, () => `condition=${window.__game.G.car.condition}`));
  const loyalty = await ev(page, () => window.__game.crew.map((m) => m.loyalty).join(','));
  report('T16 crew exposed with loyalty', loyalty.split(',').length === 3, loyalty);
  report('T16 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T17: phone hub + minimap waypoint ----------
{
  const page = await newPage();
  await page.keyboard.press('KeyP');
  const open = await waitFor(page, () => !document.getElementById('phone').classList.contains('hidden'), 5000, 'phone opens');
  report('T17 P opens the phone', open, '');
  await page.click('#phone-tabs button[data-tab="Crew"]');
  const crewTab = await ev(page, () => document.getElementById('phone-body').textContent);
  report('T17 phone Crew tab lists Dex/Maya/Rex', crewTab.includes('Dex') && crewTab.includes('Maya') && crewTab.includes('Rex'), crewTab.slice(0, 80));
  await page.click('#phone-tabs button[data-tab="Bank"]');
  const bankTab = await ev(page, () => document.getElementById('phone-body').textContent);
  report('T17 phone Bank tab shows completion %', bankTab.includes('Penyelesaian'), bankTab.slice(0, 80));
  await page.click('#phone-tabs button[data-tab="Map"]');
  const mapTab = await ev(page, () => document.getElementById('phone-body').textContent);
  report('T17 phone Map tab lists 7 districts', ['Pantai Sunset', 'Dermaga', 'Kota Tua', 'Pusat Kota', 'Marina', 'Pelabuhan', 'Bukit Timur'].every((d) => mapTab.includes(d)), '');
  await page.keyboard.press('KeyP');
  const closed = await waitFor(page, () => document.getElementById('phone').classList.contains('hidden'), 5000, 'phone closes');
  report('T17 P closes the phone', closed, '');
  // Minimap click drops a waypoint.
  const box = await ev(page, () => { const r = document.getElementById('minimap').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.mouse.click(box.x + box.w * 0.5, box.y + box.h * 0.5);
  const wp = await ev(page, () => window.__game.G.state.waypoint);
  report('T17 minimap click sets waypoint', !!wp, wp ? `(${wp.x.toFixed(0)}, ${wp.z.toFixed(0)})` : 'none');
  report('T17 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T18: districts + side job ----------
{
  const page = await newPage();
  const district = await ev(page, () => document.getElementById('hud-district-text').textContent);
  report('T18 HUD shows district + standing', district.includes('—') && /\((\d+)\)/.test(district), district);
  const job = await ev(page, () => { const j = window.__game.G.sidejob; return { x: j.target.x, z: j.target.z, d: j.district }; });
  const before = await ev(page, (d) => ({ cash: window.__game.state.cash, standing: window.__game.state.districtStanding[d] ?? 30 }), job.d);
  await ev(page, (t) => window.__game.teleport(t.x, t.z), job);
  const done = await waitFor(page, () => window.__game.state.stats.sideJobsDone === 1, 15000, 'side job done');
  const after = await ev(page, (d) => ({ cash: window.__game.state.cash, standing: window.__game.state.districtStanding[d] ?? 30 }), job.d);
  report('T18 side job pays +$150 and raises district standing', done && after.cash === before.cash + 150 && after.standing === before.standing + 20,
    `cash ${before.cash} -> ${after.cash}, ${job.d} standing ${before.standing} -> ${after.standing}`);
  const sidejobLine = await ev(page, () => document.getElementById('hud-sidejob').textContent);
  report('T18 HUD shows next side job', sidejobLine.includes('Side job:'), sidejobLine);
  report('T18 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T19: radio stations (R cycles 3 stations) ----------
{
  const page = await newPage();
  await page.keyboard.press('KeyR');
  const s1 = await waitFor(page, () => window.__game.radio === 'Sunset FM', 5000, 'radio Sunset FM');
  report('T19 R -> Sunset FM', s1, await ev(page, () => window.__game.radio));
  const label = await ev(page, () => document.getElementById('hud-radio').textContent);
  report('T19 HUD shows radio station', label.includes('Sunset FM'), label);
  await page.keyboard.press('KeyR');
  const s2 = await waitFor(page, () => window.__game.radio === 'Turbo FM', 5000, 'radio Turbo FM');
  report('T19 R -> Turbo FM', s2, await ev(page, () => window.__game.radio));
  await page.keyboard.press('KeyR');
  const s3 = await waitFor(page, () => window.__game.radio === 'Neon Nights', 5000, 'radio Neon Nights');
  report('T19 R -> Neon Nights', s3, await ev(page, () => window.__game.radio));
  await page.keyboard.press('KeyR');
  const off = await waitFor(page, () => window.__game.radio === '', 5000, 'radio off');
  report('T19 R -> radio off', off, await ev(page, () => `radio='${window.__game.radio}'`));
  report('T19 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T20: Rank 3 name + sniper unlock (added in-session, round 3) ----------
{
  const page = await newPage();
  await ev(page, () => window.__game.setRP(800));
  const rank3 = await ev(page, () => document.getElementById('hud-rank').textContent);
  report('T20 setRP(800) -> Rank 3 Legenda Senja', rank3.includes('Rank 3') && rank3.includes('Legenda Senja'), rank3);
  await page.keyboard.press('Digit6');
  const w6 = await waitFor(page, () => window.__game.weapon === 5, 5000, 'Digit6 -> sniper');
  report('T20 Digit6 selects sniper at Rank 3', w6, await ev(page, () => `weapon=${window.__game.weapon}`));
  // SMG fires: ammo drops from 30.
  await page.keyboard.press('Digit3');
  await waitFor(page, () => window.__game.weapon === 2, 5000, 'Digit3 -> SMG');
  const ammoBefore = await ev(page, () => document.getElementById('weapon-2').textContent);
  const ped = await ev(page, () => { const p = window.__game.peds.find((pp) => !pp.down); return { x: p.x, z: p.z }; });
  await ev(page, (p) => {
    const g = window.__game;
    g.teleport(p.x, p.z + 5);
    g.G.player.heading = Math.atan2(p.x - p.x, p.z - (p.z + 5));
  }, ped);
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(500);
  const ammoAfter = await ev(page, () => document.getElementById('weapon-2').textContent);
  report('T20 SMG shot spends ammo', ammoBefore !== ammoAfter, `${ammoBefore} -> ${ammoAfter}`);
  report('T20 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T21: side job pays +25 RP and flips the district to NEUTRAL ----------
{
  const page = await newPage();
  const job = await ev(page, () => { const j = window.__game.G.sidejob; return { x: j.target.x, z: j.target.z, d: j.district }; });
  const rpBefore = await ev(page, () => window.__game.rp);
  await ev(page, (t) => window.__game.teleport(t.x, t.z), job);
  const done = await waitFor(page, () => window.__game.state.stats.sideJobsDone === 1, 15000, 'side job done');
  const rpAfter = await ev(page, () => window.__game.rp);
  report('T21 side job pays +25 RP', done && rpAfter === rpBefore + 25, `rp ${rpBefore} -> ${rpAfter}`);
  const district = await ev(page, () => document.getElementById('hud-district-text').textContent);
  report('T21 district flips to NEUTRAL (50) after the job', district.includes('NEUTRAL') && district.includes('(50)'), district);
  report('T21 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T22: save slot 2 + phone Garage tab ----------
{
  const page = await newPage();
  await ev(page, () => { const g = window.__game; g.setCash(1234); g.save(2); });
  const slot2 = await ev(page, () => window.localStorage.getItem('sunset-shores-save-v2'));
  report('T22 save(2) writes slot 2', !!slot2 && JSON.parse(slot2).cash === 1234, slot2 ? `cash=${JSON.parse(slot2).cash}` : 'empty');
  await page.keyboard.press('KeyP');
  await waitFor(page, () => !document.getElementById('phone').classList.contains('hidden'), 5000, 'phone opens');
  await page.click('#phone-tabs button[data-tab="Garage"]');
  const garage = await ev(page, () => document.getElementById('phone-body').textContent);
  report('T22 phone Garage tab renders', garage.includes('Garage') || garage.includes('Garasi'), garage.slice(0, 60));
  await page.click('#phone-tabs button[data-tab="Texts"]');
  const texts = await ev(page, () => document.getElementById('phone-body').textContent);
  report('T22 phone Texts tab lists cheat codes', texts.includes('DUITBANYAK') && texts.includes('MOBILMEWAH'), texts.slice(0, 60));
  await page.keyboard.press('KeyP');
  report('T22 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

// ---------- T23: weapon wheel Tab toggle + right-click aim narrows FOV ----------
{
  const page = await newPage();
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);
  const expanded = await ev(page, () => document.getElementById('weapon-wheel').classList.contains('expanded'));
  report('T23 Tab expands the weapon wheel', expanded, '');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);
  const collapsed = await ev(page, () => !document.getElementById('weapon-wheel').classList.contains('expanded'));
  report('T23 Tab again collapses the wheel', collapsed, '');
  const fovBefore = await ev(page, () => window.__game.G.camera.fov);
  await page.mouse.move(640, 360);
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(900);
  const fovAimed = await ev(page, () => window.__game.G.camera.fov);
  await page.mouse.up({ button: 'right' });
  report('T23 right-click aim narrows FOV', fovAimed < fovBefore - 5, `fov ${fovBefore.toFixed(1)} -> ${fovAimed.toFixed(1)}`);
  report('T23 no console errors', page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));
  await page.__ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n==== ${results.length - failed}/${results.length} PASS ====`);
process.exit(failed ? 1 : 0);
