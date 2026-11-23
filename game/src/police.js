// Wanted + police: patrol cars chase Mara, ram her car, call one backup car
// per star (max 3), and lose her if she gets far away. A 30-second chase
// adds a star; 20 seconds unseen drops one. Cornered or totalled = BUSTED.
// Round 3: Air-1, the police helicopter, joins at 3 stars, and roadblocks
// close the avenues at 4-5 stars. Both stand down below 3 stars.
import * as THREE from 'three';
import { POLICE_TUNE, MAX_WANTED, BUSTED_FINE, SPAWN, WORLD } from './config.js';
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

// Air-1: a low-poly helicopter that shadows Mara from 24u up, rotor
// spinning, a white searchlight cone sweeping the street below.
function makeHeli(G) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.5, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 5.2), bodyMat);
  group.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.4), bodyMat);
  tail.position.set(0, 0.3, -4.4);
  group.add(tail);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.0, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x9fd8ff, metalness: 0.7, roughness: 0.15 }),
  );
  glass.position.set(0, 0.3, 2.2);
  group.add(glass);
  const rotorMat = new THREE.MeshStandardMaterial({ color: 0x111418 });
  const rotor = new THREE.Group();
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.5), rotorMat);
    blade.rotation.y = a;
    rotor.add(blade);
  }
  rotor.position.y = 1.1;
  group.add(rotor);
  const skidMat = new THREE.MeshStandardMaterial({ color: 0x111418 });
  for (const sx of [-1.1, 1.1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 4.2), skidMat);
    skid.position.set(sx, -1.0, 0);
    group.add(skid);
  }
  // Searchlight: a pale cone pointing at the street.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 22, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.position.y = -12;
  cone.rotation.x = Math.PI;
  group.add(cone);
  const heli = { group, rotor, x: 0, z: 0, y: 24, angle: 0 };
  G.scene.add(group);
  return heli;
}

function nearestRoad(v) {
  return WORLD.roads.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
}

// A roadblock: two striped barriers plus a parked patrol car, sitting on
// the nearest avenue ahead of and behind the player. Visual only — the
// chase cars still do the catching.
function makeRoadblock(G, x, z) {
  const group = new THREE.Group();
  const stripe = new THREE.MeshStandardMaterial({ color: 0xe8e8e8 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd93a2b });
  for (const off of [-2.2, 2.2]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.0, 0.5), stripe);
    bar.position.set(off, 0.9, 0);
    group.add(bar);
    const barRed = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.34, 0.52), red);
    barRed.position.set(off, 1.1, 0);
    group.add(barRed);
    for (const lx of [-2.4, 2.4]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.0, 0.4), stripe);
      leg.position.set(off + lx, 0.5, 0);
      group.add(leg);
    }
  }
  group.position.set(x, 0, z);
  G.scene.add(group);
  return { group, x, z };
}

function clearAirUnits(G) {
  if (G.heli) {
    G.scene.remove(G.heli.group);
    G.heli = null;
  }
  for (const rb of G.roadblocks) G.scene.remove(rb.group);
  G.roadblocks.length = 0;
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
  clearAirUnits(G);
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
    clearAirUnits(G);
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

  // Air-1 at 3+ stars: shadow Mara from above.
  if (s.wanted >= 3 && !G.heli) {
    G.heli = makeHeli(G);
    G.heli.x = target.x + 18;
    G.heli.z = target.z - 18;
    G.hud.toast('Helikopter polisi Air-1 di atasmu!');
  } else if (s.wanted < 3 && G.heli) {
    G.scene.remove(G.heli.group);
    G.heli = null;
  }
  if (G.heli) {
    const h = G.heli;
    h.x += (target.x - h.x) * Math.min(1, dt * 1.1);
    h.z += (target.z - h.z) * Math.min(1, dt * 1.1);
    h.angle += dt * 0.4;
    h.group.position.set(h.x, h.y, h.z);
    h.group.rotation.y = h.angle;
    h.rotor.rotation.y += dt * 22;
  }

  // Roadblocks at 4-5 stars: two barriers on the nearest avenue.
  if (s.wanted >= 4 && G.roadblocks.length === 0) {
    const rx = nearestRoad(target.x);
    G.roadblocks.push(makeRoadblock(G, rx, Math.max(-120, Math.min(120, target.z + 24))));
    G.roadblocks.push(makeRoadblock(G, rx, Math.max(-120, Math.min(120, target.z - 24))));
    G.hud.toast('Roadblock! Polisi menutup jalan!');
  } else if (s.wanted < 4 && G.roadblocks.length > 0) {
    for (const rb of G.roadblocks) G.scene.remove(rb.group);
    G.roadblocks.length = 0;
  }

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
        // Bounce back after the ram instead of driving through the car.
        cop.speed *= 0.25;
        cop.x -= Math.sin(cop.angle) * 1.5;
        cop.z -= Math.cos(cop.angle) * 1.5;
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
    // Hold a gap from the player's car and from other patrol cars — never
    // merge into them.
    const keepApart = (ox, oz) => {
      const dd = dist2(cop.x, cop.z, ox, oz);
      if (dd < 3.4 && dd > 0.01) {
        const push = (3.4 - dd) / dd;
        cop.x += (cop.x - ox) * push;
        cop.z += (cop.z - oz) * push;
      }
    };
    keepApart(target.x, target.z);
    for (const other of police) if (other !== cop) keepApart(other.x, other.z);
    syncCarMesh(cop);
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
