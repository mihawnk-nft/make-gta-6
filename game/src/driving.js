// Driving: gas / brake / reverse / steering for the car Mara is in,
// plus entering and exiting cars (E). The car stays parked where she
// leaves it, so it can be found again later.
import { CAR_TUNE } from './config.js';
import { clamp, dist2 } from './rng.js';
import { collideCircle, insideWorld } from './city.js';
import { syncCarMesh } from './vehicles.js';
import { bustPlayer } from './police.js';

export function enterCar(G, car) {
  G.car = car;
  G.state.driving = true;
  G.player.mesh.visible = false;
  car.kind = 'player';
  car.stopped = false;
  if (!car.stolen) {
    car.stolen = true;
    G.state.wanted = Math.min(5, G.state.wanted + 1);
    G.state.chaseTimer = 0;
    G.state.hiddenTimer = 0;
    G.hud.toast('Mobil dicuri! Wanted +1 ★');
    G.audio.thud();
  } else {
    G.hud.toast(`Masuk ${car.name}`);
  }
  // Snap the chase camera behind the car.
  G.input.camera.yaw = car.angle + Math.PI;
  G.audio.engine(true, 0);
}

export function exitCar(G) {
  const car = G.car;
  if (!car) return;
  car.speed = 0;
  car.kind = 'parked';
  G.parkedCars.push(car);
  G.state.driving = false;
  G.car = null;
  G.audio.engine(false, 0);
  // Step out beside the car.
  const side = car.angle + Math.PI / 2;
  const px = car.x + Math.sin(side) * 2.4;
  const pz = car.z + Math.cos(side) * 2.4;
  const solved = collideCircle(G, px, pz, 0.6, 0);
  const bounded = insideWorld(solved.x, solved.z);
  G.player.pos.x = bounded.x;
  G.player.pos.z = bounded.z;
  G.player.pos.y = 0;
  G.player.heading = car.angle;
  G.player.mesh.visible = true;
  G.input.camera.yaw = car.angle + Math.PI;
  G.hud.toast('Keluar dari mobil');
}

export function updateDriving(G, dt) {
  const car = G.car;
  if (!car || !G.state.driving) return;
  const input = G.input;

  if (input.held.up) car.speed += CAR_TUNE.accel * dt;
  else if (input.held.down) {
    if (car.speed > 0.5) car.speed -= CAR_TUNE.brake * dt;
    else car.speed -= CAR_TUNE.accel * 0.55 * dt;
  } else {
    // Coast down — exponential, so the car actually stops in a few seconds.
    car.speed -= car.speed * 1.4 * dt;
    if (Math.abs(car.speed) < 0.3) car.speed = 0;
  }
  car.speed = clamp(car.speed, -CAR_TUNE.maxReverse, CAR_TUNE.maxSpeed);

  const steerInput = (input.held.left ? 1 : 0) - (input.held.right ? 1 : 0);
  const steerAmount = steerInput * CAR_TUNE.steer * dt * clamp(Math.abs(car.speed) / 8, 0, 1);
  car.angle += steerAmount * Math.sign(car.speed || 1);

  let nx = car.x + Math.sin(car.angle) * car.speed * dt;
  let nz = car.z + Math.cos(car.angle) * car.speed * dt;
  const solved = collideCircle(G, nx, nz, CAR_TUNE.radius, 0);
  if (solved.hit && Math.abs(car.speed) > 3) {
    G.audio.crash();
    car.condition = Math.max(0, car.condition - 2);
    G.hud.toast('Mobil menabrak gedung!');
  }
  if (solved.hit) car.speed *= 0.4;
  const bounded = insideWorld(solved.x, solved.z);
  car.x = bounded.x;
  car.z = bounded.z;
  // Do not merge into other cars: push out of any overlap.
  for (const other of [...G.parkedCars, ...G.traffic, ...G.police]) {
    const dd = dist2(car.x, car.z, other.x, other.z);
    if (dd < 3.4 && dd > 0.01) {
      const push = (3.4 - dd) / dd;
      car.x += (car.x - other.x) * push;
      car.z += (car.z - other.z) * push;
    }
  }
  syncCarMesh(car);
  G.audio.engine(true, Math.abs(car.speed) / CAR_TUNE.maxSpeed);

  // Busted when the car is totalled.
  if (car.condition <= 0) {
    bustPlayer(G, 'Mobilmu hancur total!');
  }
}

export function carSpeedKmh(car) {
  return Math.round(Math.abs(car.speed) * 3.6);
}
