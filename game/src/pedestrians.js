// Pedestrians: townsfolk strolling the sidewalks on short waypoint walks,
// each a small low-poly figure in a random shirt, bobbing as they go.
import * as THREE from 'three';

const SHIRTS = [0x2ecc71, 0xe74c3c, 0x9b59b6, 0x1abc9c, 0xf39c12, 0xecf0f1, 0xfd79a8];
const SKINS = [0xc98d64, 0x8d5524, 0xffdbac, 0x6b4226];

export function createPedestrians(scene, rng, count = 18) {
  const walkers = [];
  const shirtMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
  for (let i = 0; i < count; i++) {
    const figure = new THREE.Group();
    const shirt = shirtMat(rng.pick(SHIRTS));
    const skin = new THREE.MeshStandardMaterial({ color: rng.pick(SKINS), roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.36), shirt);
    body.position.y = 1.1;
    body.castShadow = true;
    figure.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
    head.position.y = 1.78;
    head.castShadow = true;
    figure.add(head);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x333a45, roughness: 1 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.26), legMat);
    legL.position.set(-0.16, 0.35, 0);
    figure.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.16;
    figure.add(legR);
    scene.add(figure);
    walkers.push({
      figure, legL, legR,
      x: rng.range(-110, 110),
      z: rng.range(-110, 110),
      targetX: 0, targetZ: 0,
      speed: rng.range(1.0, 1.8),
      phase: rng.range(0, Math.PI * 2),
    });
  }

  function pickTarget(w) {
    // A new nearby sidewalk point: snap to a block edge and walk along it.
    const bx = Math.round(w.x / 50) * 50;
    const bz = Math.round(w.z / 50) * 50;
    if (rng.chance(0.5)) {
      w.targetX = Math.max(-118, Math.min(118, bx + rng.range(-40, 40)));
      w.targetZ = bz + rng.pick([-19, 19]);
    } else {
      w.targetX = bx + rng.pick([-19, 19]);
      w.targetZ = Math.max(-118, Math.min(118, bz + rng.range(-40, 40)));
    }
  }
  for (const w of walkers) pickTarget(w);

  return {
    walkers,
    update(dt) {
      for (const w of walkers) {
        const dx = w.targetX - w.x;
        const dz = w.targetZ - w.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.6) { pickTarget(w); continue; }
        w.x += (dx / dist) * w.speed * dt;
        w.z += (dz / dist) * w.speed * dt;
        w.figure.position.set(w.x, 0, w.z);
        w.figure.rotation.y = Math.atan2(dx, dz);
        w.phase += dt * w.speed * 4;
        const swing = Math.sin(w.phase) * 0.4;
        w.legL.rotation.x = swing;
        w.legR.rotation.x = -swing;
      }
    },
    positions() {
      return walkers.map((w) => ({ x: w.x, z: w.z }));
    },
  };
}
