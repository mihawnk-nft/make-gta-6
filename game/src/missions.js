// Missions: ten chained jobs for Mara Voss in three acts. Each target is
// marked by a tall yellow light beam in the world and a star on the
// minimap. Rewards set the cash to the exact spec amounts ($400 … $10000)
// and pay +100 RP each.
import * as THREE from 'three';
import { MISSIONS, ACTS } from './config.js';
import { dist2 } from './rng.js';
import { addRp } from './rank.js';
import { writeSave } from './save.js';

export function createMissions(G) {
  // Vertical beacon beam + a glowing ring at the target.
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffd23c,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true), beamMat);
  beam.position.y = 30;
  G.scene.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.4, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.1;
  G.scene.add(ring);
  return { beam, ring };
}

export function currentMission(G) {
  const idx = G.state.missionIndex;
  return idx < MISSIONS.length ? MISSIONS[idx] : null;
}

export function missionAct(G) {
  const m = currentMission(G);
  if (!m) return { act: 3, name: 'Menuju Bebas' };
  const found = ACTS.find((a) => m.id >= a.from && m.id <= a.to);
  return found || { act: 1, name: 'Utang Senja' };
}

// "Babak 1 · Misi 1/10 — Utang Senja" (or "BEBAS" when the chain is done).
export function missionActText(G) {
  const m = currentMission(G);
  if (!m) return 'BEBAS — SEMUA MISI SELESAI';
  const a = missionAct(G);
  return `Babak ${a.act} · Misi ${m.id}/10 — ${a.name}`;
}

export function missionTitle(G) {
  const m = currentMission(G);
  return m ? m.title : 'BEBAS — JELAJAHI KOTA';
}

export function missionText(G) {
  const m = currentMission(G);
  return m ? m.text : 'Semua misi selesai. Kota ini milikmu, Mara.';
}

export function updateMissions(G, dt) {
  const m = currentMission(G);
  const beacon = G.missions;
  if (!m) {
    beacon.beam.visible = false;
    beacon.ring.visible = false;
    return;
  }
  beacon.beam.visible = true;
  beacon.ring.visible = true;
  beacon.beam.position.x = m.target.x;
  beacon.beam.position.z = m.target.z;
  beacon.ring.position.x = m.target.x;
  beacon.ring.position.z = m.target.z;
  // Pulse the beam so it reads as a live marker.
  const pulse = 0.3 + Math.sin(G.state.time * 3) * 0.12;
  beacon.beam.material.opacity = pulse;
  beacon.ring.scale.setScalar(1 + Math.sin(G.state.time * 3) * 0.08);

  const s = G.state;
  const px = s.driving && G.car ? G.car.x : G.player.pos.x;
  const pz = s.driving && G.car ? G.car.z : G.player.pos.z;
  const d = dist2(px, pz, m.target.x, m.target.z);
  if (d > m.radius) return;
  if (m.needsCar && !s.driving) {
    // Standing at the drop-off on foot does not count — bring the car.
    if (!G._needsCarToast || G.state.time - G._needsCarToast > 5) {
      G._needsCarToast = G.state.time;
      G.hud.toast('Misi ini butuh mobil — bawa mobil ke sini!');
    }
    return;
  }
  // Mission complete: exact cash, +100 RP, next job (or freedom).
  s.cash = m.rewardCash;
  s.missionIndex += 1;
  addRp(G, m.rewardRp);
  G.audio.chime();
  const next = currentMission(G);
  G.hud.toast(next ? `Misi selesai! Uang $${s.cash} — ${next.title}` : `Semua misi selesai! Uang $${s.cash} — BEBAS!`);
  writeSave(G);
}
