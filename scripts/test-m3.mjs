// M3 live end-to-end checks (Playwright, SwiftShader ~1/4 game time:
// every wait polls live state, never a fixed sleep). Covers what M2 left
// untested: missions 2+3 chained, stealing a moving traffic car, the
// wanted chase timer (+1 star) and cooldown (star falls after hiding),
// the save/load round-trip, and start -> pause -> resume -> restart.
import { chromium } from 'playwright-core';

const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });

const ONLY = process.argv[2] || '';
const RUN = (name) => !ONLY || ONLY === name;

const results = {};
function report(name, ok, detail) {
  results[name] = { ok, detail };
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

async function newGame() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('http://localhost:8080/?seed=7', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  return { ctx, page, errors };
}

async function startGame(page) {
  await page.click('#start-screen');
  await page.waitForTimeout(800);
}

// Drag the mouse to rotate the camera by `deltaYaw` radians.
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

// Run on foot toward a target, re-aiming as Mara moves. `stopWhen` polls
// live state. The camera yaw is read live from the game every step, so
// consecutive runTo calls never drift (the old tracked-yaw version sent
// Mara to the world corner after the first run). Returns { ok, pos }.
async function runTo(page, target, stopWhen, timeoutMs) {
  let keys = false;
  let shifted = false;
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      const pos = await page.evaluate(() => window.__sunset.player.position());
      if (await stopWhen(page, pos)) return { ok: true, pos };
      const yaw = await page.evaluate(() => window.__sunset.cam.yaw);
      const dx = target.x - pos.x;
      const dz = target.z - pos.z;
      const dist = Math.hypot(dx, dz);
      const need = Math.atan2(-dx, -dz);
      const diff = angleDiff(need, yaw);
      if (Math.abs(diff) > 0.08) {
        if (keys) { await page.keyboard.up('KeyW'); keys = false; }
        if (shifted) { await page.keyboard.up('ShiftLeft'); shifted = false; }
        await turnBy(page, diff);
      } else {
        if (!keys) { await page.keyboard.down('KeyW'); keys = true; }
        if (dist > 12 && !shifted) { await page.keyboard.down('ShiftLeft'); shifted = true; }
        if (dist <= 12 && shifted) { await page.keyboard.up('ShiftLeft'); shifted = false; }
      }
      await page.waitForTimeout(700);
    }
    return { ok: false, pos: await page.evaluate(() => window.__sunset.player.position()) };
  } finally {
    if (keys) await page.keyboard.up('KeyW');
    if (shifted) await page.keyboard.up('ShiftLeft');
  }
}

// Steal the parked car at (x, z): walk to it, press E, confirm driving.
async function stealParked(page, car) {
  const res = await runTo(page, car, async (pg, pos) => Math.hypot(car.x - pos.x, car.z - pos.z) < 4, 180000);
  if (!res.ok) return { ok: false, detail: `could not reach car, pos=${JSON.stringify(res.pos)}` };
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => ({
    driving: window.__sunset.driving.active,
    wanted: window.__sunset.police.wanted,
    name: window.__sunset.driving.active ? window.__sunset.driving.car.name : '',
  }));
  return { ok: st.driving && st.wanted >= 1, detail: `driving=${st.driving} wanted=${st.wanted} car=${st.name}`, state: st };
}

async function driveState(page) {
  return page.evaluate(() => {
    const driving = window.__sunset.driving.active;
    const p = driving ? window.__sunset.driving.position() : window.__sunset.player.position();
    const cops = window.__sunset.police.patrol.map((c) => Math.hypot(c.x - p.x, c.z - p.z));
    return {
      driving,
      wanted: window.__sunset.police.wanted,
      health: window.__sunset.driving.health,
      speed: window.__sunset.driving.speedKmh(),
      heading: window.__sunset.driving.car ? window.__sunset.driving.car.heading : 0,
      pos: p,
      nearest: cops.length ? Math.min(...cops) : 999,
      index: window.__sunset.missions.index,
      cash: window.__sunset.missions.cash,
      busted: document.getElementById('busted-screen').style.display === 'flex',
    };
  });
}

