// Wanted + police: patrol cars chase Mara, ram her car, call one backup car
// per star (max 3), and lose her if she gets far away. A 30-second chase
// adds a star; 20 seconds unseen drops one. Cornered or totalled = BUSTED.
import { POLICE_TUNE, MAX_WANTED, BUSTED_FINE, SPAWN } from './config.js';
import { dist2, angleDiff } from './rng.js';
import { makeCar, syncCarMesh, removeCar } from './vehicles.js';
import { writeSave } from './save.js';

function playerPos(G) {
  if (G.state.driving && G.car) return { x: G.car.x, z: G.car.z };
  return { x: G.player.pos.x, z: G.player.pos.z };
}

function spawnCop(G, nearX, nearZ) {
  // Appear on the nearest avenue a short way from the player, facing them.
  const roads = [-110, -66, -22, 22, 66, 110];
  const rx = roads.reduce((a, b) => (Math.abs(b - nearX) < Math.abs(a - nearX) ? b : a));
  const x = rx;
  const z = Math.max(-120, Math.min(120, nearZ + 30));
  const angle = Math.atan2(nearX - x, nearZ - z);
  const car = makeCar(G, {
    kind: 'police',
    name: 'Patroli Sunset',
    color: 0xf2f2f2,
    x,
    z,
    angle,
    isPolice: true,
  });
  car.speed = 10;
  return car;
}

// BUSTED: fine, wanted reset, respawn on foot at the spawn point. The
// mission chain continues from the last index — progress is never lost.
export function bustPlayer(G, reason) {
  const s = G.state;
  if (s.screen === 'busted') return;
  s.screen = 'busted';
  s.bustedReason = reason;
  s.cash = Math.max(0, s.cash - BUSTED_FINE);
  s.wanted = 0;
  s.chaseTimer = 0;
  s.hiddenTimer = 0;
  s.bustedTimer = 0;
  G.audio.siren(false);
  G.audio.engine(false, 0);
  G.audio.busted();
  if (s.driving) {
    // The wrecked/stolen car stays where it was.
    const wreck = G.car;
    if (wreck) {
      wreck.speed = 0;
      wreck.kind = 'parked';
      G.parkedCars.push(wreck);
    }
    G.car = null;
    s.driving = false;
  }
  // Clear the chase cars.
  for (const cop of G.police) removeCar(G, cop);
  G.police.length = 0;
  // Respawn on foot at the spawn point; the mission chain continues.
  G.player.pos.x = SPAWN.x;
  G.player.pos.z = SPAWN.z;
  G.player.pos.y = 0;
  G.player.vy = 0;
  G.player.heading = SPAWN.heading;
  G.player.mesh.visible = true;
  G.player.mesh.position.set(SPAWN.x, 0, SPAWN.z);
  writeSave(G);
  G.hud.showBusted(reason);
}

