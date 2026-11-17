// Save / load through localStorage. The save holds cash, mission index,
// health, wanted stars and the exact player position, so a reload restores
// the run instead of restarting it.
import { SAVE_KEY } from './config.js';
import { makeCar } from './vehicles.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(G) {
  try {
    const s = G.state;
    const p = G.player;
    const data = {
      v: 1,
      cash: s.cash,
      health: s.health,
      wanted: s.wanted,
      missionIndex: s.missionIndex,
      px: Math.round(p.pos.x * 100) / 100,
      pz: Math.round(p.pos.z * 100) / 100,
      heading: Math.round(p.heading * 1000) / 1000,
      driving: !!s.driving,
      carName: s.driving && G.car ? G.car.name : null,
      carCondition: s.driving && G.car ? Math.round(G.car.condition) : null,
      carX: s.driving && G.car ? Math.round(G.car.x * 100) / 100 : null,
      carZ: s.driving && G.car ? Math.round(G.car.z * 100) / 100 : null,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch { /* storage unavailable */ }
}

export function applySave(G, data) {
  const s = G.state;
  s.cash = data.cash;
  s.health = typeof data.health === 'number' ? data.health : 100;
  s.wanted = typeof data.wanted === 'number' ? data.wanted : 0;
  s.missionIndex = data.missionIndex;
  if (typeof data.px === 'number' && typeof data.pz === 'number') {
    G.player.pos.x = data.px;
    G.player.pos.z = data.pz;
    G.player.pos.y = 0;
    G.player.vy = 0;
  }
  if (typeof data.heading === 'number') G.player.heading = data.heading;
  // A save made while driving restores the player on foot next to where the
  // car was, and the car itself returns as a parked car at that spot.
  s.driving = false;
  G.car = null;
  if (data.driving && typeof data.carX === 'number' && typeof data.carZ === 'number') {
    const car = makeCar(G, {
      kind: 'parked',
      name: data.carName || 'Mobil',
      color: 0x8a8a8a,
      x: data.carX,
      z: data.carZ,
      angle: 0,
      condition: typeof data.carCondition === 'number' ? data.carCondition : 100,
    });
    car.stolen = true;
    G.parkedCars.push(car);
  }
}
