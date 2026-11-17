// Missions and the story of Sunset Shores: Mara Voss arrives owing money,
// and the crew hands her jobs one at a time. Each mission has a title, an
// objective line for the HUD, a target point for the minimap, and a cash
// reward. M1 ships the first three missions with their targets wired;
// the objective checks (arrive / deliver / escape) land in the next pass.
export const MISSIONS = [
  {
    id: 'arrival',
    title: 'MISI 1 — KEDATANGAN',
    text: 'Temui Rico di dermaga barat. Ikuti penanda kuning di minimap.',
    target: { x: -132, z: 24 },
    reward: 150,
  },
  {
    id: 'borrowed-wheels',
    title: 'MISI 2 — MOBIL PINJAMAN',
    text: 'Curi sebuah mobil di pusat kota dan bawa ke bengkel Lou.',
    target: { x: 25, z: -25 },
    reward: 300,
  },
  {
    id: 'sunset-run',
    title: 'MISI 3 — LARIAN SENJA',
    text: 'Antar paket ke menara kaca sebelum matahari tenggelam. Polisi mengawasi.',
    target: { x: 75, z: 75 },
    reward: 500,
  },
];

export function createMissionLog(onToast) {
  let index = 0;
  let cash = 250;

  return {
    get current() { return MISSIONS[index] ?? null; },
    get cash() { return cash; },
    get index() { return index; },
    target() {
      const mission = MISSIONS[index];
      return mission ? mission.target : null;
    },
    completeCurrent() {
      const mission = MISSIONS[index];
      if (!mission) return;
      cash += mission.reward;
      onToast(`Misi selesai! +$${mission.reward}`);
      index += 1;
      const next = MISSIONS[index];
      if (next) onToast(`${next.title}: ${next.text}`);
      else onToast('Semua misi selesai — Sunset Shores milikmu sekarang.');
    },
    // True when the player stands on the current target.
    checkArrival(x, z) {
      const target = this.target();
      if (!target) return false;
      return Math.hypot(x - target.x, z - target.z) < 4;
    },
  };
}
