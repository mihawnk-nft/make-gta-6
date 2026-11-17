// Traffic: 14 cars driving on the right around the blocks. Each car follows
// a rectangular loop on the roads around one block. A car stops when Mara
// stands in front of it — and then it can be stolen with E.
import { WORLD } from './config.js';
import { createRng, pick, range, dist2, angleDiff } from './rng.js';
import { makeCar, syncCarMesh } from './vehicles.js';
import { CAR_NAMES, CAR_COLORS } from './config.js';

function loopWaypoints(bx, bz) {
  // Rectangle on the four roads around block (bx, bz), driven clockwise
  // (right-hand traffic): the loop's corners, in driving order.
  const r = 22;
  return [
    { x: bx - r, z: bz - r },
    { x: bx + r, z: bz - r },
    { x: bx + r, z: bz + r },
    { x: bx - r, z: bz + r },
  ];
}

export function spawnTraffic(G) {
  const rng = createRng(41);
  const cars = [];
  const blocks = [];
  for (const bx of WORLD.blocks) for (const bz of WORLD.blocks) blocks.push({ bx, bz });
  for (let i = 0; i < 14; i += 1) {
    const block = blocks[i % blocks.length];
    const loop = loopWaypoints(block.bx, block.bz);
    const start = Math.floor(rng() * 4);
    const wp = loop[start];
    const next = loop[(start + 1) % 4];
    const angle = Math.atan2(next.x - wp.x, next.z - wp.z);
    // Spread cars along the starting edge.
    const t = rng();
    const x = wp.x + (next.x - wp.x) * t;
    const z = wp.z + (next.z - wp.z) * t;
    const car = makeCar(G, {
      kind: 'traffic',
      name: pick(rng, CAR_NAMES),
      color: pick(rng, CAR_COLORS),
      x,
      z,
      angle,
      loop,
    });
    car.waypoint = (start + 1) % 4;
    car.speed = range(rng, 7, 10.5);
    car.cruise = car.speed;
    cars.push(car);
  }
  return cars;
}

export function updateTraffic(G, dt) {
  const p = G.player;
  for (const car of G.traffic) {
    if (!car.loop) continue;
    const target = car.loop[car.waypoint];
    const dx = target.x - car.x;
    const dz = target.z - car.z;
    const d = Math.hypot(dx, dz);
    if (d < 2.5) {
      car.waypoint = (car.waypoint + 1) % 4;
      continue;
    }
    const wantAngle = Math.atan2(dx, dz);
    car.angle += angleDiff(car.angle, wantAngle) * Math.min(1, dt * 4);

    // Stop for Mara standing in front, or for the car ahead.
    const fx = car.x + Math.sin(car.angle) * 3.2;
    const fz = car.z + Math.cos(car.angle) * 3.2;
    let blocked = false;
    if (!G.state.driving && dist2(fx, fz, p.pos.x, p.pos.z) < 3.4) blocked = true;
    if (G.state.driving && G.car && dist2(fx, fz, G.car.x, G.car.z) < 4.5) blocked = true;
    for (const other of G.traffic) {
      if (other === car) continue;
      if (dist2(fx, fz, other.x, other.z) < 4.5) { blocked = true; break; }
    }
    for (const cop of G.police) {
      if (dist2(fx, fz, cop.x, cop.z) < 4.5) { blocked = true; break; }
    }
    car.stopped = blocked;
    const targetSpeed = blocked ? 0 : car.cruise;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 3);
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.z += Math.cos(car.angle) * car.speed * dt;
    syncCarMesh(car);
  }
}
