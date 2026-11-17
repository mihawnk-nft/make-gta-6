// Pedestrians: 18 walkers strolling the sidewalks. A punched pedestrian
// falls flat, then gets up somewhere else in the city.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { createRng, pick, range, dist2 } from './rng.js';

const SHIRTS = [0xe8e8e8, 0x4fae5e, 0xd9a03c, 0x8a5fd0, 0x3d7bd9, 0xd94f3d, 0xe07b39, 0x2b2f36];

function makePedMesh(G, shirt) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: pick(G._rng, [0xe8b98a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0]) });
  const top = new THREE.MeshStandardMaterial({ color: shirt });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2e3a55 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.3), top);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.36), skin);
  head.position.y = 1.62;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.22), pants);
  legL.position.set(-0.14, 0.33, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  group.add(legR);
  G.scene.add(group);
  return { group, legL, legR };
}

function randomSidewalkSpot(rng) {
  const road = pick(rng, WORLD.roads);
  const along = range(rng, -110, 110);
  const side = rng() < 0.5 ? -8.5 : 8.5;
  if (rng() < 0.5) return { x: road + side, z: along, axis: 'z' };
  return { x: along, z: road + side, axis: 'x' };
}

export function spawnPedestrians(G) {
  const rng = createRng(23);
  G._rng = rng;
  const peds = [];
  for (let i = 0; i < 18; i += 1) {
    const spot = randomSidewalkSpot(rng);
    const mesh = makePedMesh(G, pick(rng, SHIRTS));
    mesh.group.position.set(spot.x, 0, spot.z);
    peds.push({
      x: spot.x,
      z: spot.z,
      axis: spot.axis,
      dir: rng() < 0.5 ? 1 : -1,
      speed: range(rng, 1.2, 2.4),
      down: false,
      downTimer: 0,
      phase: rng() * Math.PI * 2,
      mesh,
    });
  }
  return peds;
}

export function updatePedestrians(G, dt) {
  for (const ped of G.peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      ped.mesh.group.rotation.x = -Math.PI / 2; // lying flat
      if (ped.downTimer <= 0) {
        // Get up somewhere else in the city.
        const spot = randomSidewalkSpot(G._rng);
        ped.x = spot.x;
        ped.z = spot.z;
        ped.axis = spot.axis;
        ped.down = false;
        ped.mesh.group.rotation.x = 0;
        ped.mesh.group.position.set(ped.x, 0, ped.z);
      }
      continue;
    }
    ped.phase += dt * ped.speed * 3;
    const swing = Math.sin(ped.phase) * 0.4;
    ped.mesh.legL.rotation.x = swing;
    ped.mesh.legR.rotation.x = -swing;
    if (ped.axis === 'z') {
      ped.z += ped.dir * ped.speed * dt;
      if (ped.z > 118 || ped.z < -118) ped.dir *= -1;
      ped.mesh.group.rotation.y = ped.dir > 0 ? 0 : Math.PI;
    } else {
      ped.x += ped.dir * ped.speed * dt;
      if (ped.x > 118 || ped.x < -118) ped.dir *= -1;
      ped.mesh.group.rotation.y = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    ped.mesh.group.position.set(ped.x, 0, ped.z);
  }
}

// The nearest pedestrian within range in front of the player (or any
// direction when range is generous — a punch is a punch).
export function nearestPed(G, maxDist) {
  const p = G.player;
  let best = null;
  let bestD = maxDist;
  for (const ped of G.peds) {
    if (ped.down) continue;
    const d = dist2(p.pos.x, p.pos.z, ped.x, ped.z);
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  return best;
}
