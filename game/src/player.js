// Mara Voss on foot: a simple low-poly figure (capsule body, head, limbs)
// with WASD movement relative to the camera, Shift to run, Space to jump,
// and a third-person camera that orbits with the mouse.
import * as THREE from 'three';
import { resolveBuildingCollisions } from './city.js';

const WALK_SPEED = 4.5;
const RUN_SPEED = 8.5;
const JUMP_SPEED = 8.5;
const GRAVITY = 24;
const PLAYER_RADIUS = 0.55;

export function createPlayer(scene, spawn) {
  const group = new THREE.Group();
  group.name = 'MaraVoss';

  const shirt = new THREE.MeshStandardMaterial({ color: 0xff7f2a, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2e4057, roughness: 0.9 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1c1210, roughness: 1 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.4), shirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.42), skin);
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.46), hair);
  hairTop.position.y = 2.1;
  group.add(hairTop);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.3), pants);
  legL.position.set(-0.19, 0.38, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.19;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), shirt);
  armL.position.set(-0.48, 1.2, 0);
  armL.castShadow = true;
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.48;
  group.add(armR);

  group.position.set(spawn.x, 0, spawn.z);
  scene.add(group);

  const state = {
    group,
    x: spawn.x,
    z: spawn.z,
    y: 0,
    vy: 0,
    heading: spawn.yaw,
    speed: 0,
    grounded: true,
    walkPhase: 0,
  };

  return {
    state,
    // dt seconds, axes from input, cameraYaw from the camera rig.
    update(dt, axes, running, jumpPressed, cameraYaw, colliders) {
      const speed = running ? RUN_SPEED : WALK_SPEED;
      const forwardX = -Math.sin(cameraYaw);
      const forwardZ = -Math.cos(cameraYaw);
      const rightX = Math.cos(cameraYaw);
      const rightZ = -Math.sin(cameraYaw);
      let mx = forwardX * axes.z + rightX * axes.x;
      let mz = forwardZ * axes.z + rightZ * axes.x;
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        mx /= len; mz /= len;
        state.x += mx * speed * dt;
        state.z += mz * speed * dt;
        state.heading = Math.atan2(mx, mz);
        state.speed = speed;
        state.walkPhase += dt * speed * 1.6;
      } else {
        state.speed = 0;
      }
      const clamped = resolveBuildingCollisions(colliders, state.x, state.z, PLAYER_RADIUS);
      state.x = Math.max(-168, Math.min(128, clamped.x));
      state.z = Math.max(-128, Math.min(128, clamped.z));

      if (jumpPressed && state.grounded) {
        state.vy = JUMP_SPEED;
        state.grounded = false;
      }
      if (!state.grounded) {
        state.vy -= GRAVITY * dt;
        state.y += state.vy * dt;
        if (state.y <= 0) { state.y = 0; state.vy = 0; state.grounded = true; }
      }
      group.position.set(state.x, state.y, state.z);
      group.rotation.y = state.heading;
      // Simple walk swing on the limbs.
      const swing = state.speed > 0 ? Math.sin(state.walkPhase) * 0.55 : 0;
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.8;
      armR.rotation.x = swing * 0.8;
    },
    position() { return { x: state.x, z: state.z, y: state.y }; },
    speedKmh() { return Math.round(state.speed * 3.6); },
    hide() { group.visible = false; },
    show() { group.visible = true; },
  };
}
