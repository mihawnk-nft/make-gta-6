// Side jobs: one blue beacon at a time, somewhere in the city. Reach it
// and the district pays +$150, +25 RP and +20 standing. The next job moves
// to the next district in the list, so every neighbourhood gets its turn.
import * as THREE from 'three';
import { DISTRICTS, SIDEJOB_CASH, SIDEJOB_RP, SIDEJOB_STANDING, WORLD } from './config.js';
import { dist2 } from './rng.js';
import { addRp } from './rank.js';
import { addStanding } from './districts.js';
import { writeSave } from './save.js';

// Pick a road-side point inside a district: on an avenue when possible so
// the beacon is always reachable on foot or by car.
function pickSpot(rng, district) {
  const roads = WORLD.roads.filter((r) => r >= district.minX && r < district.maxX);
  const cross = WORLD.roads.filter((r) => r >= district.minZ && r < district.maxZ);
  const tries = [];
  if (roads.length) {
    for (const r of roads) {
      tries.push({ x: r + 4.2, z: (district.minZ + district.maxZ) / 2 });
      tries.push({ x: r - 4.2, z: (district.minZ + district.maxZ) / 2 });
    }
  }
  if (cross.length) {
    for (const r of cross) {
      tries.push({ x: (district.minX + district.maxX) / 2, z: r + 4.2 });
      tries.push({ x: (district.minX + district.maxX) / 2, z: r - 4.2 });
    }
  }
  if (!tries.length) {
    return {
      x: Math.max(district.minX + 6, Math.min(district.maxX - 6, (district.minX + district.maxX) / 2)),
      z: Math.max(district.minZ + 6, Math.min(district.maxZ - 6, (district.minZ + district.maxZ) / 2)),
    };
  }
  return tries[Math.floor(rng() * tries.length)];
}

export function createSideJob(G) {
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x3fa9ff,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 55, 12, 1, true), beamMat);
  beam.position.y = 27;
  G.scene.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.0, 3.0, 32),
    new THREE.MeshBasicMaterial({ color: 0x3fa9ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  G.scene.add(ring);
  // A small blue marker box so the beacon reads even from far away.
  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.6, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x2f7fd9, emissive: 0x1a5fb0, emissiveIntensity: 0.8 }),
  );
  marker.position.y = 2.2;
  G.scene.add(marker);
  const job = {
    beam, ring, marker,
    districtIndex: 2, // start in Kota Tua
    district: DISTRICTS[1].name,
    target: { x: 0, z: 0 },
  };
  G.sidejob = job;
  placeSideJob(G, job);
  return job;
}

function placeSideJob(G, job) {
  const district = DISTRICTS[job.districtIndex % DISTRICTS.length];
  job.district = district.name;
  const spot = pickSpot(G._sidejobRng, district);
  job.target.x = spot.x;
  job.target.z = spot.z;
  job.beam.position.x = spot.x;
  job.beam.position.z = spot.z;
  job.ring.position.x = spot.x;
  job.ring.position.z = spot.z;
  job.marker.position.x = spot.x;
  job.marker.position.z = spot.z;
}

export function sideJobLine(G) {
  const job = G.sidejob;
  if (!job) return '';
  return `Side job: ${job.district} — capai beacon biru (+$${SIDEJOB_CASH}, +${SIDEJOB_RP} RP)`;
}

export function updateSideJob(G, dt) {
  const job = G.sidejob;
  if (!job) return;
  const pulse = 0.3 + Math.sin(G.state.time * 3.2) * 0.12;
  job.beam.material.opacity = pulse;
  job.marker.rotation.y += dt * 1.4;
  job.marker.position.y = 2.2 + Math.sin(G.state.time * 2) * 0.35;

  const s = G.state;
  const px = s.driving && G.car ? G.car.x : G.player.pos.x;
  const pz = s.driving && G.car ? G.car.z : G.player.pos.z;
  if (dist2(px, pz, job.target.x, job.target.z) > 6) return;

  // Job done: cash, standing and RP, then the next district's job appears.
  s.cash += SIDEJOB_CASH;
  s.stats.sideJobsDone = (s.stats.sideJobsDone || 0) + 1;
  addStanding(G, job.district, SIDEJOB_STANDING);
  addRp(G, SIDEJOB_RP);
  G.audio.chime();
  const doneDistrict = job.district;
  job.districtIndex += 1;
  placeSideJob(G, job);
  G.hud.toast(`Side job selesai di ${doneDistrict}! +$${SIDEJOB_CASH}, +${SIDEJOB_RP} RP — job baru di ${job.district}`);
  writeSave(G);
}