// Drive through road waypoints. `throttle` decides W from live state
// (default: always gas). Stuck detection reverses out of a corner.
// `stopWhen` ends the drive early (mission complete, wanted change...).
// `label` logs live state every 5 s so a wreck can be diagnosed.
async function driveWaypoints(page, waypoints, stopWhen, timeoutMs, throttle, label = '') {
  let wi = 0;
  let wDown = false;
  let aDown = false;
  let dDown = false;
  let sDown = false;
  let bestDist = Infinity;
  let bestAt = Date.now();
  let reversingUntil = 0;
  let finalHoldSince = 0;
  let lastLog = 0;
  const setKey = async (code, want, cur) => {
    if (want === cur) return cur;
    if (want) await page.keyboard.down(code); else await page.keyboard.up(code);
    return want;
  };
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      const st = await driveState(page);
      if (!st.driving) return { ok: false, detail: 'no longer driving', state: st };
      if (st.busted) return { ok: false, detail: `BUSTED wanted=${st.wanted} health=${st.health}`, state: st };
      if (st.health <= 0) return { ok: false, detail: 'car wrecked', state: st };
      if (stopWhen && (await stopWhen(st))) return { ok: true, detail: 'stop condition met', state: st };
      if (label && Date.now() - lastLog > 5000) {
        lastLog = Date.now();
        console.log(`[${label}] wanted=${st.wanted} health=${st.health} nearest=${st.nearest.toFixed(1)} speed=${st.speed} pos=(${st.pos.x.toFixed(0)},${st.pos.z.toFixed(0)}) wp=${wi}/${waypoints.length}`);
      }
      const wp = waypoints[wi];
      const dist = Math.hypot(wp.x - st.pos.x, wp.z - st.pos.z);
      // Arrival radius per waypoint (default 7). Reaching the LAST
      // waypoint does not end the drive: the mission only counts within
      // 4 of its target, and a loose radius can end the drive a step
      // short of the trigger line. Instead the car holds on the final
      // waypoint until stopWhen fires or the overall timeout hits.
      if (dist < (wp.r ?? 7)) {
        if (wi === waypoints.length - 1) {
          if (!finalHoldSince) finalHoldSince = Date.now();
          if (Date.now() - finalHoldSince > 45000) {
            return { ok: false, detail: 'final waypoint hold timeout', state: st };
          }
        } else {
          wi += 1;
          finalHoldSince = 0;
          continue;
        }
      } else {
        finalHoldSince = 0;
      }
      // Stuck (no progress toward the waypoint for 8 s wall): reverse out.
      if (dist < bestDist - 1) { bestDist = dist; bestAt = Date.now(); }
      if (Date.now() - bestAt > 8000 && Date.now() > reversingUntil) {
        reversingUntil = Date.now() + 1500;
        bestAt = Date.now();
        bestDist = Infinity;
      }
      const need = Math.atan2(wp.x - st.pos.x, wp.z - st.pos.z);
      const diff = angleDiff(need, st.heading);
      const reversing = Date.now() < reversingUntil;
      if (reversing) {
        wDown = await setKey('KeyW', false, wDown);
        sDown = await setKey('KeyS', true, sDown);
        aDown = await setKey('KeyA', diff < -0.1, aDown);
        dDown = await setKey('KeyD', diff > 0.1, dDown);
      } else {
        sDown = await setKey('KeyS', false, sDown);
        let wantW = throttle ? throttle(st) : true;
        // No custom throttle (mission legs): ease off before a corner so
        // the turn radius shrinks and the car stops clipping buildings
        // and traffic on the way into the turn.
        if (!throttle && dist < 18 && wi < waypoints.length - 1) wantW = wantW && st.speed < 55;
        // Chase legs: build the gap before a corner, so a patrol car
        // cutting the corner cannot close to ramming distance.
        if (throttle && dist < 30 && st.nearest < 20) wantW = true;
        wDown = await setKey('KeyW', wantW, wDown);
        // Full-lock hold steering, polled every 150 ms wall (~0.05 s
        // game): a 400 ms poll made each correction 0.23 rad, so the car
        // snaked +-5..8u across a 12u road whose safe corridor is +-4.3u
        // and kept clipping building corners (speed x0.35 + damage).
        aDown = await setKey('KeyA', diff > 0.1, aDown);
        dDown = await setKey('KeyD', diff < -0.1, dDown);
      }
      await page.waitForTimeout(150);
    }
    const st = await driveState(page);
    return { ok: false, detail: `timeout at waypoint ${wi}/${waypoints.length}`, state: st };
  } finally {
    for (const [code, down] of [['KeyW', wDown], ['KeyA', aDown], ['KeyD', dDown], ['KeyS', sDown]]) {
      if (down) await page.keyboard.up(code);
    }
  }
}

