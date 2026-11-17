// M2 end-to-end checks in the live game (not staged shots). The VM's
// SwiftShader renders at ~1 fps, so game time runs at ~1/4 wall time:
// every wait polls live state instead of sleeping a fixed duration.
import { chromium } from 'playwright-core';

const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });

const results = {};
function report(name, ok, detail) {
  results[name] = { ok, detail };
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
}

async function newGame() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto('http://localhost:8080/?seed=7', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.click('#start-screen');
  await page.waitForTimeout(800);
  return { ctx, page };
}

// Drag the mouse to rotate the camera by `deltaYaw` radians (tracked by
// the caller, since the game exposes no camera yaw). One drag moves at
// most 500 px; larger turns are split into several drags. Few steps: each
// pointermove costs a slow SwiftShader frame in this VM.
async function turnBy(page, deltaYaw) {
  let remaining = deltaYaw;
  while (Math.abs(remaining) > 0.01) {
    const step = Math.max(-500, Math.min(500, -remaining / 0.005));
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.mouse.move(640 + step, 360, { steps: 2 });
    await page.mouse.up();
    remaining -= -step * 0.005;
    await page.waitForTimeout(150);
  }
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Run toward a target point, re-aiming the camera as the player moves.
// `stopWhen` reads live state and returns true when the goal is met.
// The keys are released while turning: a turn costs seconds of wall time
// in this VM, and holding W through it would run Mara far off course.
async function runTo(page, target, stopWhen, timeoutMs, label) {
  let yaw = -Math.PI / 2; // camera starts facing +x (downtown)
  let keys = false;
  let shifted = false;
  const pressRun = async (shift) => {
    if (!keys) { await page.keyboard.down('KeyW'); keys = true; }
    if (shift && !shifted) { await page.keyboard.down('ShiftLeft'); shifted = true; }
    if (!shift && shifted) { await page.keyboard.up('ShiftLeft'); shifted = false; }
  };
  const releaseRun = async () => {
    if (keys) { await page.keyboard.up('KeyW'); keys = false; }
    if (shifted) { await page.keyboard.up('ShiftLeft'); shifted = false; }
  };
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      const pos = await page.evaluate(() => window.__sunset.player.position());
      if (await stopWhen(page, pos)) return { ok: true, pos };
      const dx = target.x - pos.x;
      const dz = target.z - pos.z;
      const dist = Math.hypot(dx, dz);
      const need = Math.atan2(-dx, -dz);
      // forward = (-sin yaw, -cos yaw); want it to equal the bearing.
      const diff = angleDiff(need, yaw);
      if (Math.abs(diff) > 0.08) {
        await releaseRun();
        await turnBy(page, diff);
        yaw += diff;
      } else {
        // Walk (no Shift) close to the target, so a low-fps frame cannot
        // carry Mara past the arrival circle in one step.
        await pressRun(dist > 12);
      }
      await page.waitForTimeout(700);
    }
    const pos = await page.evaluate(() => window.__sunset.player.position());
    return { ok: false, pos };
  } finally {
    await releaseRun();
  }
}

// --- Test A: mission 1 end to end -----------------------------------------
{
  const { ctx, page } = await newGame();
  const target = { x: -132, z: 24 };
  const res = await runTo(page, target, async () => {
    const s = await page.evaluate(() => ({ i: window.__sunset.missions.index, c: window.__sunset.missions.cash }));
    return s.i >= 1;
  }, 180000, 'mission1');
  const state = await page.evaluate(() => ({
    index: window.__sunset.missions.index,
    cash: window.__sunset.missions.cash,
    title: document.getElementById('mission-title').textContent,
  }));
  report('mission-1', res.ok && state.index === 1 && state.cash === 400,
    `index=${state.index} cash=$${state.cash} banner="${state.title}" pos=${JSON.stringify(res.pos)}`);
  await ctx.close();
}

// --- Test B: steal a parked car, drive it, get out ------------------------
{
  const { ctx, page } = await newGame();
  const car = await page.evaluate(() => {
    const p = window.__sunset.player.position();
    const west = window.__sunset.parkedCars.filter((c) => c.x < -85);
    west.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    return west[0] ? { x: west[0].x, z: west[0].z, name: west[0].name } : null;
  });
  let detail = `nearest west car: ${JSON.stringify(car)}`;
  let ok = false;
  if (car) {
    const res = await runTo(page, car, async (pg, pos) => {
      const d = Math.hypot(car.x - pos.x, car.z - pos.z);
      return d < 4;
    }, 180000, 'drive-to-car');
    if (res.ok) {
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(1500);
      const st1 = await page.evaluate(() => ({
        driving: window.__sunset.driving.active,
        wanted: window.__sunset.police.wanted,
        name: window.__sunset.driving.active ? window.__sunset.driving.car.name : '',
      }));
      detail += ` | after E: driving=${st1.driving} wanted=${st1.wanted} car=${st1.name}`;
      if (st1.driving && st1.wanted >= 1) {
        const start = await page.evaluate(() => window.__sunset.driving.position());
        await page.keyboard.down('KeyW');
        let st2 = { speed: 0, pos: start, health: 100 };
        const driveDeadline = Date.now() + 45000;
        while (Date.now() < driveDeadline) {
          await page.waitForTimeout(2000);
          st2 = await page.evaluate(() => ({
            speed: window.__sunset.driving.speedKmh(),
            pos: window.__sunset.driving.position(),
            health: window.__sunset.driving.health,
          }));
          const movedSoFar = Math.hypot(st2.pos.x - start.x, st2.pos.z - start.z);
          if (st2.speed > 15 && movedSoFar > 20) break;
        }
        await page.keyboard.up('KeyW');
        const moved = Math.hypot(st2.pos.x - start.x, st2.pos.z - start.z);
        detail += ` | drove ${moved.toFixed(1)}u, top speed ${st2.speed} km/h, health ${st2.health}%`;
        await page.keyboard.press('KeyE');
        await page.waitForTimeout(1200);
        const st3 = await page.evaluate(() => ({
          driving: window.__sunset.driving.active,
          pos: window.__sunset.player.position(),
        }));
        detail += ` | after exit E: driving=${st3.driving} player=${JSON.stringify(st3.pos)}`;
        ok = st2.speed > 15 && moved > 20 && !st3.driving;
      }
    } else {
      detail += ` | could not reach car, pos=${JSON.stringify(res.pos)}`;
    }
  }
  report('drive-steal-drive-exit', ok, detail);
  await ctx.close();
}

