// HUD: cash, wanted stars, health bar, mission banner, clock, speed, a live
// 2D minimap, toasts, and the start / pause / busted screens.
import { WORLD, MISSIONS } from './config.js';
import { missionTitle, missionText, currentMission } from './missions.js';
import { carSpeedKmh } from './driving.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const els = {
    cash: $('hud-cash'),
    stars: $('hud-stars'),
    healthFill: $('hud-health-fill'),
    healthText: $('hud-health-text'),
    banner: $('hud-mission'),
    bannerText: $('hud-mission-text'),
    clock: $('hud-clock'),
    speed: $('hud-speed'),
    speedValue: $('hud-speed-value'),
    carName: $('hud-car-name'),
    carCond: $('hud-car-cond'),
    minimap: $('minimap'),
    toast: $('toast'),
    startScreen: $('start-screen'),
    pauseScreen: $('pause-screen'),
    bustedScreen: $('busted-screen'),
    bustedText: $('busted-text'),
    flash: $('punch-flash'),
    hint: $('hud-hint'),
  };
  const mapCtx = els.minimap.getContext('2d');
  let toastTimer = null;
  let lastBanner = '';

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3200);
  }

  function showBusted(reason) {
    els.bustedText.textContent = `${reason} Denda $100. Misi tetap berlanjut.`;
    els.bustedScreen.classList.remove('hidden');
  }

  function hideBusted() {
    els.bustedScreen.classList.add('hidden');
  }

  function fmtClock(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function drawMinimap() {
    const s = G.state;
    const ctx = mapCtx;
    const W = 170;
    const H = 170;
    ctx.clearRect(0, 0, W, H);
    const toMap = (x, z) => [
      ((x - WORLD.minX) / (WORLD.maxX - WORLD.minX)) * W,
      ((z - WORLD.minZ) / (WORLD.maxZ - WORLD.minZ)) * H,
    ];
    // Sand + sea on the west.
    ctx.fillStyle = '#274b5e';
    ctx.fillRect(0, 0, W, H);
    const [sandX] = toMap(WORLD.beachX, 0);
    ctx.fillStyle = '#c9a86a';
    ctx.fillRect(sandX, 0, W - sandX, H);
    ctx.fillStyle = '#5a7a5a';
    ctx.fillRect(sandX, 0, W - sandX, H);
    // Roads.
    ctx.fillStyle = '#3a3f4a';
    for (const r of WORLD.roads) {
      const [rx] = toMap(r, 0);
      const [, rz] = toMap(0, r);
      ctx.fillRect(rx - 3, 0, 6, H);
      ctx.fillRect(0, rz - 3, W, 6);
    }
    const dot = (x, z, color, r) => {
      const [mx, my] = toMap(x, z);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
    };
    // Mission target star.
    const m = currentMission(G);
    if (m) {
      const [mx, my] = toMap(m.target.x, m.target.z);
      ctx.fillStyle = '#ffd23c';
      ctx.beginPath();
      for (let i = 0; i < 5; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        const a2 = a + Math.PI / 5;
        ctx.lineTo(mx + Math.cos(a) * 7, my + Math.sin(a) * 7);
        ctx.lineTo(mx + Math.cos(a2) * 3, my + Math.sin(a2) * 3);
      }
      ctx.closePath();
      ctx.fill();
    }
    for (const car of G.parkedCars) dot(car.x, car.z, '#7fd07f', 2);
    for (const car of G.traffic) dot(car.x, car.z, '#6fb7ff', 2.5);
    for (const ped of G.peds) if (!ped.down) dot(ped.x, ped.z, '#cccccc', 1.6);
    for (const cop of G.police) dot(cop.x, cop.z, '#ff4444', 3.2);
    // Player arrow.
    const px = s.driving && G.car ? G.car.x : G.player.pos.x;
    const pz = s.driving && G.car ? G.car.z : G.player.pos.z;
    const [mx, my] = toMap(px, pz);
    const heading = s.driving && G.car ? G.car.angle : G.player.heading;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(Math.PI - heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function update() {
    const s = G.state;
    els.cash.textContent = `$${s.cash}`;
    els.stars.textContent = '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted);
    els.stars.style.color = s.wanted > 0 ? '#ff5544' : '#888888';
    els.healthFill.style.width = `${Math.max(0, s.health)}%`;
    els.healthText.textContent = `${Math.round(s.health)}`;
    els.clock.textContent = fmtClock(s.clockMin);
    const title = missionTitle(G);
    if (title !== lastBanner) {
      lastBanner = title;
      els.banner.textContent = title;
      els.bannerText.textContent = missionText(G);
    }
    if (s.driving && G.car) {
      els.speed.classList.remove('hidden');
      els.speedValue.textContent = carSpeedKmh(G.car);
      els.carName.textContent = G.car.name + (G.car.stolen ? ' (curian)' : '');
      els.carCond.textContent = `Kondisi ${Math.round(G.car.condition)}%`;
    } else {
      els.speed.classList.add('hidden');
    }
    els.hint.textContent = s.driving
      ? 'W/S gas & rem · A/D belok · E keluar · F pukul · H klakson · Esc jeda'
      : 'WASD jalan · Shift lari · Spasi lompat · E masuk mobil · F pukul · Esc jeda';
    els.flash.style.opacity = G.combatFlash > 0 ? '0.35' : '0';
    if (G.combatFlash > 0) G.combatFlash = Math.max(0, G.combatFlash - 0.08);
    drawMinimap();
  }

  return { els, toast, showBusted, hideBusted, update };
}