// --- Test A: missions 2 and 3 chained -------------------------------------
if (RUN('mission-2-3-chained')) {
  const { ctx, page, errors } = await newGame();
  await startGame(page);
  // M1 on foot first: the chain only unlocks M2 after Rico.
  const m1 = await runTo(page, { x: -132, z: 24 }, async () => {
    const s = await page.evaluate(() => window.__sunset.missions.index);
    return s >= 1;
  }, 180000);
  let detail = `M1 reached=${m1.ok}`;
  let ok = false;
  if (m1.ok) {
    const steal = await stealParked(page, { x: -108.6, z: -15 });
    detail += ` | steal: ${steal.detail}`;
    if (steal.ok) {
      // M2: east on the z=0 road, south on x=50, into the workshop block
      // through its empty south-east quadrant. The last waypoint sits
      // just past the trigger line in open space (27,-23): the target
      // itself is wedged in a 2-unit corridor the car cannot enter.
      const m2 = await driveWaypoints(page,
        [{ x: -100, z: 0 }, { x: 50, z: 0 }, { x: 50, z: -16 }, { x: 27, z: -16 }, { x: 27, z: -23, r: 3 }],
        async (st) => st.index >= 2, 300000, undefined, 'M2');
      const st2 = await page.evaluate(() => ({
        index: window.__sunset.missions.index,
        cash: window.__sunset.missions.cash,
        health: window.__sunset.driving.health,
        wanted: window.__sunset.police.wanted,
      }));
      detail += ` | M2 drive: ${m2.detail} index=${st2.index} cash=$${st2.cash} health=${st2.health} wanted=${st2.wanted}`;
      if (m2.ok && st2.index === 2 && st2.cash === 700) {
        // M3: back to the x=50 road, south to z=75, east into the tower
        // block from the road — the last waypoint is the target itself.
        const m3 = await driveWaypoints(page,
          [{ x: 50, z: -16 }, { x: 50, z: 75 }, { x: 75, z: 75, r: 3.5 }],
          async (st) => st.index >= 3, 300000, undefined, 'M3');
        const st3 = await page.evaluate(() => ({
          index: window.__sunset.missions.index,
          cash: window.__sunset.missions.cash,
          title: document.getElementById('mission-title').textContent,
          health: window.__sunset.driving.health,
          wanted: window.__sunset.police.wanted,
        }));
        detail += ` | M3 drive: ${m3.detail} index=${st3.index} cash=$${st3.cash} banner="${st3.title}" health=${st3.health} wanted=${st3.wanted}`;
        ok = m3.ok && st3.index === 3 && st3.cash === 1200;
      }
    }
  }
  detail += ` | console errors: ${errors.length}`;
  report('mission-2-3-chained', ok, detail);
  await ctx.close();
}

