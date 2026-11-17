// Bootstrap + main loop: builds the world, wires every system, steps the
// simulation in fixed 1/60 s slices, and renders. The game runs fully
// offline from static files; state is exposed on window.__game for tests.
import * as THREE from 'three';
import { START_CASH, START_HEALTH, SPAWN } from './config.js';
import { createInput, PRESS_ENTER_CAR, PRESS_PUNCH, PRESS_HORN, PRESS_PAUSE, PRESS_CONFIRM } from './input.js';
import { createAudio } from './audio.js';
import { readSave, writeSave, clearSave, applySave } from './save.js';
import { buildCity, updateCity } from './city.js';
import { spawnParkedCars } from './vehicles.js';
import { createPlayer, updatePlayer, updateCamera, nearestParkedOrStopped } from './player.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { enterCar, exitCar, updateDriving } from './driving.js';
import { updatePolice } from './police.js';
import { createMissions, updateMissions } from './missions.js';
import { punch, horn } from './combat.js';
import { createHud } from './hud.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(0, 12, 112);

const G = {
  scene,
  camera,
  renderer,
  state: {
    screen: 'title', // title | play | paused | busted
    cash: START_CASH,
    health: START_HEALTH,
    wanted: 0,
    missionIndex: 0,
    time: 0,
    clockMin: 17 * 60 + 25,
    chaseTimer: 0,
    hiddenTimer: 0,
    bustedTimer: 0,
    driving: false,
    bustedReason: '',
  },
  player: null,
  car: null,
  parkedCars: [],
  traffic: [],
  peds: [],
  police: [],
  colliders: [],
  missions: null,
  combatFlash: 0,
  presses: 0,
  _needsCarToast: 0,
};

G.input = createInput(canvas);
G.audio = createAudio();
G.hud = createHud(G);

buildCity(G);
G.player = createPlayer(G);
G.parkedCars = spawnParkedCars(G);
G.traffic = spawnTraffic(G);
G.peds = spawnPedestrians(G);
G.missions = createMissions(G);

// Restore a previous run, if one exists.
const saved = readSave();
if (saved) applySave(G, saved);

// ---- screens ----
function startGame() {
  G.state.screen = 'play';
  G.hud.els.startScreen.classList.add('hidden');
  G.hud.els.pauseScreen.classList.add('hidden');
  G.hud.hideBusted();
  G.audio.unlock();
  G.audio.click();
  updateCamera(G, 0.016);
}

function pauseGame() {
  if (G.state.screen !== 'play') return;
  G.state.screen = 'paused';
  G.hud.els.pauseScreen.classList.remove('hidden');
  G.audio.engine(false, 0);
  writeSave(G);
}

function resumeGame() {
  if (G.state.screen !== 'paused') return;
  G.state.screen = 'play';
  G.hud.els.pauseScreen.classList.add('hidden');
  G.audio.unlock();
}

function restartGame() {
  clearSave();
  window.location.reload();
}

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('resume-btn').addEventListener('click', resumeGame);
document.getElementById('restart-btn').addEventListener('click', restartGame);
document.getElementById('busted-btn').addEventListener('click', () => {
  G.hud.hideBusted();
  G.state.screen = 'play';
  G.audio.unlock();
  updateCamera(G, 0.016);
});
document.getElementById('busted-restart-btn').addEventListener('click', restartGame);
window.addEventListener('keydown', () => G.audio.unlock(), { once: false });
window.addEventListener('pointerdown', () => G.audio.unlock(), { once: false });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.state.screen === 'play') pauseGame();
});

// ---- one fixed step ----
let saveTimer = 0;
function step(dt) {
  const s = G.state;
  s.time += dt;
  s.clockMin += dt / 6; // 1 game minute every 6 real seconds
  if (s.screen !== 'play') return;

  updatePlayer(G, dt);
  if (s.driving) updateDriving(G, dt);
  if (s.screen !== 'play') return; // driving may have triggered BUSTED
  updateTraffic(G, dt);
  updatePedestrians(G, dt);
  updatePolice(G, dt);
  if (s.screen !== 'play') return; // police may have triggered BUSTED
  updateMissions(G, dt);
  updateCity(G, dt);

  saveTimer += dt;
  if (saveTimer >= 2) {
    saveTimer = 0;
    writeSave(G);
  }
}

function handlePresses() {
  const presses = G.input.takePresses();
  G.presses = presses;
  const s = G.state;
  if (presses & PRESS_PAUSE) {
    if (s.screen === 'play') pauseGame();
    else if (s.screen === 'paused') resumeGame();
    return;
  }
  if (s.screen === 'title' && (presses & PRESS_CONFIRM)) {
    startGame();
    return;
  }
  if (s.screen === 'busted' && (presses & PRESS_CONFIRM)) {
    G.hud.hideBusted();
    s.screen = 'play';
    return;
  }
  if (s.screen !== 'play') return;
  if (presses & PRESS_ENTER_CAR) {
    if (s.driving) exitCar(G);
    else {
      const car = nearestParkedOrStopped(G, 4.5);
      if (car) {
        // A stolen traffic car leaves the traffic list.
        const ti = G.traffic.indexOf(car);
        if (ti !== -1) G.traffic.splice(ti, 1);
        else {
          const pi = G.parkedCars.indexOf(car);
          if (pi !== -1) G.parkedCars.splice(pi, 1);
        }
        enterCar(G, car);
      } else {
        G.hud.toast('Tidak ada mobil di dekatmu');
      }
    }
  }
  if (presses & PRESS_PUNCH) punch(G);
  if (presses & PRESS_HORN) horn(G);
}

// ---- frame loop ----
let last = performance.now();
let accumulator = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  handlePresses();
  if (G.state.screen === 'play' || G.state.screen === 'title') {
    accumulator += frameDt;
    let guard = 0;
    while (accumulator >= STEP && guard < 8) {
      step(STEP);
      accumulator -= STEP;
      guard += 1;
      if (G.state.screen !== 'play' && G.state.screen !== 'title') break;
    }
    if (guard >= 8) accumulator = 0;
  } else {
    accumulator = 0;
  }
  if (G.state.screen === 'title') updateCity(G, frameDt);
  updateCamera(G, frameDt);
  G.hud.update();
  renderer.render(scene, camera);
}

// ---- debug / test handle ----
window.__game = {
  G,
  state: G.state,
  get player() { return G.player; },
  get car() { return G.car; },
  get parkedCars() { return G.parkedCars; },
  get traffic() { return G.traffic; },
  get peds() { return G.peds; },
  get police() { return G.police; },
  get audio() { return G.audio; },
  get colliders() { return G.colliders; },
  start: startGame,
  pause: pauseGame,
  resume: resumeGame,
  restart: restartGame,
  teleport(x, z) {
    G.player.pos.x = x;
    G.player.pos.z = z;
    G.player.pos.y = 0;
    G.player.vy = 0;
    G.player.mesh.position.set(x, 0, z);
    G.player.cameraSnapped = false;
  },
  setWanted(n) { G.state.wanted = n; G.state.chaseTimer = 0; G.state.hiddenTimer = 0; },
  setCash(n) { G.state.cash = n; },
  setMission(i) { G.state.missionIndex = i; },
  save() { return writeSave(G); },
  load() { const d = readSave(); if (d) applySave(G, d); return d; },
  clearSave,
};

requestAnimationFrame(frame);
window.__gameReady = true;
