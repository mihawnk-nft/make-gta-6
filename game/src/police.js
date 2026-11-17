// Wanted system and the Sunset Shores police: stars rise when the player
// steals a car or hits someone, patrol cars spawn and chase, and the heat
// cools off when the player breaks line of sight and stays clean.
// M1: the state machine, the star display and one patrol car are live;
// the full chase-and-ram behaviour lands with the driving milestone.
import * as THREE from 'three';
import { createCarMesh } from './vehicles.js';

const MAX_WANTED = 5;
const COOLDOWN_SECONDS = 20;

export function createPolice(scene) {
  const patrol = [];
  let wanted = 0;
  let cleanTimer = 0;

  function spawnPatrolCar(x, z) {
    const mesh = createCarMesh(0x1a1a2e);
    // A red-and-blue light bar on the roof marks the patrol car.
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 1.5 }),
    );
    red.position.set(-0.32, 1.5, -0.25);
    mesh.add(red);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x2266ff, emissive: 0x0033ff, emissiveIntensity: 1.5 }),
    );
    blue.position.set(0.32, 1.5, -0.25);
    mesh.add(blue);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const car = { mesh, x, z, speed: 0 };
    patrol.push(car);
    return car;
  }

  return {
    get wanted() { return wanted; },
    patrol,
    raiseWanted(level) {
      wanted = Math.min(MAX_WANTED, Math.max(wanted, level));
      cleanTimer = 0;
      if (wanted >= 1 && patrol.length === 0) spawnPatrolCar(20, -30);
    },
    lowerWanted() {
      wanted = Math.max(0, wanted - 1);
    },
    update(dt, playerPos) {
      if (wanted > 0) {
        cleanTimer += dt;
        if (cleanTimer > COOLDOWN_SECONDS) {
          wanted = 0;
          cleanTimer = 0;
        }
      }
      // Patrol cars cruise the avenue near the player while wanted.
      for (const car of patrol) {
        if (wanted === 0) continue;
        const dx = playerPos.x - car.x;
        const dz = playerPos.z - car.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 2.5) {
          const speed = 9 + wanted * 1.5;
          car.x += (dx / dist) * speed * dt;
          car.z += (dz / dist) * speed * dt;
          car.mesh.position.set(car.x, 0, car.z);
          car.mesh.rotation.y = Math.atan2(dx, dz);
        }
      }
    },
  };
}
