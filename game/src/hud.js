// HUD and minimap: cash, wanted stars, health, mission banner, speed,
// toasts, and a live top-down map of the city with the player, traffic,
// pedestrians, the mission target and the police on it.
import { CITY_HALF } from './city.js';

const MAP_RANGE = 280; // world units shown across the minimap (whole city + beach)

export function createHud() {
  const cashEl = document.getElementById('hud-cash');
  const wantedEl = document.getElementById('hud-wanted');
  const healthEl = document.getElementById('hud-health');
  const titleEl = document.getElementById('mission-title');
  const textEl = document.getElementById('mission-text');
  const speedEl = document.getElementById('hud-speed-num');
  const modeEl = document.getElementById('hud-mode');
  const toastEl = document.getElementById('hud-toast');
  const clockEl = document.getElementById('hud-clock');
  const map = document.getElementById('minimap');
  const ctx = map.getContext('2d');
  let toastTimer = 0;

  function toMap(x, z) {
    const s = map.width / MAP_RANGE;
    return { x: map.width / 2 + x * s, y: map.height / 2 + z * s };
  }

  return {
    showToast(message, seconds = 3) {
      toastEl.textContent = message;
      toastEl.style.opacity = '1';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, seconds * 1000);
    },
    setMission(mission) {
      if (!mission) {
        titleEl.textContent = 'BEBAS — JELAJAHI KOTA';
        textEl.textContent = 'Tidak ada misi aktif. Curi mobil, kabur dari polisi, bersenang-senanglah.';
        return;
      }
      titleEl.textContent = mission.title;
      textEl.textContent = mission.text;
    },
    update(state) {
      cashEl.textContent = String(state.cash);
      wantedEl.textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
      healthEl.textContent = '❤'.repeat(Math.max(0, state.health)) + '🤍'.repeat(Math.max(0, 5 - state.health));
      speedEl.textContent = String(state.speedKmh);
      modeEl.textContent = state.driving ? '🚗 ' + state.carName : '🚶 Jalan kaki';
      const hours = 17 + Math.floor(state.elapsed / 240);
      const minutes = Math.floor((state.elapsed % 240) / 4);
      clockEl.textContent = `☀ ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}  ·  Sunset Shores`;

      // --- minimap ---------------------------------------------------------
      ctx.clearRect(0, 0, map.width, map.height);
      ctx.fillStyle = '#16283a';
      ctx.fillRect(0, 0, map.width, map.height);
      // Ocean on the west edge.
      ctx.fillStyle = '#2e86c1';
      const ocean = toMap(-175, 0);
      ctx.fillRect(0, 0, ocean.x + 40, map.height);
      // Sand strip.
      ctx.fillStyle = '#e8cf96';
      ctx.fillRect(ocean.x + 40, 0, 8, map.height);
      // Roads.
      ctx.strokeStyle = '#5a6068';
      ctx.lineWidth = 5;
      for (const c of [-100, -50, 0, 50, 100]) {
        const a = toMap(c, -CITY_HALF);
        const b = toMap(c, CITY_HALF);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        const d = toMap(-CITY_HALF, c);
        const e = toMap(CITY_HALF, c);
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      }
      // Buildings.
      ctx.fillStyle = '#8a94a6';
      for (const building of state.buildings) {
        const p = toMap(building.x - building.w / 2, building.z - building.d / 2);
        const s = map.width / MAP_RANGE;
        ctx.fillRect(p.x, p.y, building.w * s, building.d * s);
      }
      // Mission target: pulsing yellow diamond.
      if (state.target) {
        const p = toMap(state.target.x, state.target.z);
        const pulse = 5 + Math.sin(state.elapsed * 4) * 2;
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - pulse);
        ctx.lineTo(p.x + pulse, p.y);
        ctx.lineTo(p.x, p.y + pulse);
        ctx.lineTo(p.x - pulse, p.y);
        ctx.closePath();
        ctx.fill();
      }
      // Traffic (white) and pedestrians (green).
      ctx.fillStyle = '#ffffff';
      for (const car of state.traffic) {
        const p = toMap(car.x, car.z);
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }
      ctx.fillStyle = '#7dff9a';
      for (const ped of state.peds) {
        const p = toMap(ped.x, ped.z);
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      }
      // Police (flashing blue/red) and the player (white arrow).
      for (const cop of state.police) {
        const p = toMap(cop.x, cop.z);
        ctx.fillStyle = Math.floor(state.elapsed * 4) % 2 === 0 ? '#3388ff' : '#ff3333';
        ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
      }
      const pp = toMap(state.playerX, state.playerZ);
      ctx.fillStyle = '#ffffff';
      ctx.save();
      ctx.translate(pp.x, pp.y);
      ctx.rotate(state.playerHeading + Math.PI); // map north is -z, heading 0 faces +z
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
  };
}
