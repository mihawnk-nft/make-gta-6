// Combat: fists plus a 7-gun arsenal on the wheel. F (or left click)
// attacks with the equipped weapon — fists punch, guns fire a hitscan
// shot toward the aim, RPG and molotov splash a small blast. Hitting a
// pedestrian knocks them flat and raises the wanted level; hitting a
// police car raises it too. H is the horn when driving. R reloads.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { dist2, angleDiff } from './rng.js';
import { nearestPed } from './pedestrians.js';

export function weaponDef(i) {
  return WEAPONS[i] || WEAPONS[0];
}

export function weaponUnlocked(G, i) {
  if (G.cheatUnlocked) return true;
  return G.rank >= weaponDef(i).rank;
}

// Q cycles to the next unlocked weapon (wrapping around the wheel).
export function cycleWeapon(G) {
  for (let step = 1; step <= WEAPONS.length; step += 1) {
    const next = (G.weapon + step) % WEAPONS.length;
    if (weaponUnlocked(G, next)) {
      selectWeapon(G, next);
      return;
    }
  }
}

// Digit 1-8: select a slot, unless the rank lock refuses it.
export function selectWeapon(G, i) {
  if (i < 0 || i >= WEAPONS.length) return false;
  if (!weaponUnlocked(G, i)) {
    G.hud.toast(`${weaponDef(i).name} baru terbuka di Rank ${weaponDef(i).rank} — kamu Rank ${G.rank}`);
    G.audio.click();
    return false;
  }
  G.weapon = i;
  G.audio.click();
  return true;
}

export function ammoOf(G, i) {
  const def = weaponDef(i);
  if (!Number.isFinite(def.ammo)) return Infinity;
  return (G.ammo && typeof G.ammo[i] === 'number') ? G.ammo[i] : def.ammo;
}

export function reloadWeapon(G) {
  const def = weaponDef(G.weapon);
  if (!Number.isFinite(def.ammo)) return;
  if (!G.ammo) G.ammo = {};
  G.ammo[G.weapon] = def.ammo;
  G.audio.click();
  G.hud.toast(`${def.name} diisi ulang — ${def.ammo} peluru`);
}

function aimPoint(G) {
  const s = G.state;
  if (s.driving && G.car) return { x: G.car.x, z: G.car.z, heading: G.car.angle };
  return { x: G.player.pos.x, z: G.player.pos.z, heading: G.player.heading };
}

function hitPedestrian(G, from, range, spreadRad, damage) {
  // The best target inside a cone in front of the shooter.
  let best = null;
  let bestD = range;
  for (const ped of G.peds) {
    if (ped.down) continue;
    const d = dist2(from.x, from.z, ped.x, ped.z);
    if (d > range) continue;
    const ang = Math.atan2(ped.x - from.x, ped.z - from.z);
    if (Math.abs(angleDiff(from.heading, ang)) > spreadRad) continue;
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  return best;
}

function hitCop(G, from, range, spreadRad) {
  let best = null;
  let bestD = range;
  for (const cop of G.police) {
    const d = dist2(from.x, from.z, cop.x, cop.z);
    if (d > range) continue;
    const ang = Math.atan2(cop.x - from.x, cop.z - from.z);
    if (Math.abs(angleDiff(from.heading, ang)) > spreadRad) continue;
    if (d < bestD) {
      bestD = d;
      best = cop;
    }
  }
  return best;
}

function tracer(G, from, to) {
  // A short-lived yellow line from muzzle to impact point.
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(from.x, 1.4, from.z),
    new THREE.Vector3(to.x, 1.2, to.z),
  ]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 }));
  G.scene.add(line);
  G._tracers.push({ line, ttl: 0.09 });
}

function raiseWanted(G, msg) {
  const s = G.state;
  s.wanted = Math.min(5, s.wanted + 1);
  s.chaseTimer = 0;
  s.hiddenTimer = 0;
  G.hud.toast(msg);
}

function fireBlast(G, from, def) {
  // RPG / molotov: everything fragile near the impact point goes down.
  const hx = from.x + Math.sin(from.heading) * Math.min(def.range, 14);
  const hz = from.z + Math.cos(from.heading) * Math.min(def.range, 14);
  tracer(G, from, { x: hx, z: hz });
  G.audio.explosion();
  G.combatFlash = 1;
  const radius = def.blast || 6;
  let hitAny = false;
  for (const ped of G.peds) {
    if (!ped.down && dist2(hx, hz, ped.x, ped.z) < radius) {
      ped.down = true;
      ped.downTimer = 4;
      hitAny = true;
    }
  }
  for (const cop of G.police) {
    if (dist2(hx, hz, cop.x, cop.z) < radius + 2) hitAny = true;
  }
  if (hitAny) raiseWanted(G, def.name === 'RPG' ? 'Ledakan RPG! Wanted +1 ★' : 'Molotov meledak! Wanted +1 ★');
  else G.hud.toast(`${def.name} meledak di kejauhan…`);
}

