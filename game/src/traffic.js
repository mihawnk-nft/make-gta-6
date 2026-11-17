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
    cars.push({
      mesh,
      loop,
      leg: rng.int(0, 3),
      t: rng.next(),
      speed: rng.range(7, 11),
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
    update(dt) {
      for (const car of cars) {
        const a = car.loop[car.leg];
        const b = car.loop[(car.leg + 1) % 4];
        const legLen = Math.hypot(b.x - a.x, b.z - a.z);
        car.t += (car.speed * dt) / legLen;
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
