// Every tuning number for Sunset Shores in one place.
export const SEED = 7;
export const SAVE_KEY = 'sunset-shores-save-v1';

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

export const MISSIONS = [
  {
    id: 1,
    title: 'Misi 1 — Lari ke Dermaga',
    text: 'Lari ke dermaga di pantai barat. Ikuti beacon kuning.',
    target: { x: -158, z: 0 },
    needsCar: false,
    rewardCash: 400,
    radius: 5,
  },
  {
    id: 2,
    title: 'Misi 2 — Curi Mobil ke Bengkel',
    text: 'Curi sebuah mobil (E di dekat mobil), lalu bawa ke bengkel timur.',
    target: { x: 104, z: 88 },
    needsCar: true,
    rewardCash: 700,
    radius: 7,
  },
  {
    id: 3,
    title: 'Misi 3 — Antar Terakhir',
    text: 'Antar mobil ke titik pengiriman barat laut.',
    target: { x: -104, z: -88 },
    needsCar: true,
    rewardCash: 1200,
    radius: 7,
  },
];

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
export const BUSTED_FINE = 100;
export const STEAL_WANTED = 1;
export const MAX_WANTED = 5;