// --- Test C: punch a pedestrian -------------------------------------------
{
  const { ctx, page } = await newGame();
  let ok = false;
  let detail = '';
  const deadline = Date.now() + 150000;
  let yaw = -Math.PI / 2;
  let keys = false;
  const pressRun = async () => {
    if (!keys) { await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); keys = true; }
  };
  const releaseRun = async () => {
    if (keys) { await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); keys = false; }
  };
  try {
    while (Date.now() < deadline && !ok) {
      const ped = await page.evaluate(() => {
        const p = window.__sunset.player.position();
        const alive = window.__sunset.pedestrians.walkers.filter((w) => w.down <= 0);
        alive.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
        return alive[0] ? { x: alive[0].x, z: alive[0].z } : null;
      });
      if (!ped) break;
      const pos = await page.evaluate(() => window.__sunset.player.position());
      const d = Math.hypot(ped.x - pos.x, ped.z - pos.z);
      if (d < 2.0) {
        await page.keyboard.press('KeyF');
        await page.waitForTimeout(1200);
        const st = await page.evaluate(() => ({
          wanted: window.__sunset.police.wanted,
          down: window.__sunset.pedestrians.walkers.filter((w) => w.down > 0).length,
        }));
        detail = `punched at d=${d.toFixed(2)}: wanted=${st.wanted} peds down=${st.down}`;
        ok = st.wanted >= 1 && st.down >= 1;
        break;
      }
      const need = Math.atan2(-(ped.x - pos.x), -(ped.z - pos.z));
      const diff = angleDiff(need, yaw);
      if (Math.abs(diff) > 0.08) {
        await releaseRun();
        await turnBy(page, diff);
        yaw += diff;
      } else {
        await pressRun();
      }
      await page.waitForTimeout(700);
    }
  } finally {
    await releaseRun();
  }
  if (!detail) detail = 'no pedestrian reached in time';
  report('punch-pedestrian', ok, detail);
  await ctx.close();
}

// --- Test D: get busted by waiting for the patrol car ---------------------
{
  const { ctx, page } = await newGame();
  let ok = false;
  let detail = '';
  const car = await page.evaluate(() => {
    const p = window.__sunset.player.position();
    const west = window.__sunset.parkedCars.filter((c) => c.x < -85);
    west.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    return west[0] ? { x: west[0].x, z: west[0].z } : null;
  });
  if (car) {
    const res = await runTo(page, car, async (pg, pos) => Math.hypot(car.x - pos.x, car.z - pos.z) < 4, 180000, 'busted-to-car');
    if (res.ok) {
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(1200);
      // Sit in the stolen car and wait for the patrol car to corner her.
      const deadline = Date.now() + 180000;
      let bustedSeen = false;
      while (Date.now() < deadline && !bustedSeen) {
        bustedSeen = await page.evaluate(() => document.getElementById('busted-screen').style.display === 'flex');
        await page.waitForTimeout(2000);
      }
      detail = `busted screen shown: ${bustedSeen}`;
      if (bustedSeen) {
        // Wait for the respawn to finish.
        const deadline2 = Date.now() + 60000;
        let respawned = false;
        while (Date.now() < deadline2 && !respawned) {
          respawned = await page.evaluate(() => {
            const p = window.__sunset.player.position();
            return document.getElementById('busted-screen').style.display !== 'flex'
              && Math.hypot(p.x - (-108), p.z - 0) < 3
              && window.__sunset.police.wanted === 0
              && !window.__sunset.driving.active;
          });
          await page.waitForTimeout(1500);
        }
        const st = await page.evaluate(() => ({
          cash: window.__sunset.missions.cash,
          wanted: window.__sunset.police.wanted,
          pos: window.__sunset.player.position(),
        }));
        detail += ` | respawned=${respawned} cash=$${st.cash} wanted=${st.wanted} pos=${JSON.stringify(st.pos)}`;
        ok = respawned && st.cash === 150;
      }
    } else {
      detail = `could not reach car, pos=${JSON.stringify(res.pos)}`;
    }
  }
  report('busted-respawn', ok, detail);
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
