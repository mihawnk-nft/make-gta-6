// SUNSET SHORES — bootstrap and the one game loop. Builds the city, the
// player, traffic, pedestrians, police and missions, runs them in fixed
// 1/60 s steps, and paints the scene with a third-person follow camera.
//
// ?shot=cover stages the cover scene instead of waiting for a click:
// the player stands on the central avenue at sunset, traffic and a patrol
// car in frame, then sets window.__shotReady for a screenshot.
import * as THREE from 'three';
import { createSeededRandom } from './rng.js';
import { buildCity } from './city.js';
import { createPlayer } from './player.js';
import { spawnParkedCars } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createDriving } from './driving.js';
import { createCombat } from './combat.js';
import { createMissionLog } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import {
  createInput,
  PRESS_ENTER_CAR, PRESS_JUMP, PRESS_HORN, PRESS_PAUSE, PRESS_MUTE, PRESS_START,
  PRESS_PUNCH,
} from './input.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;
const rng = createSeededRandom(seed);

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const city = buildCity(scene, rng);
const player = createPlayer(scene, city.spawn);
const parkedCars = spawnParkedCars(scene, rng);
const traffic = createTraffic(scene, rng, 14);
const pedestrians = createPedestrians(scene, rng, 18);
const police = createPolice(scene);
const driving = createDriving(scene, city.colliders);
const combat = createCombat(scene);
const hud = createHud();
const audio = createAudio();
const input = createInput(canvas);

const saved = loadSave();
const missions = createMissionLog((message) => hud.showToast(message));

// Read-only handle for Playwright-driven checks (position, cash, wanted).
window.__sunset = { player, missions, police, traffic, pedestrians, parkedCars, city, driving, audio };

// A glowing beacon marks the current mission target in the world, so the
// player can see where to go without staring at the minimap.
const beaconGem = new THREE.Mesh(
  new THREE.OctahedronGeometry(1.1),
  new THREE.MeshBasicMaterial({ color: 0xffd23f }),
);
const beacon = new THREE.Group();
const beaconBeam = new THREE.Mesh(
  new THREE.CylinderGeometry(1.2, 1.2, 30, 12, 1, true),
  new THREE.MeshBasicMaterial({
    color: 0xffd23f, transparent: true, opacity: 0.25,
    side: THREE.DoubleSide, depthWrite: false,
  }),
);
beaconBeam.position.y = 15;
beaconGem.position.y = 3;
beacon.add(beaconBeam);
beacon.add(beaconGem);
scene.add(beacon);

function moveBeacon() {
  const target = missions.target();
  if (!target) { beacon.visible = false; return; }
  beacon.visible = true;
  beacon.position.set(target.x, 0, target.z);
}
moveBeacon();
if (saved && typeof saved.missionIndex === 'number') {
  // Resume: restore cash, progress and position exactly as saved.
  if (typeof saved.cash === 'number') missions.restore(saved.cash, saved.missionIndex);
  else while (missions.index < saved.missionIndex && missions.current) missions.completeCurrent();
  if (Number.isFinite(saved.playerX) && Number.isFinite(saved.playerZ)) {
    player.state.x = Math.max(-168, Math.min(128, saved.playerX));
    player.state.z = Math.max(-128, Math.min(128, saved.playerZ));
    player.update(0, { x: 0, z: 0 }, false, false, -Math.PI / 2, city.colliders);
  }
}

// Camera rig: yaw/pitch orbit, wheel zoom, smoothed follow. While driving
// the camera becomes a chase camera that follows the car's heading.
const cam = { yaw: -Math.PI / 2, pitch: 0.32, distance: 9.5 };
window.__sunset.cam = cam; // live camera yaw for the Playwright driver
let driveYawOffset = 0; // mouse orbit while driving, decays back to chase
let screen = 'title'; // title | play | paused
let elapsed = 0;
let health = 5;
let saveTimer = 0;
let hitCooldown = 0; // between crash consequences, so one hit counts once
let bustedActive = false;
let bustedTimer = 0;
let prevWanted = 0;

const startScreen = document.getElementById('start-screen');
const pauseScreen = document.getElementById('pause-screen');
const bustedScreen = document.getElementById('busted-screen');
const bustedText = document.getElementById('busted-text');
document.getElementById('loading').remove();

