// Mara Voss on foot: low-poly figure with swinging limbs, WASD movement
// relative to the camera, Shift to run, Space to jump, building collision,
// and a third-person follow camera that snaps behind her at game start.
import * as THREE from 'three';
import { PLAYER_TUNE, SPAWN } from './config.js';
import { clamp, dist2 } from './rng.js';
import { collideCircle, insideWorld } from './city.js';

export function createPlayer(G) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b98a });
  const jacket = new THREE.MeshStandardMaterial({ color: 0xd94f6a });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2e3a55 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x2b1a12 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), jacket);
  torso.position.y = 1.12;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
  head.position.y = 1.72;
  group.add(head);
  const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.44), hair);
  hairMesh.position.y = 1.95;
  group.add(hairMesh);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pants);
  legL.position.set(-0.16, 0.36, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), jacket);
  armL.position.set(-0.42, 1.14, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armR);

  // Pivot the limbs at the shoulder/hip by offsetting geometry origins.
  legL.geometry.translate(0, -0.36, 0);
  legL.position.y = 0.72;
  legR.geometry.translate(0, -0.36, 0);
  legR.position.y = 0.72;
  armL.geometry.translate(0, -0.31, 0);
  armL.position.y = 1.45;
  armR.geometry.translate(0, -0.31, 0);
  armR.position.y = 1.45;

  group.position.set(SPAWN.x, 0, SPAWN.z);
  G.scene.add(group);

  const player = {
    pos: new THREE.Vector3(SPAWN.x, 0, SPAWN.z),
    heading: SPAWN.heading,
    vy: 0,
    grounded: true,
    speed: 0,
    walkPhase: 0,
    mesh: group,
    limbs: { legL, legR, armL, armR },
    cameraSnapped: false,
  };
  return player;
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  const s = G.state;
  if (s.screen !== 'play' || s.driving) {
    p.mesh.visible = !s.driving;
    return;
  }
  p.mesh.visible = true;

  // Movement is relative to the camera yaw.
  const yaw = input.camera.yaw;
  let mx = 0;
  let mz = 0;
  if (input.held.up) { mx += -Math.sin(yaw); mz += -Math.cos(yaw); }
  if (input.held.down) { mx += Math.sin(yaw); mz += Math.cos(yaw); }
  if (input.held.left) { mx += -Math.cos(yaw); mz += Math.sin(yaw); }
  if (input.held.right) { mx += Math.cos(yaw); mz += -Math.sin(yaw); }
  const len = Math.hypot(mx, mz);
  const running = input.held.run;
  const targetSpeed = len > 0 ? (running ? PLAYER_TUNE.runSpeed : PLAYER_TUNE.walkSpeed) : 0;
  if (len > 0) {
    mx /= len;
    mz /= len;
    p.heading = Math.atan2(mx, mz);
  }
  p.speed += (targetSpeed - p.speed) * Math.min(1, dt * 8);

  let nx = p.pos.x + mx * p.speed * dt;
  let nz = p.pos.z + mz * p.speed * dt;
  const solved = collideCircle(G, nx, nz, PLAYER_TUNE.radius, p.pos.y);
  nx = solved.x;
  nz = solved.z;
  const bounded = insideWorld(nx, nz);
  p.pos.x = bounded.x;
  p.pos.z = bounded.z;

  // Jump + gravity. G.presses is the frame's one-shot press flags.
  if ((G.presses & 16) && p.grounded) {
    p.vy = PLAYER_TUNE.jumpSpeed;
    p.grounded = false;
  }
  if (!p.grounded) {
    p.vy -= PLAYER_TUNE.gravity * dt;
    p.pos.y += p.vy * dt;
    if (p.pos.y <= 0) {
      p.pos.y = 0;
      p.vy = 0;
      p.grounded = true;
    }
  }

  // Walk swing.
  p.walkPhase += dt * p.speed * 1.6;
  const swing = Math.sin(p.walkPhase) * clamp(p.speed / PLAYER_TUNE.walkSpeed, 0, 1.4) * 0.55;
  p.limbs.legL.rotation.x = swing;
  p.limbs.legR.rotation.x = -swing;
  p.limbs.armL.rotation.x = -swing * 0.8;
  p.limbs.armR.rotation.x = swing * 0.8;

  p.mesh.position.set(p.pos.x, p.pos.y, p.pos.z);
  p.mesh.rotation.y = p.heading;
}

export function updateCamera(G, dt) {
  const p = G.player;
  const input = G.input;
  const cam = G.camera;
  // Focus point: the player, or the car when driving.
  let fx = p.pos.x;
  let fz = p.pos.z;
  let fy = p.pos.y + 1.6;
  let heading = p.heading;
  if (G.state.driving && G.car) {
    fx = G.car.x;
    fz = G.car.z;
    fy = 1.4;
    heading = G.car.angle;
  }
  // Snap the orbit behind the player at game start — never lerp from origin.
  if (!p.cameraSnapped) {
    input.camera.yaw = heading + Math.PI;
    p.cameraSnapped = true;
  }
  const yaw = input.camera.yaw;
  // Pull back a little while driving so the whole car stays in frame.
  const dist = input.camera.distance + (G.state.driving && G.car ? 3 : 0);
  const pitch = input.camera.pitch;
  const cx = fx + Math.sin(yaw) * Math.cos(pitch) * dist;
  const cz = fz + Math.cos(yaw) * Math.cos(pitch) * dist;
  const cy = fy + Math.sin(pitch) * dist;
  if (G.state.screen === 'play') {
    // Gentle smoothing once snapped; the snap itself is instant.
    cam.position.x += (cx - cam.position.x) * Math.min(1, dt * 10);
    cam.position.y += (cy - cam.position.y) * Math.min(1, dt * 10);
    cam.position.z += (cz - cam.position.z) * Math.min(1, dt * 10);
  } else {
    cam.position.set(cx, cy, cz);
  }
  cam.lookAt(fx, fy, fz);
}

export function nearestParkedOrStopped(G, maxDist) {
  const p = G.player;
  let best = null;
  let bestD = maxDist;
  const consider = (car) => {
    const d = dist2(p.pos.x, p.pos.z, car.x, car.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  };
  for (const car of G.parkedCars) consider(car);
  for (const car of G.traffic) if (car.stopped) consider(car);
  return best;
}