function shoot(G, def) {
  const from = aimPoint(G);
  const now = performance.now();
  if (G._lastShot && now - G._lastShot < def.fireMs) return;
  G._lastShot = now;
  if (Number.isFinite(def.ammo)) {
    if (!G.ammo) G.ammo = {};
    const left = ammoOf(G, G.weapon);
    if (left <= 0) {
      G.hud.toast(`${def.name} kehabisan peluru — tekan R untuk isi ulang`);
      G.audio.click();
      return;
    }
    G.ammo[G.weapon] = left - 1;
  }
  if (def.blast) {
    fireBlast(G, from, def);
    return;
  }
  G.audio.shot();
  G.combatFlash = 0.6;
  const spread = def.name === 'Shotgun' ? 0.5 : 0.28;
  const ped = hitPedestrian(G, from, def.range, spread, def.damage);
  const cop = hitCop(G, from, def.range, spread);
  const pedD = ped ? dist2(from.x, from.z, ped.x, ped.z) : Infinity;
  const copD = cop ? dist2(from.x, from.z, cop.x, cop.z) : Infinity;
  const endX = from.x + Math.sin(from.heading) * def.range;
  const endZ = from.z + Math.cos(from.heading) * def.range;
  if (ped && pedD <= copD) {
    tracer(G, from, { x: ped.x, z: ped.z });
    ped.down = true;
    ped.downTimer = 4;
    raiseWanted(G, `${def.name} menjatuhkan pejalan kaki! Wanted +1 ★`);
  } else if (cop) {
    tracer(G, from, { x: cop.x, z: cop.z });
    raiseWanted(G, `Kamu menembak mobil polisi! Wanted +1 ★`);
  } else {
    tracer(G, from, { x: endX, z: endZ });
  }
}

// Fists: the old punch — short reach, drops a pedestrian or dents a car.
export function punch(G) {
  const s = G.state;
  const p = G.player;
  if (s.screen !== 'play') return;
  G.audio.thud();
  G.combatFlash = 1; // yellow flash, drawn by the HUD for a few frames
  const reach = s.driving ? 4.2 : 2.8;
  const cx = s.driving && G.car ? G.car.x : p.pos.x;
  const cz = s.driving && G.car ? G.car.z : p.pos.z;

  const ped = nearestPed(G, reach);
  if (ped) {
    ped.down = true;
    ped.downTimer = 4;
    raiseWanted(G, 'Kamu memukul pejalan kaki! Wanted +1 ★');
    return;
  }
  // Punching a police car (on foot, up close) also raises the heat.
  for (const cop of G.police) {
    if (dist2(cx, cz, cop.x, cop.z) < reach + 0.8) {
      raiseWanted(G, 'Kamu memukul mobil polisi! Wanted +1 ★');
      return;
    }
  }
  // Punching a civilian car just dents it.
  for (const car of [...G.parkedCars, ...G.traffic]) {
    if (dist2(cx, cz, car.x, car.z) < reach + 0.6) {
      car.condition = Math.max(0, car.condition - 5);
      G.hud.toast('Mobil penyok!');
      return;
    }
  }
  G.hud.toast('Pukulan meleset…');
}

// F / left click: fists punch, anything else shoots.
export function attack(G) {
  if (G.state.screen !== 'play') return;
  if (G.weapon === 0) {
    punch(G);
    return;
  }
  shoot(G, weaponDef(G.weapon));
}

export function horn(G) {
  if (G.state.screen !== 'play') return;
  G.audio.horn();
  if (G.state.driving) G.hud.toast('Klakson!');
}

// Fade out old tracers; called once per frame from the main loop.
export function updateTracers(G, dt) {
  if (!G._tracers) return;
  for (let i = G._tracers.length - 1; i >= 0; i -= 1) {
    const t = G._tracers[i];
    t.ttl -= dt;
    if (t.ttl <= 0) {
      G.scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
      G._tracers.splice(i, 1);
    }
  }
}