// Hunt a moving traffic car: keep cutting in front of the nearest car
// until it brakes for Mara, then take it with E. A fixed ambush point
// does not work — the cars are too sparse on any one leg — so the target
// is recomputed every step, 15 units ahead of the nearest car.
// Hunt a moving traffic car in two phases. Phase 1 (intercept): pick the
// nearest car with a long leg still ahead of it and stand 28u up its leg
// — the car is committed to that leg, so it must come to Mara. Phase 2
// (approach): a braking car stops ~7u short of a standing Mara (it only
// starts braking inside 9u), which is past E's 5u reach, so Mara walks
// up to the stopped car before pressing E.
async function huntTrafficCar(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pick = await page.evaluate(() => {
      const p = window.__sunset.player.position();
      let best = null;
      for (const c of window.__sunset.traffic.cars) {
        const a = c.loop[c.leg];
        const b = c.loop[(c.leg + 1) % 4];
        const legLen = Math.hypot(b.x - a.x, b.z - a.z);
        if ((1 - c.t) * legLen < 30) continue;
        const cx = c.mesh.position.x;
        const cz = c.mesh.position.z;
        const d = Math.hypot(cx - p.x, cz - p.z);
        if (best && d >= best.d) continue;
        const fx = (b.x - a.x) / legLen;
        const fz = (b.z - a.z) / legLen;
        best = { d, tx: cx + fx * 28, tz: cz + fz * 28 };
      }
      return best;
    });
    if (!pick) { await page.waitForTimeout(800); continue; }
    await runTo(page, { x: pick.tx, z: pick.tz }, async (pg, pos) => {
      const stopped = await pg.evaluate(() => {
        const p = window.__sunset.player.position();
        return window.__sunset.traffic.cars.some((c) => c.curSpeed < 0.5
          && Math.hypot(c.mesh.position.x - p.x, c.mesh.position.z - p.z) < 8);
      });
      return stopped || Math.hypot(pick.tx - pos.x, pick.tz - pos.z) < 3;
    }, 60000);
    // Stand still and let the car arrive and brake for Mara.
    const waitDeadline = Date.now() + 30000;
    let stoppedCar = null;
    while (Date.now() < waitDeadline && !stoppedCar) {
      stoppedCar = await page.evaluate(() => {
        const p = window.__sunset.player.position();
        const near = window.__sunset.traffic.cars.filter((c) => c.curSpeed < 0.5
          && Math.hypot(c.mesh.position.x - p.x, c.mesh.position.z - p.z) < 8);
        return near.length
          ? { x: near[0].mesh.position.x, z: near[0].mesh.position.z }
          : null;
      });
      if (!stoppedCar) await page.waitForTimeout(500);
    }
    if (!stoppedCar) continue; // the car turned or passed — pick again
    const close = await runTo(page, stoppedCar,
      async (pg, pos) => Math.hypot(stoppedCar.x - pos.x, stoppedCar.z - pos.z) < 3.5, 30000);
    if (close.ok) return { ok: true };
  }
  return { ok: false };
}

// --- Test B: steal a moving traffic car ------------------------------------
if (RUN('steal-traffic-car')) {
  const { ctx, page, errors } = await newGame();
  await startGame(page);
  let detail = '';
  const hunted = await huntTrafficCar(page, 180000);
  detail += `hunted=${hunted.ok}`;
  let ok = false;
  if (hunted.ok) {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => ({
      driving: window.__sunset.driving.active,
      wanted: window.__sunset.police.wanted,
      name: window.__sunset.driving.active ? window.__sunset.driving.car.name : '',
      trafficLeft: window.__sunset.traffic.cars.length,
    }));
    detail += ` | after E: driving=${st.driving} wanted=${st.wanted} car=${st.name} trafficLeft=${st.trafficLeft}`;
    ok = st.driving && st.wanted >= 1 && st.name === 'Mobil jalanan';
  }
  detail += ` | console errors: ${errors.length}`;
  report('steal-traffic-car', ok, detail);
  await ctx.close();
}

