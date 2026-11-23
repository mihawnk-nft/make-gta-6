// MaraPhone (tombol P): the hub for Jobs, Crew, Map, Bank, Garage and
// Texts. Opening it never pauses the city — Mara just glances at her
// phone while Sunset Shores keeps moving.
import { DISTRICTS } from './config.js';
import { missionTitle, missionText, currentMission } from './missions.js';
import { standingOf, standingLabel } from './districts.js';
import { rankName, nextRankAt } from './rank.js';
import { sideJobLine } from './sidejob.js';
import { CHEAT_HELP } from './cheats.js';

export const PHONE_TABS = ['Jobs', 'Crew', 'Map', 'Bank', 'Garage', 'Texts'];

const TEXTS = [
  { from: 'Nadia — Kopi Senja', body: 'Mara, paket dari dermaga jangan sampai basah. Nelayan itu cerewet soal kardus.' },
  { from: 'Lilis — Pasar Malam', body: 'Utangmu tinggal sedikit lagi. Jangan bikin polisi marah di marinaku, ya.' },
  { from: 'Dex', body: 'Kalau bintangmu naik, panggil aku. Aku bisa bujuk mereka turun satu.' },
  { from: 'Maya', body: 'Mobil penyok? Bawa ke aku. Atau tekan X saja, aku kirim alat dari jauh. Bercanda. Setengah bercanda.' },
  { from: 'Rex', body: 'Butuh mobil kabur? Tekan C. Aku selalu parkir satu di dekatmu.' },
];

export function createPhone(G) {
  const phone = {
    open: false,
    tab: 'Jobs',
  };
  G.phone = phone;
  const el = document.getElementById('phone');
  const body = document.getElementById('phone-body');
  const tabs = document.querySelectorAll('#phone-tabs button');
  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      phone.tab = btn.dataset.tab;
      tabs.forEach((b) => b.classList.toggle('active', b === btn));
      renderPhone(G);
      G.audio.click();
    });
  });
  // Clicking the phone itself must not orbit the camera behind it.
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  return phone;
}

export function togglePhone(G) {
  const phone = G.phone;
  phone.open = !phone.open;
  const el = document.getElementById('phone');
  el.classList.toggle('hidden', !phone.open);
  if (phone.open) {
    renderPhone(G);
    G.audio.click();
  }
  return phone.open;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

export function renderPhone(G) {
  const body = document.getElementById('phone-body');
  const s = G.state;
  const m = currentMission(G);
  const act = document.getElementById('hud-act').textContent;
  if (G.phone.tab === 'Jobs') {
    body.innerHTML = `
      <h3>Jobs — ${esc(act)}</h3>
      <p><b>${esc(missionTitle(G))}</b></p>
      <p>${esc(missionText(G))}</p>
      <p>${esc(sideJobLine(G))}</p>
      <p class="dim">Misi ${s.missionIndex}/10 selesai. Selesaikan semuanya untuk membuka jalan bebas.</p>`;
  } else if (G.phone.tab === 'Crew') {
    body.innerHTML = '<h3>Crew</h3>' + G.crew.map((c) => `
      <p><b>${esc(c.name)}</b> — ${esc(c.ability)}<br>
      <span class="dim">Tombol ${c.key} · Rank ${c.minRank}+ · Loyalitas ${c.loyalty} ·
      ${c.cooldownLeft > 0 ? `siap ${Math.ceil(c.cooldownLeft)} dtk lagi` : 'siap dipakai'}</span></p>`).join('');
  } else if (G.phone.tab === 'Map') {
    body.innerHTML = '<h3>Map — Distrik Sunset Shores</h3>' + DISTRICTS.map((d) => {
      const v = standingOf(G, d.name);
      return `<p><b>${esc(d.name)}</b> — ${standingLabel(v)} (${v})</p>`;
    }).join('') + '<p class="dim">Ketuk minimap di pojok kanan bawah untuk menaruh waypoint.</p>';
  } else if (G.phone.tab === 'Bank') {
    const done = s.missionIndex;
    const pct = Math.round((done / 10) * 100);
    const next = nextRankAt(G.rank);
    body.innerHTML = `
      <h3>Bank</h3>
      <p>Uang tunai: <b>$${s.cash}</b></p>
      <p>Penyelesaian: <b>${done}/10 misi (${pct}%)</b></p>
      <p>Rank: <b>Rank ${G.rank} ${esc(rankName(G.rank))}</b> — ${G.rp} RP${next ? ` (Rank ${G.rank + 1} di ${next} RP)` : ' (rank tertinggi)'}</p>
      <p>Side job selesai: <b>${s.stats.sideJobsDone || 0}</b></p>`;
  } else if (G.phone.tab === 'Garage') {
    const owned = G.parkedCars.filter((c) => c.stolen);
    body.innerHTML = '<h3>Garage</h3>' + (owned.length
      ? owned.map((c, i) => `<p><b>${esc(c.name)}</b> — Kondisi ${Math.round(c.condition)}%
          <button data-garage="${i}" class="phone-btn">Antar ke sini</button></p>`).join('')
      : '<p class="dim">Garasi masih kosong. Curi mobil (E), lalu mobil itu tercatat di sini begitu kamu keluar darinya.</p>')
      + '<p class="dim">Delivery: mobil yang kamu antar akan terparkir 8 meter di depanmu.</p>';
    body.querySelectorAll('button[data-garage]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const car = owned[Number(btn.dataset.garage)];
        if (!car) return;
        const a = G.player.heading;
        car.x = Math.max(-160, Math.min(125, G.player.pos.x + Math.sin(a) * 8));
        car.z = Math.max(-125, Math.min(125, G.player.pos.z + Math.cos(a) * 8));
        car.mesh.group.position.set(car.x, 0, car.z);
        G.hud.toast(`${car.name} diantar ke sisimu!`);
        renderPhone(G);
      });
    });
  } else if (G.phone.tab === 'Texts') {
    body.innerHTML = '<h3>Texts</h3>' + TEXTS.map((t) => `
      <p><b>${esc(t.from)}</b><br>${esc(t.body)}</p>`).join('')
      + '<h3>Cheat</h3><p class="dim">Ketik kodenya di mana saja saat bermain:</p>'
      + CHEAT_HELP.map(([code, help]) => `<p><b>${code}</b> — ${esc(help)}</p>`).join('');
  }
}
