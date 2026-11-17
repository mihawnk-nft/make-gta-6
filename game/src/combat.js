// Melee combat: F throws a punch. Hitting a pedestrian knocks them flat
// and raises the wanted level; hitting a police car raises it too. H is
// the horn when driving.
import { dist2 } from './rng.js';
import { nearestPed } from './pedestrians.js';

export function punch(G) {
  const s = G.state;
  const p = G.player;
  if (s.screen !== 'play') return;
  G.audio.thud();
  G.combatFlash = 1; // yellow flash, drawn by the HUD for a few frames
  const reach = s.driving ? 4.2 : 2.8;
  const cx = s.driving && G.car ? G.car.x : p.pos.x;
  const cz = s.driving && G.car ? G.car.z : p.pos.z;

  const ped = nearestPed(G, reach);
  if (ped) {
    ped.down = true;
    ped.downTimer = 4;
    s.wanted = Math.min(5, s.wanted + 1);
    s.chaseTimer = 0;
    s.hiddenTimer = 0;
    G.hud.toast('Kamu memukul pejalan kaki! Wanted +1 ★');
    return;
  }
  // Punching a police car (on foot, up close) also raises the heat.
  for (const cop of G.police) {
    if (dist2(cx, cz, cop.x, cop.z) < reach + 0.8) {
      s.wanted = Math.min(5, s.wanted + 1);
      s.chaseTimer = 0;
      G.hud.toast('Kamu memukul mobil polisi! Wanted +1 ★');
      return;
    }
  }
  // Punching a civilian car just dents it.
  for (const car of [...G.parkedCars, ...G.traffic]) {
    if (dist2(cx, cz, car.x, car.z) < reach + 0.6) {
      car.condition = Math.max(0, car.condition - 5);
      G.hud.toast('Mobil penyok!');
      return;
    }
  }
  G.hud.toast('Pukulan meleset…');
}

export function horn(G) {
  if (G.state.screen !== 'play') return;
  G.audio.horn();
  if (G.state.driving) G.hud.toast('Klakson!');
}
