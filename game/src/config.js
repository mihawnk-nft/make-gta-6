// Every tuning number for Sunset Shores in one place. Round 3 expands the
// game: 10 chained missions in 3 acts, 8 weapons, ranks, 7 named districts,
// 3 radio stations, luxury cars and the crew.
export const SEED = 7;
export const SAVE_KEY = 'sunset-shores-save-v1';
export const SAVE_SLOTS = ['sunset-shores-save-v1', 'sunset-shores-save-v2', 'sunset-shores-save-v3'];

export const WORLD = {
  // Playable bounds. West of x=-116 is sand, west of x=-148 is the sea.
  minX: -168,
  maxX: 132,
  minZ: -132,
  maxZ: 132,
  beachX: -116,
  seaX: -148,
  // Road centre lines (6 avenues each way) and block centres (5 x 5 blocks).
  roads: [-110, -66, -22, 22, 66, 110],
  blocks: [-88, -44, 0, 44, 88],
  blockHalf: 16,
  roadHalf: 6,
};

export const SPAWN = { x: 0, z: 100, heading: Math.PI }; // facing north (-z)

export const PLAYER_TUNE = {
  walkSpeed: 6,
  runSpeed: 10.5,
  accel: 40,
  jumpSpeed: 8.5,
  gravity: 24,
  radius: 0.6,
  height: 1.8,
};

export const CAR_TUNE = {
  accel: 15,
  brake: 26,
  maxSpeed: 27,
  maxReverse: 9,
  steer: 1.9,
  drag: 0.55,
  radius: 1.7,
};

export const POLICE_TUNE = {
  maxSpeed: 24,
  accel: 13,
  ramDamage: 8,
  ramCooldown: 1.2,
  ramRange: 3.0,
  cornerRange: 3.6,
  cornerTime: 2.5,
  lostRange: 45,
  lostSpeedFactor: 0.55,
  chaseStarSeconds: 30,
  hiddenStarSeconds: 20,
  maxCars: 3,
};

// Mara Voss works off a debt to Lilis, who runs the night market at the
// marina. Ten jobs, three acts: the debt (1-3), the hot road (4-6), the
// run to freedom (7-10). rewardCash is the exact cash the player ends
// with after that mission ($400 / $700 / $1200 / $1800 / $2500 / $3400 /
// $4500 / $6000 / $7500 / $10000), matching the mission chain.
export const ACTS = [
  { act: 1, name: 'Utang Senja', from: 1, to: 3 },
  { act: 2, name: 'Jalan Panas', from: 4, to: 6 },
  { act: 3, name: 'Menuju Bebas', from: 7, to: 10 },
];

export const MISSIONS = [
  {
    id: 1, act: 1,
    title: 'Misi 1 — Lari ke Dermaga',
    text: 'Nadia butuh paket dari nelayan di dermaga barat. Lari ke ujung pier, ikuti beacon kuning.',
    target: { x: -158, z: 0 },
    needsCar: false,
    rewardCash: 400,
    rewardRp: 100,
    radius: 5,
  },
  {
    id: 2, act: 1,
    title: 'Misi 2 — Curi Mobil ke Bengkel',
    text: 'Curi sebuah mobil (E di dekat mobil), lalu bawa ke bengkel Dodo di timur.',
    target: { x: 104, z: 88 },
    needsCar: true,
    rewardCash: 700,
    rewardRp: 100,
    radius: 7,
  },
  {
    id: 3, act: 1,
    title: 'Misi 3 — Antar ke Barat Laut',
    text: 'Paket pertama Lilis harus sampai ke gudang barat laut sebelum senja habis.',
    target: { x: -104, z: -88 },
    needsCar: true,
    rewardCash: 1200,
    rewardRp: 100,
    radius: 7,
  },
  {
    id: 4, act: 2,
    title: 'Misi 4 — Balap Pantai',
    text: 'Pembeli di tenggara menantimu. Bawa mobilnya cepat — jalan pantai sedang panas.',
    target: { x: 88, z: -104 },
    needsCar: true,
    rewardCash: 1800,
    rewardRp: 100,
    radius: 7,
  },
  {
    id: 5, act: 2,
    title: 'Misi 5 — Tagihan Marina',
    text: 'Tagih utang kios marina di barat daya. Parkir rapi, jangan bikin ribut.',
    target: { x: -44, z: 44 },
    needsCar: true,
    rewardCash: 2500,
    rewardRp: 100,
    radius: 7,
  },
  {
    id: 6, act: 2,
    title: 'Misi 6 — Jemputan Tengah Malam',
    text: 'Jemput Sari di jalan selatan. Dia membawa koper yang tidak boleh dibuka.',
    target: { x: 22, z: -110 },
    needsCar: true,
    rewardCash: 3400,
    rewardRp: 100,
    radius: 7,
  },
  {
    id: 7, act: 3,
    title: 'Misi 7 — Kabur ke Bukit',
    text: 'Polisi mulai mengendus. Bawa paketnya ke rumah bukit di barat daya, cepat.',
    target: { x: -110, z: 110 },
    needsCar: true,
    rewardCash: 4500,
    rewardRp: 100,
    radius: 7,
  },
  {
    id: 8, act: 3,
    title: 'Misi 8 — Pertemuan Rahasia',
    text: 'Nadia menunggumu di gang timur. Ini pertemuan yang menentukan segalanya.',
    target: { x: 110, z: -22 },
    needsCar: true,
    rewardCash: 6000,
    rewardRp: 100,
    radius: 7,
  },
  {
    id: 9, act: 3,
    title: 'Misi 9 — Paket Terakhir',
    text: 'Satu paket terakhir ke pusat kota. Setelah ini, utang tinggal selangkah lagi lunas.',
    target: { x: 66, z: 66 },
    needsCar: true,
    rewardCash: 7500,
    rewardRp: 100,
    radius: 7,
  },
  {
    id: 10, act: 3,
    title: 'Misi 10 — Jalan Bebas',
    text: 'Antar kunci gudang ke titik akhir. Selesaikan ini, dan Sunset Shores jadi milikmu.',
    target: { x: -22, z: -66 },
    needsCar: true,
    rewardCash: 10000,
    rewardRp: 100,
    radius: 7,
  },
];

