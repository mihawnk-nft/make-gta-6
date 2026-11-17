// Wanted system and the Sunset Shores police: stars rise when the player
// steals a car or hits someone, patrol cars spawn and chase, and the heat
// cools off when the player breaks line of sight and stays clean.
// M2: patrol cars chase and ram the player's car, the light bars flash,
// stars fall one at a time after 20 clean seconds, and getting cornered
// — or wrecking the car — means BUSTED.
import * as THREE from 'three';
import { createCarMesh } from './vehicles.js';

const MAX_WANTED = 5;
const COOLDOWN_SECONDS = 20;

export function createPolice(scene) {
  const patrol = [];
  let wanted = 0;
  let cleanTimer = 0;
  let chaseTimer = 0;
  let caughtTimer = 0;
  let spawnTimer = 0;
  let ramCooldown = 0;
  let clock = 0;
  let busted = false;
  let ramHandler = null;

  function spawnPatrolCar(x, z) {
    const mesh = createCarMesh(0x1a1a2e);
    // A red-and-blue light bar on the roof marks the patrol car.
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 1.5 });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), redMat);
    red.position.set(-0.32, 1.5, -0.25);
    mesh.add(red);
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x2266ff, emissive: 0x0033ff, emissiveIntensity: 1.5 });
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), blueMat);
    blue.position.set(0.32, 1.5, -0.25);
    mesh.add(blue);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const car = { mesh, x, z, speed: 0, redMat, blueMat };
    patrol.push(car);
    return car;
  }

  return {
    get wanted() { return wanted; },
    get busted() { return busted; },
    patrol,
    raiseWanted(level) {
      wanted = Math.min(MAX_WANTED, Math.max(wanted, level));
      cleanTimer = 0;
      chaseTimer = 0;
      if (wanted >= 1 && patrol.length === 0) spawnPatrolCar(20, -30);
    },
    // Add stars on top of the current level (hitting someone, long chase).
    addWanted(n) { this.raiseWanted(wanted + n); },
    lowerWanted() {
      wanted = Math.max(0, wanted - 1);
    },
    // The game loop's answer to a patrol car ramming the player's car.
    setRamHandler(fn) { ramHandler = fn; },
    // Called after a bust is resolved: heat gone, patrol stands down.
    resetAfterBust() {
      wanted = 0;
      cleanTimer = 0;
      chaseTimer = 0;
      caughtTimer = 0;
      busted = false;
    },
    update(dt, playerPos, drive) {
      clock += dt;
      ramCooldown = Math.max(0, ramCooldown - dt);
      spawnTimer = Math.max(0, spawnTimer - dt);
      const driving = Boolean(drive && drive.driving);
      const playerSpeed = drive ? drive.speedKmh : 0;

      // Reinforcements: up to one patrol car per wanted star (max 3).
      if (wanted > 0 && patrol.length < Math.min(wanted, 3) && spawnTimer <= 0) {
        spawnTimer = 2;
        const angle = Math.random() * Math.PI * 2;
        spawnPatrolCar(
          Math.max(-160, Math.min(120, playerPos.x + Math.cos(angle) * 38)),
          Math.max(-120, Math.min(120, playerPos.z + Math.sin(angle) * 38)),
        );
      }

      // Heat cools one star at a time, but only after 20 seconds with
      // no patrol car close enough to see the player.
      let nearest = Infinity;
      for (const car of patrol) {
        nearest = Math.min(nearest, Math.hypot(playerPos.x - car.x, playerPos.z - car.z));
      }
      if (wanted > 0) {
        if (nearest < 55) cleanTimer = 0;
        else {
          cleanTimer += dt;
          if (cleanTimer > COOLDOWN_SECONDS) {
            wanted = Math.max(0, wanted - 1);
            cleanTimer = 0;
          }
        }
        // Being chased for a long time is its own crime: +1 star per
        // 30 seconds with a patrol car on the player's tail.
        if (nearest < 25) {
          chaseTimer += dt;
          if (chaseTimer > 30) {
            chaseTimer = 0;
            this.addWanted(1);
          }
        } else {
          chaseTimer = Math.max(0, chaseTimer - dt);
        }
      }

      // Patrol cars cruise the avenue near the player while wanted.
      for (const car of patrol) {
        // Flash the light bar, red and blue alternating.
        const phase = Math.floor(clock * 5) % 2 === 0;
        car.redMat.emissiveIntensity = phase ? 2.5 : 0.3;
        car.blueMat.emissiveIntensity = phase ? 0.3 : 2.5;
        if (wanted === 0) continue;
        const dx = playerPos.x - car.x;
        const dz = playerPos.z - car.z;
        const dist = Math.hypot(dx, dz);
        // Faster after a car than after a pedestrian, but never faster
        // than the player's top speed: escape stays possible.
        const speed = driving
          ? Math.min(24, 17 + wanted * 2)
          : 9 + wanted * 1.5;
        if (dist > 2.5) {
          car.x += (dx / dist) * speed * dt;
          car.z += (dz / dist) * speed * dt;
          car.mesh.position.set(car.x, 0, car.z);
          car.mesh.rotation.y = Math.atan2(dx, dz);
        }
        // Ram the player's car on contact; on foot, being cornered
        // for a few seconds means getting caught.
        if (driving && dist < 3.4) {
          if (ramCooldown <= 0) {
            ramCooldown = 1.2;
            if (ramHandler) ramHandler(14);
          }
          car.x -= (dx / (dist || 1)) * 1.5;
          car.z -= (dz / (dist || 1)) * 1.5;
        }
        const cornered = driving ? (playerSpeed < 5 && dist < 3.5) : dist < 2.2;
        if (cornered) {
          caughtTimer += dt;
          if (caughtTimer > 2.5) busted = true;
        } else {
          caughtTimer = Math.max(0, caughtTimer - dt * 2);
        }
      }
    },
  };
}