function showScreen(name) {
  screen = name;
  startScreen.style.display = name === 'title' ? 'flex' : 'none';
  pauseScreen.style.display = name === 'paused' ? 'flex' : 'none';
}

function startGame() {
  audio.unlock();
  audio.click();
  showScreen('play');
  hud.setMission(missions.current);
  hud.showToast('Selamat datang di Sunset Shores, Mara.', 4);
  // Snap the camera to its follow spot at once: starting at the world
  // origin and lerping across the city looked broken on slow machines.
  placeCamera(true);
}

startScreen.addEventListener('click', () => { if (screen === 'title') startGame(); });

// Restart from the pause screen: wipe the save and reload fresh.
document.getElementById('restart-btn').addEventListener('click', () => {
  clearSave();
  window.location.reload();
});

function nearestParkedCarAt(x, z, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of parkedCars) {
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestDist) { best = car; bestDist = d; }
  }
  return best;
}

function nearestParkedCar(maxDist) {
  const pos = player.position();
  return nearestParkedCarAt(pos.x, pos.z, maxDist);
}

// Mara climbs in: the player figure hides, the car becomes hers, and
// stealing it — parked or stopped traffic — puts a star on her.
function enterCar(vehicle) {
  driving.enter(vehicle);
  player.hide();
  audio.siren();
  police.raiseWanted(1);
  hud.showToast(`🚗 Kamu mencuri ${vehicle.name}! Polisi mengejarmu!`, 4);
}

// BUSTED: the police caught her, or the car is wrecked. Fine, respawn on
// foot at the beachfront, heat gone, missions untouched.
function startBusted(reason) {
  if (bustedActive) return;
  bustedActive = true;
  bustedTimer = 0;
  const fine = missions.deduct(100);
  bustedText.textContent = `${reason} Denda $${fine}.`;
  bustedScreen.style.display = 'flex';
  audio.busted();
  audio.setEngine(false, 0);
  if (driving.active) {
    driving.impound();
    player.show();
  }
  police.resetAfterBust();
}

function resolveBusted() {
  bustedScreen.style.display = 'none';
  bustedActive = false;
  health = 5;
  player.state.x = city.spawn.x;
  player.state.z = city.spawn.z;
  player.state.y = 0;
  player.state.vy = 0;
  player.state.heading = city.spawn.yaw;
  cam.yaw = -Math.PI / 2;
  cam.pitch = 0.32;
  cam.distance = 9.5;
  player.update(0, { x: 0, z: 0 }, false, false, cam.yaw, city.colliders);
  hud.showToast('Kamu bebas — tapi dompetmu lebih ringan.', 4);
}