// --- Test C: wanted chase timer, then cooldown by hiding -------------------
// Two separate sessions, because the two mechanics need opposite driving:
// the chase timer needs the patrol car close for 30 s, the cooldown needs
// it far away for 20 s. A ram also adds a star AND resets the chase timer,
// so the timer is only proven by a rise with health unchanged since the
// previous rise (no ram, no crash, no pedestrian hit in between).
if (RUN('wanted-chase-timer')) {
  const { ctx, page, errors } = await newGame();
  await startGame(page);
  let detail = '';
  let chaseOk = false;
  const steal = await stealParked(page, { x: -108.6, z: -15 });
  detail += `steal: ${steal.detail}`;
  if (steal.ok) {
    // Phase 1 — chase: loop the perimeter roads, easing off the gas when
    // the patrol car falls behind so it stays on Mara's tail (<25u).
    // Stop at 3 stars: the 1->2 rise may be a ram, but a 2->3 rise with
    // health untouched since the 1->2 rise can only be the 30 s timer.
    const transitions = [];
    let lastWanted = 1;
    let lastHealth = 100;
    let cleanRiseSeen = false;
    const chaseStart = Date.now();
    const chase = await driveWaypoints(page,
      [{ x: -150, z: -15 }, { x: -150, z: -100 }, { x: 100, z: -100 }, { x: 100, z: 100 }, { x: -100, z: 100 }, { x: -100, z: -100 }],
      async (st) => {
        if (st.wanted !== lastWanted) {
          const t = { from: lastWanted, to: st.wanted, health: st.health, healthBefore: lastHealth };
          transitions.push(t);
          if (t.to > t.from) {
            const clean = transitions.length === 1 ? t.health === 100 : t.health === t.healthBefore;
            if (clean) cleanRiseSeen = true;
          }
          lastWanted = st.wanted;
        }
        lastHealth = st.health;
        // Stop on a clean rise (timer proof) or at 5 stars — rams alone
        // must not end the chase before the timer gets its window.
        return cleanRiseSeen || st.wanted >= 5;
      },
      600000,
      // Gap-based throttle: the patrol car does ~68 km/h at 1 star, so
      // hold ~68 when it is tailing (12..22u), floor it when it is on
      // the bumper, and ease to ~55 when it falls behind so it closes in.
      (st) => (st.nearest < 12 ? true : st.nearest > 22 ? st.speed < 55 : st.speed < 68), 'chase');
    const stC = await driveState(page);
    const chaseSecs = ((Date.now() - chaseStart) / 1000).toFixed(0);
    detail += ` | chase: ${chase.detail} in ${chaseSecs}s wall, wanted=${stC.wanted} health=${stC.health} rises=${JSON.stringify(transitions)}`;
    for (let i = 0; i < transitions.length; i += 1) {
      const t = transitions[i];
      const clean = i === 0 ? t.health === 100 : t.health === t.healthBefore;
      if (t.to > t.from && clean) chaseOk = true;
    }
  }
  detail += ` | console errors: ${errors.length}`;
  report('wanted-chase-timer', chaseOk, detail);
  await ctx.close();
}

if (RUN('wanted-cooldown-hide')) {
  // Phase 2 — hide, fresh session: steal a car and floor it at once. The
  // patrol car spawns ~130u away, so the gap is already past 55; holding
  // top speed on the perimeter loop should keep it there until the 20 s
  // clean window drops the star.
  const { ctx, page, errors } = await newGame();
  await startGame(page);
  let detail = '';
  let ok = false;
  const steal = await stealParked(page, { x: -108.6, z: -15 });
  detail += `steal: ${steal.detail}`;
  if (steal.ok) {
    const hideStart = Date.now();
    let maxGap = 0;
    let minGap = 999;
    const hide = await driveWaypoints(page,
      [{ x: -150, z: -15 }, { x: -150, z: -100 }, { x: 100, z: -100 }, { x: 100, z: 100 }, { x: -100, z: 100 }, { x: -100, z: -100 }],
      async (st) => {
        maxGap = Math.max(maxGap, st.nearest);
        minGap = Math.min(minGap, st.nearest);
        return st.wanted <= 0;
      },
      300000, undefined, 'hide');
    const stH = await driveState(page);
    const hideSecs = ((Date.now() - hideStart) / 1000).toFixed(0);
    detail += ` | hide: ${hide.detail} in ${hideSecs}s wall, wanted=${stH.wanted} gap ${minGap.toFixed(1)}..${maxGap.toFixed(1)} health=${stH.health} driving=${stH.driving}`;
    ok = hide.ok && stH.wanted === 0 && stH.driving;
  }
  detail += ` | console errors: ${errors.length}`;
  report('wanted-cooldown-hide', ok, detail);
  await ctx.close();
}

