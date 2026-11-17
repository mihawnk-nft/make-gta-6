// Traffic: ordinary drivers looping around the city's blocks on the road
// grid, at city speeds, so the avenues always feel alive. Each car follows a
// rectangular loop around one block; at each corner it turns to the next leg.
import { createCarMesh, CAR_COLORS } from './vehicles.js';

export function createTraffic(scene, rng, count = 14) {
  const cars = [];
  const blockCenters = [-75, -25, 25, 75];
  for (let i = 0; i < count; i++) {
    const bx = rng.pick(blockCenters);
    const bz = rng.pick(blockCenters);
    const half = 25;
    const lane = 3.2;
    // Rectangle on the four roads around the block; the lane offset puts
    // every leg on its right-hand side of the road. Half the drivers go
    // clockwise, half counter-clockwise (mirrored corners, same rule).
    const clockwise = rng.chance(0.5);
    const loop = clockwise ? [
      { x: bx - half + lane, z: bz - half + lane },
      { x: bx + half - lane, z: bz - half + lane },
      { x: bx + half - lane, z: bz + half - lane },
      { x: bx - half + lane, z: bz + half - lane },
    ] : [
      { x: bx + half + lane, z: bz - half - lane },
      { x: bx - half - lane, z: bz - half - lane },
      { x: bx - half - lane, z: bz + half + lane },
      { x: bx + half + lane, z: bz + half + lane },
    ];
    const mesh = createCarMesh(rng.pick(CAR_COLORS));
    scene.add(mesh);
    const cruise = rng.range(7, 11);
    cars.push({
      mesh,
      loop,
      leg: rng.int(0, 3),
      t: rng.next(),
      speed: cruise,
      baseSpeed: cruise,
      curSpeed: cruise, // current speed: drops to 0 when yielding to the player
    });
  }

  function placeCar(car) {
    const a = car.loop[car.leg];
    const b = car.loop[(car.leg + 1) % 4];
    const x = a.x + (b.x - a.x) * car.t;
    const z = a.z + (b.z - a.z) * car.t;
    car.mesh.position.set(x, 0, z);
    car.mesh.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    return { x, z };
  }

  return {
    cars,
    // Take a car out of the loop for good (Mara just stole it).
    remove(car) {
      const i = cars.indexOf(car);
      if (i >= 0) cars.splice(i, 1);
    },
    // The nearest car that has stopped, within maxDist of (x, z) — the
    // one Mara can climb into with E. A stopped car is either yielding
    // to her or crawling after a crash.
    stoppedNear(x, z, maxDist) {
      let best = null;
      let bestDist = maxDist;
      for (const car of cars) {
        if (car.curSpeed > 0.5) continue;
        const d = Math.hypot(car.mesh.position.x - x, car.mesh.position.z - z);
        if (d < bestDist) { best = car; bestDist = d; }
      }
      return best;
    },
    update(dt, playerPos) {
      for (const car of cars) {
        // Yield: when Mara stands in front of the car, brake to a stop
        // instead of running her over; pull away again once she is clear.
        let blocked = false;
        if (playerPos) {
          const a = car.loop[car.leg];
          const b = car.loop[(car.leg + 1) % 4];
          const fx = b.x - a.x;
          const fz = b.z - a.z;
          const fl = Math.hypot(fx, fz) || 1;
          const px = playerPos.x - car.mesh.position.x;
          const pz = playerPos.z - car.mesh.position.z;
          const dist = Math.hypot(px, pz);
          const ahead = (px * fx + pz * fz) / fl;
          blocked = dist < 9 && ahead > 0;
        }
        car.curSpeed = blocked
          ? Math.max(0, car.curSpeed - 24 * dt)
          : Math.min(car.baseSpeed, car.curSpeed + 8 * dt);
        const a = car.loop[car.leg];
        const b = car.loop[(car.leg + 1) % 4];
        const legLen = Math.hypot(b.x - a.x, b.z - a.z);
        car.t += (car.curSpeed * dt) / legLen;
        if (car.t >= 1) {
          car.t -= 1;
          car.leg = (car.leg + 1) % 4;
        }
        placeCar(car);
      }
    },
    positions() {
      return cars.map((car) => ({ x: car.mesh.position.x, z: car.mesh.position.z }));
    },
  };
}