function step(dt) {
  elapsed += dt;
  hitCooldown = Math.max(0, hitCooldown - dt);
  combat.update(dt);

  // The mission beacon bobs over its target.
  beaconGem.rotation.y += dt * 2;
  beaconGem.position.y = 3 + Math.sin(elapsed * 3) * 0.4;

  const orbit = input.takeOrbit();
  if (driving.active) {
    // While driving the mouse orbits the chase camera; it drifts back.
    driveYawOffset += orbit.yaw;
  } else {
    cam.yaw += orbit.yaw;
    cam.pitch = Math.max(0.08, Math.min(1.1, cam.pitch + orbit.pitch));
    cam.distance = Math.max(6, Math.min(15, cam.distance + orbit.wheel * 0.005));
  }

  const presses = input.takePresses();
  if (presses & PRESS_PAUSE) {
    if (screen === 'play') showScreen('paused');
    else if (screen === 'paused') showScreen('play');
  }
  if (presses & PRESS_START && screen === 'title') startGame();
  if (presses & PRESS_MUTE) {
    const muted = audio.toggleMute();
    hud.showToast(muted ? '🔇 Suara mati' : '🔊 Suara hidup', 2);
  }
  if (screen !== 'play') return;

  // Busted: freeze the world behind the overlay, then respawn.
  if (bustedActive) {
    bustedTimer += dt;
    if (bustedTimer > 2.8) resolveBusted();
    return;
  }

  if (presses & PRESS_HORN) audio.horn();

  // E: climb into a car, or climb out of the one being driven.
  if (presses & PRESS_ENTER_CAR) {
    if (driving.active) {
      const left = driving.exit();
      // Step out on the right side of the car; it stays parked there.
      player.state.x = left.x - Math.cos(left.heading) * 2.2;
      player.state.z = left.z + Math.sin(left.heading) * 2.2;
      player.state.heading = left.heading;
      player.show();
      player.update(0, { x: 0, z: 0 }, false, false, cam.yaw, city.colliders);
      parkedCars.push({
        mesh: left.mesh, x: left.x, z: left.z,
        heading: left.heading, color: 0xffffff, name: left.name,
      });
      audio.setEngine(false, 0);
      hud.showToast(`Kamu keluar dari ${left.name}.`, 2.5);
    } else {
      const car = nearestParkedCar(4.5);
      const pos = player.position();
      const stopped = car ? null : traffic.stoppedNear(pos.x, pos.z, 5);
      if (car) {
        parkedCars.splice(parkedCars.indexOf(car), 1);
        enterCar({
          mesh: car.mesh, x: car.x, z: car.z,
          heading: car.heading, name: car.name, stolen: true,
        });
      } else if (stopped) {
        traffic.remove(stopped);
        enterCar({
          mesh: stopped.mesh,
          x: stopped.mesh.position.x, z: stopped.mesh.position.z,
          heading: stopped.mesh.rotation.y, name: 'Mobil jalanan', stolen: true,
        });
      } else {
        hud.showToast('Tidak ada mobil di dekatmu. Cari mobil parkir di tepi jalan.', 2.5);
      }
    }
  }

  const axes = input.axes();
  if (driving.active) {
    const before = Math.abs(driving.car.speed);
    const result = driving.update(dt, axes);
    audio.setEngine(true, driving.speedKmh() / 97);
    if (result.hitWall && before > 8 && hitCooldown <= 0) {
      driving.damage(5);
      audio.crash();
      hud.showToast('Kamu menabrak gedung!', 2);
      hitCooldown = 0.6;
    }
    // What the car hits: pedestrians, traffic, and the consequences.
    const cp = driving.position();
    if (hitCooldown <= 0) {
      for (const w of pedestrians.walkers) {
        if (w.down > 0) continue;
        if (Math.hypot(w.x - cp.x, w.z - cp.z) < 2.2) {
          pedestrians.knockDown(w);
          police.addWanted(1);
          driving.damage(4);
          audio.crash();
          hud.showToast('Kamu menabrak pejalan kaki! +1 ★', 3);
          hitCooldown = 0.6;
          break;
        }
      }
    }
    if (hitCooldown <= 0) {
      for (const tcar of traffic.cars) {
        const d = Math.hypot(tcar.mesh.position.x - cp.x, tcar.mesh.position.z - cp.z);
        if (d < 3.4) {
          tcar.curSpeed *= 0.4;
          driving.damage(8);
          audio.crash();
          hud.showToast('Tabrakan dengan mobil lain!', 2.5);
          hitCooldown = 0.6;
          break;
        }
      }
    }
  } else {
    audio.setEngine(false, 0);
    player.update(dt, axes, input.running(), Boolean(presses & PRESS_JUMP), cam.yaw, city.colliders);

    // F: punch. A pedestrian goes down, a cop takes it personally.
    if (presses & PRESS_PUNCH) {
      const pos = player.position();
      const cars = parkedCars.map((c) => ({ x: c.x, z: c.z }));
      for (const tcar of traffic.cars) {
        cars.push({ x: tcar.mesh.position.x, z: tcar.mesh.position.z });
      }
      const result = combat.punch(
        pos.x, pos.z, player.state.heading,
        pedestrians.walkers, police.patrol, cars,
      );
      if (result.hit) {
        audio.punch();
        if (result.hitPed) {
          pedestrians.knockDown(result.hitPed);
          police.addWanted(1);
          hud.showToast('Kamu memukul pejalan kaki! +1 ★', 3);
        } else if (result.hitCop) {
          police.addWanted(1);
          hud.showToast('Kamu memukul polisi! +1 ★', 3);
        } else if (result.hitCar) {
          hud.showToast('BUG! Kamu meninju mobil. Tangamu sakit.', 2);
        }
      }
    }
  }

  const pos = driving.active ? driving.position() : player.position();
  traffic.update(dt, pos);
  pedestrians.update(dt);
  police.update(dt, pos, { driving: driving.active, speedKmh: driving.speedKmh() });

  // Reaching the mission marker completes the mission and pays out.
  // Misi 2 only counts while driving a stolen car to the workshop.
  if (missions.current && (!missions.current.needsCar || driving.active)
    && missions.checkArrival(pos.x, pos.z)) {
    audio.pickup();
    missions.completeCurrent();
    hud.setMission(missions.current);
    moveBeacon();
  }

  // Busted: cornered by the police, or the car is a wreck.
  if (police.busted) startBusted('Polisi menangkapmu.');
  else if (driving.active && driving.car.health <= 0) startBusted('Mobilmu hancur.');

  // The heat cooling off deserves a line: a star fading is good news.
  if (!bustedActive && police.wanted < prevWanted) {
    hud.showToast('Polisi kehilangan jejakmu — ★ berkurang.', 3);
  }
  prevWanted = police.wanted;

  // Autosave every 10 seconds of play.
  saveTimer += dt;
  if (saveTimer > 10) {
    saveTimer = 0;
    writeSave({
      cash: missions.cash, missionIndex: missions.index,
      playerX: pos.x, playerZ: pos.z,
    });
  }
}

