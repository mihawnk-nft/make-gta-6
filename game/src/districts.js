// Districts & standing: seven named neighbourhoods of Sunset Shores.
// Standing starts at 30 (WARY); 50+ is NEUTRAL, 80+ is FRIENDLY.
// Side jobs raise the standing of the district they happen in.
import { DISTRICTS, STANDING_START } from './config.js';

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.minX && x < d.maxX && z >= d.minZ && z < d.maxZ) return d.name;
  }
  return 'Pusat Kota';
}

export function standingLabel(value) {
  if (value >= 80) return 'FRIENDLY';
  if (value >= 50) return 'NEUTRAL';
  return 'WARY';
}

export function freshStanding() {
  const out = {};
  for (const d of DISTRICTS) out[d.name] = STANDING_START;
  return out;
}

export function standingOf(G, name) {
  const table = G.state.districtStanding || {};
  if (typeof table[name] === 'number') return table[name];
  return STANDING_START;
}

export function addStanding(G, name, amount) {
  if (!G.state.districtStanding) G.state.districtStanding = freshStanding();
  const before = standingOf(G, name);
  const after = Math.max(0, Math.min(100, before + amount));
  G.state.districtStanding[name] = after;
  const labelBefore = standingLabel(before);
  const labelAfter = standingLabel(after);
  if (labelAfter !== labelBefore) {
    G.hud.toast(`${name} sekarang ${labelAfter} (${after})`);
  }
  return after;
}

// One-line HUD text: "Kota Tua — WARY (30)".
export function districtHudText(G) {
  const px = G.state.driving && G.car ? G.car.x : G.player.pos.x;
  const pz = G.state.driving && G.car ? G.car.z : G.player.pos.z;
  const name = districtAt(px, pz);
  const value = standingOf(G, name);
  return `${name} — ${standingLabel(value)} (${value})`;
}
