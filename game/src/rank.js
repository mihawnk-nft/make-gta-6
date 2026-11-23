// Rank & RP: respect points open weapons and luxury cars. Rank 1 Pemula
// (0 RP), Rank 2 Jalanan (300 RP), Rank 3 Legenda Senja (800 RP).
// Missions pay +100 RP each; side jobs pay +25 RP.
import { RANKS } from './config.js';

export function rankForRp(rp) {
  let rank = 1;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (rp >= RANKS[i].minRp) rank = i + 1;
  }
  return rank;
}

export function rankName(rank) {
  const r = RANKS[Math.max(0, Math.min(RANKS.length - 1, rank - 1))];
  return r ? r.name : 'Pemula';
}

// Recompute G.rank from G.rp (call after any RP change).
export function refreshRank(G) {
  G.rank = rankForRp(G.rp);
  return G.rank;
}

// Add RP; toasts and plays a chime when a rank is gained. Returns the
// new rank.
export function addRp(G, amount) {
  const before = G.rank;
  G.rp = Math.max(0, G.rp + amount);
  const after = refreshRank(G);
  if (after > before) {
    G.hud.toast(`NAIK RANK! Sekarang Rank ${after} ${rankName(after)} — senjata & mobil baru terbuka`);
    G.audio.chime();
  }
  return after;
}

// Test/debug helper: set RP outright (rank recomputed from it).
export function setRp(G, amount) {
  G.rp = Math.max(0, amount);
  refreshRank(G);
  return G.rank;
}

// The next rank's threshold, for the progress bar on the phone.
export function nextRankAt(rank) {
  if (rank >= RANKS.length) return null;
  return RANKS[rank].minRp;
}