// A patrol car ramming the player's car: damage and noise — but no extra
// star. Being rammed is a consequence of being wanted, not a new crime,
// and a star per ram used to mask the 30 s chase timer completely: four
// rams raised wanted 1 -> 5 in ~13 s of game time, before the timer
// could ever fire. Stars now rise from crimes and from long chases.
police.setRamHandler(() => {
  if (!driving.active) return;
  driving.damage(8);
  audio.crash();
  hud.showToast('Polisi menabrak mobilmu!', 2.5);
});

function placeCamera(snap) {
  if (driving.active) {
    // Chase camera: behind the car, yaw following the car's heading.
    const car = driving.car;
    const target = new THREE.Vector3(car.x, 1.7, car.z);
    const wantYaw = car.heading + Math.PI + driveYawOffset;
    let dy = wantYaw - cam.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    cam.yaw += dy * (snap ? 1 : 0.12);
    if (!snap) driveYawOffset *= 0.985;
    const pitch = 0.34;
    const distance = 11;
    const camX = target.x + Math.sin(cam.yaw) * Math.cos(pitch) * distance;
    const camZ = target.z + Math.cos(cam.yaw) * Math.cos(pitch) * distance;
    const camY = target.y + Math.sin(pitch) * distance;
    const wanted = new THREE.Vector3(camX, camY, camZ);
    if (snap) camera.position.copy(wanted);
    else camera.position.lerp(wanted, 0.25);
    camera.lookAt(target);
    return;
  }
  const pos = player.position();
  const target = new THREE.Vector3(pos.x, pos.y + 1.7, pos.z);
  const camX = target.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.distance;
  const camZ = target.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.distance;
  const camY = target.y + Math.sin(cam.pitch) * cam.distance;
  const wanted = new THREE.Vector3(camX, camY, camZ);
  if (snap) camera.position.copy(wanted);
  else camera.position.lerp(wanted, 0.25);
  camera.lookAt(target);
}

function render() {
  placeCamera(false);
  renderer.render(scene, camera);
  const pos = driving.active ? driving.position() : player.position();

  hud.update({
    cash: missions.cash,
    wanted: police.wanted,
    health,
    speedKmh: driving.active ? driving.speedKmh() : player.speedKmh(),
    driving: driving.active,
    carName: driving.active ? driving.car.name : '',
    carHealth: driving.health,
    elapsed,
    buildings: city.buildings,
    traffic: traffic.positions(),
    peds: pedestrians.positions(),
    police: police.patrol.map((car) => ({ x: car.x, z: car.z })),
    target: missions.target(),
    playerX: pos.x,
    playerZ: pos.z,
    playerHeading: driving.active ? driving.car.heading : player.state.heading,
  });
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play') showScreen('paused');
});

// --- staged screenshot ----------------------------------------------------
// The cover and the three M2 shots all stage a fixed scene, run the world
// forward a few simulated seconds, then render twice and flag __shotReady.
function stageDriveShot() {
  showScreen('play');
  hud.setMission(missions.current);
  // Mara takes a parked car on the central avenue and drives it north.
  const spot = nearestParkedCarAt(8.6, -50, 40);
  parkedCars.splice(parkedCars.indexOf(spot), 1);
  driving.enter({ mesh: spot.mesh, x: 3.2, z: -60, heading: 0, name: spot.name, stolen: true });
  player.hide();
  for (let i = 0; i < 150; i++) {
    driving.update(STEP, { x: 0, z: 1 });
    traffic.update(STEP);
    pedestrians.update(STEP);
  }
  driveYawOffset = 0;
  cam.yaw = driving.car.heading + Math.PI;
  placeCamera(true);
  render();
  render();
  window.__shotReady = true;
}