export function updatePolice(G, dt) {
  const s = G.state;
  const police = G.police;

  if (s.wanted <= 0) {
    // No heat: any leftover patrol cars drive off and despawn.
    for (let i = police.length - 1; i >= 0; i -= 1) {
      const cop = police[i];
      cop.speed = Math.max(0, cop.speed - dt * 8);
      cop.x += Math.sin(cop.angle) * cop.speed * dt;
      cop.z += Math.cos(cop.angle) * cop.speed * dt;
      syncCarMesh(cop);
      if (cop.speed <= 0.1) {
        removeCar(G, cop);
        police.splice(i, 1);
      }
    }
    if (police.length === 0) G.audio.siren(false);
    s.chaseTimer = 0;
    s.hiddenTimer = 0;
    s.bustedTimer = 0;
    return;
  }

  // Reinforcements: one patrol car per star, up to 3.
  const want = Math.min(s.wanted, POLICE_TUNE.maxCars);
  const target = playerPos(G);
  while (police.length < want) {
    police.push(spawnCop(G, target.x, target.z));
    G.hud.toast('Bala bantuan polisi datang!');
  }
  while (police.length > want) {
    const cop = police.pop();
    removeCar(G, cop);
  }
  G.audio.siren(true);

  // Timers: the chase must stay close to add a star; once the nearest cop
  // is beyond the lost range the chase is broken and hiding drops a star.
  let nearest = Infinity;
  for (const cop of police) nearest = Math.min(nearest, dist2(cop.x, cop.z, target.x, target.z));
  if (nearest > POLICE_TUNE.lostRange) {
    s.chaseTimer = 0;
    s.hiddenTimer += dt;
    if (s.hiddenTimer >= POLICE_TUNE.hiddenStarSeconds) {
      s.hiddenTimer = 0;
      s.wanted = Math.max(0, s.wanted - 1);
      G.hud.toast(`Kamu lolos — Wanted turun ke ${s.wanted} ★`);
    }
  } else {
    s.hiddenTimer = 0;
    s.chaseTimer += dt;
    if (s.chaseTimer >= POLICE_TUNE.chaseStarSeconds) {
      s.chaseTimer = 0;
      if (s.wanted < MAX_WANTED) {
        s.wanted = Math.min(MAX_WANTED, s.wanted + 1);
        G.hud.toast(`Kejar-kejaran berlanjut — Wanted naik ke ${s.wanted} ★`);
      }
    }
  }

  // Chase steering + ramming.
  let cornered = false;
  for (const cop of police) {
    const d = dist2(cop.x, cop.z, target.x, target.z);
    const lost = d > POLICE_TUNE.lostRange;
    let maxSpeed = POLICE_TUNE.maxSpeed * (lost ? POLICE_TUNE.lostSpeedFactor : 1);
    // Slow down and turn sharply when close, or the car orbits the player
    // at its turning radius and can never corner them.
    if (d < 15) maxSpeed = Math.min(maxSpeed, Math.max(6, 8 + d * 0.9));
    const wantAngle = Math.atan2(target.x - cop.x, target.z - cop.z);
    const turnRate = d < 15 ? 6 : 2.6;
    cop.angle += angleDiff(cop.angle, wantAngle) * Math.min(1, dt * turnRate);
    cop.speed = Math.min(maxSpeed, cop.speed + POLICE_TUNE.accel * dt);
    cop.x += Math.sin(cop.angle) * cop.speed * dt;
    cop.z += Math.cos(cop.angle) * cop.speed * dt;
    cop.flash += dt;
    // Flashing light bar.
    const on = Math.floor(cop.flash * 4) % 2 === 0;
    if (cop.mesh.redLight) cop.mesh.redLight.visible = on;
    if (cop.mesh.blueLight) cop.mesh.blueLight.visible = !on;
    syncCarMesh(cop);

    cop.ramCooldown = Math.max(0, cop.ramCooldown - dt);
    if (d < POLICE_TUNE.ramRange && cop.ramCooldown <= 0) {
      cop.ramCooldown = POLICE_TUNE.ramCooldown;
      if (s.driving && G.car) {
        G.car.condition = Math.max(0, G.car.condition - POLICE_TUNE.ramDamage);
        G.audio.crash();
        G.hud.toast(`Polisi menabrak mobilmu! Kondisi ${Math.round(G.car.condition)}%`);
        if (G.car.condition <= 0) {
          bustPlayer(G, 'Mobilmu hancur total!');
          return;
        }
      } else {
        // On foot, a ram is a shove — the corner timer decides the bust.
        G.player.pos.x += Math.sin(cop.angle) * 1.2;
        G.player.pos.z += Math.cos(cop.angle) * 1.2;
      }
    }
    if (d < POLICE_TUNE.cornerRange) cornered = true;
  }

  // Cornered on foot (or in a dead-slow car) for 2.5 s = BUSTED.
  if (cornered && (!s.driving || (G.car && Math.abs(G.car.speed) < 2))) {
    s.bustedTimer += dt;
    if (s.bustedTimer >= POLICE_TUNE.cornerTime) {
      bustPlayer(G, 'Kamu terpojok polisi!');
      return;
    }
  } else {
    s.bustedTimer = 0;
  }
}
