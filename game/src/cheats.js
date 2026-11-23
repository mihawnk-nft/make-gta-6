// GTA-style cheat codes: typed live on the keyboard (the buffer watches
// every letter key) or fired directly with window.__game.cheat(code).
// Five codes, all in Indonesian street slang so they fit Sunset Shores.
import { createRng, pick, clamp } from './rng.js';
import { LUXURY_NAMES, CAR_COLORS } from './config.js';
import { makeCar } from './vehicles.js';

export const CHEAT_CODES = ['DUITBANYAK', 'SEHATSELALU', 'BEBASPOLISI', 'SENJATALENGKAP', 'MOBILMEWAH'];

export const CHEAT_HELP = [
  ['DUITBANYAK', '+$5000 tunai'],
  ['SEHATSELALU', 'Nyawa + armor penuh (100)'],
  ['BEBASPOLISI', 'Wanted langsung 0'],
  ['SENJATALENGKAP', 'Semua senjata terbuka + RPG di tangan'],
  ['MOBILMEWAH', 'Supercar muncul di dekatmu'],
];

// Feed one typed letter into the rolling buffer; returns the code that
// just completed, or null. The buffer keeps the last 24 letters.
export function feedCheatLetter(G, letter) {
  const ch = String(letter || '').toUpperCase();
  if (!/^[A-Z]$/.test(ch)) return null;
  G._cheatBuffer = (G._cheatBuffer || '') + ch;
  if (G._cheatBuffer.length > 24) G._cheatBuffer = G._cheatBuffer.slice(-24);
  for (const code of CHEAT_CODES) {
    if (G._cheatBuffer.endsWith(code)) {
      G._cheatBuffer = '';
      return code;
    }
  }
  return null;
}

// Run a cheat by code. Returns true when the code is real.
export function applyCheat(G, code) {
  const c = String(code || '').toUpperCase();
  if (!CHEAT_CODES.includes(c)) return false;
  const s = G.state;
  if (c === 'DUITBANYAK') {
    s.cash += 5000;
    G.hud.toast('Cheat aktif: +$5000! Uang mengalir seperti ombak');
  } else if (c === 'SEHATSELALU') {
    s.health = 100;
    s.armor = 100;
    G.hud.toast('Cheat aktif: nyawa & armor penuh!');
  } else if (c === 'BEBASPOLISI') {
    s.wanted = 0;
    s.chaseTimer = 0;
    s.hiddenTimer = 0;
    s.bustedTimer = 0;
    G.hud.toast('Cheat aktif: polisi melupakanmu — Wanted 0');
  } else if (c === 'SENJATALENGKAP') {
    G.cheatUnlocked = true;
    G.weapon = 6; // RPG in hand
    G.ammo = G.ammo || {};
    for (let i = 0; i < 8; i += 1) G.ammo[i] = 999;
    G.hud.toast('Cheat aktif: semua senjata terbuka — RPG di tangan!');
  } else if (c === 'MOBILMEWAH') {
    const rng = createRng((Date.now() % 100000) + 13);
    const angle = G.player.heading;
    const x = clamp(G.player.pos.x + Math.sin(angle) * 7, -160, 125);
    const z = clamp(G.player.pos.z + Math.cos(angle) * 7, -125, 125);
    const car = makeCar(G, {
      kind: 'parked',
      style: 'supercar',
      name: pick(rng, LUXURY_NAMES.supercar),
      color: pick(rng, CAR_COLORS),
      x,
      z,
      angle,
    });
    G.parkedCars.push(car);
    G.hud.toast(`Cheat aktif: ${car.name} terparkir di dekatmu!`);
  }
  G.audio.chime();
  return true;
}