function stageChaseShot() {
  showScreen('play');
  hud.setMission(missions.current);
  // A stolen car fleeing down the avenue, two patrol cars on its tail.
  const spot = nearestParkedCarAt(8.6, -50, 40);
  parkedCars.splice(parkedCars.indexOf(spot), 1);
  driving.enter({ mesh: spot.mesh, x: 3.2, z: -60, heading: 0, name: spot.name, stolen: true });
  player.hide();
  police.raiseWanted(2);
  for (let i = 0; i < 150; i++) {
    driving.update(STEP, { x: 0, z: 1 });
    traffic.update(STEP);
    pedestrians.update(STEP);
    police.update(STEP, driving.position(), { driving: true, speedKmh: driving.speedKmh() });
  }
  // Pull the patrol cars into frame, flanking the getaway car: pursuers
  // directly behind it would sit behind the chase camera and never show.
  const car = driving.car;
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  const rx = -Math.cos(car.heading);
  const rz = Math.sin(car.heading);
  const slots = [[-2, 4.5], [-5, -4.5]];
  police.patrol.forEach((cop, i) => {
    const [back, side] = slots[i % slots.length];
    cop.x = car.x - fx * back + rx * side;
    cop.z = car.z - fz * back + rz * side;
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = car.heading;
  });
  driving.damage(38); // a banged-up getaway car, smoking a little
  driveYawOffset = 0;
  cam.yaw = car.heading + Math.PI;
  placeCamera(true);
  render();
  render();
  window.__shotReady = true;
}

function stageMissionShot() {
  showScreen('play');
  hud.setMission(missions.current);
  // Mara on the beach promenade, the mission beacon glowing at the pier.
  player.state.x = -118;
  player.state.z = 14;
  player.state.heading = Math.atan2(-132 - -118, 24 - 14);
  player.update(0, { x: 0, z: 0 }, false, false, cam.yaw, city.colliders);
  cam.yaw = player.state.heading + Math.PI;
  cam.pitch = 0.42;
  cam.distance = 10;
  for (let i = 0; i < 120; i++) {
    traffic.update(STEP);
    pedestrians.update(STEP);
    police.update(STEP, player.position());
  }
  placeCamera(true);
  render();
  render();
  window.__shotReady = true;
}

function stageCoverShot() {
  showScreen('play');
  hud.setMission(missions.current);
  // Player on the sidewalk of the central avenue, facing downtown into
  // the sunset, so the road traffic stays beside her, not in front of her.
  player.state.x = -42;
  player.state.z = -8;
  player.state.heading = Math.PI / 2;
  // High diagonal view from the south-west: avenue, sidewalks, towers,
  // traffic and the player all in one frame, no single car blocking it.
  cam.yaw = -2.13;
  cam.pitch = 0.55;
  cam.distance = 18;
  // A theft in progress: one wanted star and a patrol car closing in,
  // placed just ahead of the player so it reads in the frame.
  police.raiseWanted(1);
  if (police.patrol.length > 0) {
    const cop = police.patrol[0];
    cop.x = -8; cop.z = 8;
    cop.mesh.position.set(-8, 0, 8);
  }
  // Sync the player's mesh to the staged position (update() is what moves
  // the group; the shot path never runs the live loop).
  player.update(0, { x: 0, z: 0 }, false, false, cam.yaw, city.colliders);
  // Let traffic and pedestrians spread out for two simulated seconds.
  for (let i = 0; i < 120; i++) {
    traffic.update(STEP);
    pedestrians.update(STEP);
    police.update(STEP, player.position());
  }
  placeCamera(true);
  render();
  render();
  window.__shotReady = true;
}

if (shot === 'cover') {
  stageCoverShot();
} else if (shot === 'drive') {
  stageDriveShot();
} else if (shot === 'chase') {
  stageChaseShot();
} else if (shot === 'mission') {
  stageMissionShot();
} else {
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (accumulator >= STEP) {
      step(STEP);
      accumulator -= STEP;
    }
    render();
  }
  requestAnimationFrame(frame);
}
