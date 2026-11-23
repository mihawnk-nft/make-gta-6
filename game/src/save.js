// Save / load through localStorage. Slot 1 is the autosave slot
// ('sunset-shores-save-v1'); slots 2 and 3 are manual saves from the
// pause menu. The save holds cash, mission index, health, armour, wanted
// stars, RP, district standing, side-job stats, the weapon in hand and
// the exact player position, so a reload restores the run instead of
// restarting it.
import { SAVE_KEY, SAVE_SLOTS } from './config.js';
import { makeCar } from './vehicles.js';

export function slotKey(slot) {
  return SAVE_SLOTS[Math.max(0, Math.min(SAVE_SLOTS.length - 1, (slot || 1) - 1))];
}

export function readSave(slot) {
  try {
    const raw = window.localStorage.getItem(slotKey(slot));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(G, slot) {
  try {
    const s = G.state;
    const p = G.player;
    const data = {
      v: 2,
      cash: s.cash,
      health: s.health,
      armor: s.armor || 0,
      wanted: s.wanted,
      missionIndex: s.missionIndex,
      rp: G.rp || 0,
      weapon: G.weapon || 0,
      districtStanding: s.districtStanding || null,
      stats: s.stats || { sideJobsDone: 0 },
      px: Math.round(p.pos.x * 100) / 100,
      pz: Math.round(p.pos.z * 100) / 100,
      heading: Math.round(p.heading * 1000) / 1000,
      driving: !!s.driving,
      carName: s.driving && G.car ? G.car.name : null,
      carStyle: s.driving && G.car ? G.car.style : null,
      carCondition: s.driving && G.car ? Math.round(G.car.condition) : null,
      carX: s.driving && G.car ? Math.round(G.car.x * 100) / 100 : null,
      carZ: s.driving && G.car ? Math.round(G.car.z * 100) / 100 : null,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(slotKey(slot), JSON.stringify(data));
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    for (const key of SAVE_SLOTS) window.localStorage.removeItem(key);
  } catch { /* storage unavailable */ }
}

export function applySave(G, data) {
  const s = G.state;
  s.cash = data.cash;
  s.health = typeof data.health === 'number' ? data.health : 100;
  s.armor = typeof data.armor === 'number' ? data.armor : 0;
  s.wanted = typeof data.wanted === 'number' ? data.wanted : 0;
  s.missionIndex = data.missionIndex;
  if (typeof data.rp === 'number') {
    G.rp = data.rp;
    // Rank is recomputed through the live function on G (set by main.js
    // to avoid an import cycle with rank.js).
    if (typeof G._refreshRank === 'function') G._refreshRank();
  }
  if (typeof data.weapon === 'number') G.weapon = data.weapon;
  if (data.districtStanding && typeof data.districtStanding === 'object') {
    s.districtStanding = data.districtStanding;
  }
  if (data.stats && typeof data.stats === 'object') {
    s.stats = { ...s.stats, ...data.stats };
  }
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
      style: data.carStyle || 'sedan',
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
