// Driving in Sunset Shores: Mara takes the wheel of a parked car or a
// traffic car that stopped for her, and drives it around the city.
//
// Arcade handling on purpose: W/S is gas and brake/reverse, A/D steers
// with the speed, walls and buildings stop the car, and every hard hit
// costs condition. The car is a plain record the caller owns — the mesh
// stays in the scene when Mara gets out, so it becomes a parked car
// again exactly where she left it.
import * as THREE from 'three';
import { resolveBuildingCollisions } from './city.js';

const MAX_SPEED = 27; // ~97 km/h
const MAX_REVERSE = 9;
const ACCEL = 15;
const BRAKE = 30;
const REVERSE_ACCEL = 10;
const DRAG = 0.45; // 1/s of coasting slowdown
const ROLLING = 1.2; // extra drag at low speed, so the car stops by itself
const TURN_RATE = 1.75; // rad/s at full lock and full speed factor
const CAR_RADIUS = 1.7;
const WORLD = { minX: -168, maxX: 128, minZ: -128, maxZ: 128 };

export function createDriving(scene, colliders) {
  let car = null; // { mesh, x, z, heading, speed, health, name, stolen, wheels }

  // A smoke puff that shows over the hood once the car is badly hurt.
  const smoke = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a4a4a, transparent: true, opacity: 0.5 }),
  );
  smoke.visible = false;
  scene.add(smoke);

  function collectWheels(mesh) {
    const wheels = [];
    mesh.traverse((child) => {
      if (child.geometry && child.geometry.type === 'CylinderGeometry') wheels.push(child);
    });
    return wheels;
  }

  return {
    get active() { return car !== null; },
    get car() { return car; },
    get health() { return car ? car.health : 0; },

    // Take the wheel. `vehicle` is { mesh, x, z, heading, name, stolen }.
    enter(vehicle) {
      car = {
        mesh: vehicle.mesh,
        x: vehicle.x,
        z: vehicle.z,
        heading: vehicle.heading,
        speed: 0,
        health: 100,
        name: vehicle.name,
        stolen: Boolean(vehicle.stolen),
        wheels: collectWheels(vehicle.mesh),
      };
      return car;
    },

    // Step out. Returns where the car was left, so the caller can park it.
    exit() {
      if (!car) return null;
      const left = { mesh: car.mesh, x: car.x, z: car.z, heading: car.heading, name: car.name };
      car = null;
      smoke.visible = false;
      return left;
    },

    // Remove the car from the world entirely (impounded after a bust).
    impound() {
      if (!car) return;
      scene.remove(car.mesh);
      car = null;
      smoke.visible = false;
    },

    // Lose condition from a crash. Returns the health that is left.
    damage(amount) {
      if (!car) return 0;
      car.health = Math.max(0, car.health - amount);
      return car.health;
    },

    position() {
      return car ? { x: car.x, z: car.z } : null;
    },
    speedKmh() {
      return car ? Math.round(Math.abs(car.speed) * 3.6) : 0;
    },

    // axes: { x: -1..1 steering, z: -1..1 throttle }. Returns what happened.
    update(dt, axes) {
      if (!car) return { hitWall: false };
      const forward = axes.z > 0;
      const braking = axes.z < 0 && car.speed > 0.5;
      if (forward) car.speed += ACCEL * dt;
      else if (braking) car.speed -= BRAKE * dt;
      else if (axes.z < 0) car.speed -= REVERSE_ACCEL * dt;
      // Drag and rolling resistance, then clamp to the speed limits.
      car.speed -= car.speed * DRAG * dt;
      if (Math.abs(car.speed) < ROLLING * dt && axes.z === 0) car.speed = 0;
      car.speed = Math.max(-MAX_REVERSE, Math.min(MAX_SPEED, car.speed));

      // Steering follows the speed and flips when reversing.
      const grip = Math.min(1, Math.abs(car.speed) / 6);
      const steer = -axes.x; // A (axes.x -1) turns left, heading grows
      car.heading += steer * TURN_RATE * grip * dt * (car.speed >= 0 ? 1 : -1);

      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      const fixed = resolveBuildingCollisions(colliders, nx, nz, CAR_RADIUS);
      const hitWall = Math.hypot(fixed.x - nx, fixed.z - nz) > 0.05;
      if (hitWall) car.speed *= 0.35;
      car.x = Math.max(WORLD.minX, Math.min(WORLD.maxX, fixed.x));
      car.z = Math.max(WORLD.minZ, Math.min(WORLD.maxZ, fixed.z));

      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      for (const wheel of car.wheels) wheel.rotation.x += (car.speed * dt) / 0.36;

      // Smoke once the car is badly hurt, puffing over the hood.
      if (car.health < 35) {
        smoke.visible = true;
        const puff = 1 + Math.sin(performance.now() / 90) * 0.25;
        smoke.scale.setScalar(puff);
        smoke.position.set(
          car.x + Math.sin(car.heading) * 1.4,
          1.6,
          car.z + Math.cos(car.heading) * 1.4,
        );
      } else {
        smoke.visible = false;
      }
      return { hitWall };
    },
  };
}