// --- Test D: save / load round-trip ----------------------------------------
if (RUN('save-load-roundtrip')) {
  const { ctx, page, errors } = await newGame();
  await startGame(page);
  const m1 = await runTo(page, { x: -132, z: 24 }, async () => {
    const s = await page.evaluate(() => window.__sunset.missions.index);
    return s >= 1;
  }, 180000);
  let detail = `M1 reached=${m1.ok}`;
  let ok = false;
  if (m1.ok) {
    // Wait for the 10 s autosave to write the completed mission.
    const deadline = Date.now() + 150000;
    let saved = null;
    while (Date.now() < deadline && !saved) {
      saved = await page.evaluate(() => {
        const raw = window.localStorage.getItem('sunset-shores-save-v1');
        if (!raw) return null;
        const data = JSON.parse(raw);
        return data.missionIndex >= 1 ? data : null;
      });
      if (!saved) await page.waitForTimeout(2000);
    }
    detail += ` | saved=${JSON.stringify(saved)}`;
    if (saved) {
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(2000);
      await page.click('#start-screen');
      await page.waitForTimeout(1500);
      const st = await page.evaluate(() => ({
        index: window.__sunset.missions.index,
        cash: window.__sunset.missions.cash,
        pos: window.__sunset.player.position(),
        title: document.getElementById('mission-title').textContent,
        target: window.__sunset.missions.target(),
      }));
      const posErr = Math.hypot(st.pos.x - saved.playerX, st.pos.z - saved.playerZ);
      detail += ` | after reload: index=${st.index} cash=$${st.cash} posErr=${posErr.toFixed(2)} title="${st.title}" target=${JSON.stringify(st.target)}`;
      ok = st.index === 1 && st.cash === 400 && posErr < 3
        && st.title.includes('MISI 2') && st.target.x === 25 && st.target.z === -25;
    }
  }
  detail += ` | console errors: ${errors.length}`;
  report('save-load-roundtrip', ok, detail);
  await ctx.close();
}

// --- Test E: start -> pause -> resume -> restart, audio after first click --
if (RUN('pause-resume-restart-audio')) {
  const { ctx, page, errors } = await newGame();
  const audioBefore = await page.evaluate(() => window.__sunset.audio.state);
  await startGame(page);
  const audioAfter = await page.evaluate(() => window.__sunset.audio.state);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  const paused = await page.evaluate(() => document.getElementById('pause-screen').style.display === 'flex');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  const resumed = await page.evaluate(() => document.getElementById('pause-screen').style.display !== 'flex');
  // Confirm the game actually runs again: Mara moves when W is held.
  const p0 = await page.evaluate(() => window.__sunset.player.position());
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(3000);
  await page.keyboard.up('KeyW');
  const p1 = await page.evaluate(() => window.__sunset.player.position());
  const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  // Restart from the pause screen: save wiped, fresh start screen.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  await page.click('#restart-btn');
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => ({
    // Inline style is empty before showScreen ever runs (fresh load and
    // after a restart reload), so read the computed display instead.
    startVisible: getComputedStyle(document.getElementById('start-screen')).display === 'flex',
    index: window.__sunset.missions.index,
    cash: window.__sunset.missions.cash,
    save: window.localStorage.getItem('sunset-shores-save-v1'),
  }));
  const ok = audioBefore === 'not-started' && audioAfter !== 'not-started'
    && paused && resumed && moved > 1
    && st.startVisible && st.index === 0 && st.cash === 250 && st.save === null;
  report('pause-resume-restart-audio', ok,
    `audio ${audioBefore} -> ${audioAfter} | paused=${paused} resumed=${resumed} moved=${moved.toFixed(1)}u | restart: startVisible=${st.startVisible} index=${st.index} cash=$${st.cash} save=${st.save} | console errors: ${errors.length} ${errors.join('; ')}`);
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