// Eight weapons on the wheel (keys 1-8, Q cycles, Tab opens the wheel).
// rank is the minimum rank that may equip the weapon.
export const WEAPONS = [
  { name: 'Tinju', rank: 1, damage: 100, range: 2.8, ammo: Infinity, fireMs: 350 },
  { name: 'Pistol', rank: 1, damage: 100, range: 26, ammo: 12, fireMs: 320 },
  { name: 'SMG', rank: 1, damage: 60, range: 22, ammo: 30, fireMs: 110 },
  { name: 'Shotgun', rank: 1, damage: 100, range: 14, ammo: 6, fireMs: 800 },
  { name: 'Rifle', rank: 2, damage: 100, range: 55, ammo: 20, fireMs: 260 },
  { name: 'Sniper', rank: 2, damage: 100, range: 90, ammo: 5, fireMs: 1100 },
  { name: 'RPG', rank: 3, damage: 100, range: 45, ammo: 3, fireMs: 1400, blast: 7 },
  { name: 'Molotov', rank: 3, damage: 100, range: 18, ammo: 3, fireMs: 900, blast: 5 },
];

// Rank ladder: RP thresholds and the street name each rank carries.
export const RANKS = [
  { minRp: 0, name: 'Pemula' },
  { minRp: 300, name: 'Jalanan' },
  { minRp: 800, name: 'Legenda Senja' },
];

// Seven named districts. Standing starts at 30 (WARY) everywhere;
// a side job pays +$150, +25 RP and +20 standing in its district.
export const DISTRICTS = [
  { name: 'Pantai Sunset', minX: -168, maxX: -116, minZ: -132, maxZ: 132 },
  { name: 'Dermaga', minX: -116, maxX: -44, minZ: -132, maxZ: -44 },
  { name: 'Kota Tua', minX: -116, maxX: -44, minZ: -44, maxZ: 44 },
  { name: 'Pelabuhan', minX: -116, maxX: -44, minZ: 44, maxZ: 132 },
  { name: 'Pusat Kota', minX: -44, maxX: 44, minZ: -132, maxZ: 132 },
  { name: 'Marina', minX: 44, maxX: 132, minZ: -132, maxZ: -44 },
  { name: 'Bukit Timur', minX: 44, maxX: 132, minZ: -44, maxZ: 132 },
];

export const STANDING_START = 30;
export const SIDEJOB_CASH = 150;
export const SIDEJOB_RP = 25;
export const SIDEJOB_STANDING = 20;

// Radio: R cycles the three stations, then off.
export const RADIO_STATIONS = ['Sunset FM', 'Turbo FM', 'Neon Nights'];

// Luxury cars: style, top speed, steering, value and the rank that may
// drive one. Sports and muscle are street-level; limo and supercar are
// Rank 2 toys.
export const CAR_STYLES = {
  sedan: { maxSpeed: 27, steer: 1.9, value: 12000, minRank: 1 },
  sports: { maxSpeed: 33, steer: 2.3, value: 45000, minRank: 1 },
  muscle: { maxSpeed: 31, steer: 2.0, value: 38000, minRank: 1 },
  limo: { maxSpeed: 26, steer: 1.5, value: 60000, minRank: 2 },
  supercar: { maxSpeed: 38, steer: 2.6, value: 85000, minRank: 2 },
};

export const LUXURY_NAMES = {
  sports: ['Falco GT', 'Comet S', 'Vortex RS'],
  muscle: ['Guntur V8', 'Banteng 440', 'Torak Klasik'],
  limo: ['Presiden Limo', 'Senja Panjang'],
  supercar: ['Apex Velocita', 'Nebula X', 'Kometa R'],
};

export const CAR_NAMES = [
  'Sunset Coupe',
  'Palma Sedan',
  'Coral Hatchback',
  'Breeze Pickup',
  'Marina GT',
  'Dune Van',
];

export const CAR_COLORS = [0xd94f3d, 0x3d7bd9, 0xe8b93c, 0x4fae5e, 0x8a5fd0, 0xd9d9d9, 0x2b2f36, 0xe07b39];

export const START_CASH = 250;
export const START_HEALTH = 100;
export const START_ARMOR = 0;
export const BUSTED_FINE = 100;
export const STEAL_WANTED = 1;
export const MAX_WANTED = 5;
