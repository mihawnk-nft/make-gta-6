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
import { createMissionLog } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import {
  createInput,
  PRESS_ENTER_CAR, PRESS_JUMP, PRESS_HORN, PRESS_PAUSE, PRESS_MUTE, PRESS_START,
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
const hud = createHud();
const audio = createAudio();
const input = createInput(canvas);

const saved = loadSave();
const missions = createMissionLog((message) => hud.showToast(message));
if (saved && typeof saved.missionIndex === 'number') {
  // Resume: restore cash and progress from the last visit.
  while (missions.index < saved.missionIndex && missions.current) missions.completeCurrent();
}

// Camera rig: yaw/pitch orbit, wheel zoom, smoothed follow.
const cam = { yaw: -Math.PI / 2, pitch: 0.32, distance: 9.5 };
let screen = 'title'; // title | play | paused
let elapsed = 0;
let health = 5;
let saveTimer = 0;

const startScreen = document.getElementById('start-screen');
const pauseScreen = document.getElementById('pause-screen');
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
}

startScreen.addEventListener('click', () => { if (screen === 'title') startGame(); });

function nearestParkedCar(maxDist) {
  const pos = player.position();
  let best = null;
  let bestDist = maxDist;
  for (const car of parkedCars) {
    const d = Math.hypot(car.x - pos.x, car.z - pos.z);
    if (d < bestDist) { best = car; bestDist = d; }
  }
  return best;
}

function step(dt) {
  elapsed += dt;
  const orbit = input.takeOrbit();
  cam.yaw += orbit.yaw;
  cam.pitch = Math.max(0.08, Math.min(1.1, cam.pitch + orbit.pitch));
  cam.distance = Math.max(6, Math.min(15, cam.distance + orbit.wheel * 0.005));

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

  if (presses & PRESS_HORN) audio.horn();

  // Steal a car (M1): the car stays parked, but the theft is real — the
  // wanted level rises and a patrol car comes after the player. Driving
  // the stolen car lands in the next milestone.
  if (presses & PRESS_ENTER_CAR) {
    const car = nearestParkedCar(4.5);
    if (car) {
      audio.siren();
      police.raiseWanted(1);
      hud.showToast(`🚗 Kamu mencuri ${car.name}! Polisi mengejarmu!`, 4);
    } else {
      hud.showToast('Tidak ada mobil di dekatmu. Cari mobil parkir di tepi jalan.', 2.5);
    }
  }

  const axes = input.axes();
  player.update(dt, axes, input.running(), Boolean(presses & PRESS_JUMP), cam.yaw, city.colliders);
  traffic.update(dt);
  pedestrians.update(dt);
  const pos = player.position();
  police.update(dt, pos);

  // Reaching the mission marker completes the mission and pays out.
  if (missions.current && missions.checkArrival(pos.x, pos.z)) {
    audio.pickup();
    missions.completeCurrent();
    hud.setMission(missions.current);
  }

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

function placeCamera(snap) {
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
  const pos = player.position();

  hud.update({
    cash: missions.cash,
    wanted: police.wanted,
    health,
    speedKmh: player.speedKmh(),
    driving: false,
    carName: '',
    elapsed,
    buildings: city.buildings,
    traffic: traffic.positions(),
    peds: pedestrians.positions(),
    police: police.patrol.map((car) => ({ x: car.x, z: car.z })),
    target: missions.target(),
    playerX: pos.x,
    playerZ: pos.z,
    playerHeading: player.state.heading,
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
