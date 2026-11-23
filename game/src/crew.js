// Crew: three allies with one ability each, a cooldown and loyalty.
// Dex (Z) talks a cop down — clears one wanted star.
// Maya (X) is the mechanic — repairs the car you are driving to 100%.
// Rex (C) is the wheelman — sends a getaway car to your side (Rank 2).
// Loyalty starts at 50 and grows by 2 every time an ability lands.
import { createRng, pick } from './rng.js';
import { CAR_NAMES, CAR_COLORS } from './config.js';
import { makeCar } from './vehicles.js';
import { clamp } from './rng.js';

export const CREW_DEFS = [
  { id: 'dex', name: 'Dex', key: 'Z', minRank: 1, cooldown: 30, ability: 'Bersihkan 1 bintang wanted' },
  { id: 'maya', name: 'Maya', key: 'X', minRank: 1, cooldown: 45, ability: 'Perbaiki mobil sampai 100%' },
  { id: 'rex', name: 'Rex', key: 'C', minRank: 2, cooldown: 60, ability: 'Kirim mobil kabur ke sisimu' },
];

export function createCrew(G) {
  G.crew = CREW_DEFS.map((d) => ({
    id: d.id,
    name: d.name,
    key: d.key,
    minRank: d.minRank,
    cooldown: d.cooldown,
    ability: d.ability,
    loyalty: 50,
    cooldownLeft: 0,
  }));
  return G.crew;
}

function member(G, id) {
  return (G.crew || []).find((m) => m.id === id) || null;
}

export function crewReady(G, id) {
  const m = member(G, id);
  return !!m && m.cooldownLeft <= 0 && G.rank >= m.minRank;
}

// Use an ability by id ('dex' | 'maya' | 'rex'). Returns true when the
// ability actually fired; false when locked or cooling down.
export function useCrew(G, id) {
  const m = member(G, id);
  if (!m) return false;
  if (G.rank < m.minRank) {
    G.hud.toast(`${m.name} baru bergabung di Rank ${m.minRank} — kamu masih Rank ${G.rank}`);
    return false;
  }
  if (m.cooldownLeft > 0) {
    G.hud.toast(`${m.name} masih istirahat (${Math.ceil(m.cooldownLeft)} dtk lagi)`);
    return false;
  }
  const s = G.state;
  if (id === 'dex') {
    if (s.wanted <= 0) {
      G.hud.toast('Dex: tidak ada polisi yang perlu dibujuk sekarang');
      return false;
    }
    s.wanted = Math.max(0, s.wanted - 1);
    s.chaseTimer = 0;
    s.hiddenTimer = 0;
    G.hud.toast(`Dex membujuk polisi — Wanted turun ke ${s.wanted} ★`);
  } else if (id === 'maya') {
    if (!s.driving || !G.car) {
      G.hud.toast('Maya: kamu harus di dalam mobil dulu');
      return false;
    }
    G.car.condition = 100;
    G.hud.toast('Maya memperbaiki mobilmu — Kondisi 100%');
  } else if (id === 'rex') {
    const rng = createRng((Date.now() % 100000) + 7);
    const angle = G.player.heading;
    const x = clamp(G.player.pos.x + Math.sin(angle) * 8, -160, 125);
    const z = clamp(G.player.pos.z + Math.cos(angle) * 8, -125, 125);
    const car = makeCar(G, {
      kind: 'parked',
      name: pick(rng, CAR_NAMES),
      color: pick(rng, CAR_COLORS),
      x,
      z,
      angle,
    });
    car.stolen = false;
    G.parkedCars.push(car);
    G.hud.toast(`Rex mengirim mobil kabur — ${car.name} menunggumu di dekat sini`);
  }
  m.cooldownLeft = m.cooldown;
  m.loyalty = Math.min(100, m.loyalty + 2);
  G.audio.chime();
  return true;
}

export function updateCrew(G, dt) {
  for (const m of G.crew || []) {
    if (m.cooldownLeft > 0) m.cooldownLeft = Math.max(0, m.cooldownLeft - dt);
  }
}
