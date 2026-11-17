// Sunset Shores itself: a procedural sun-soaked coastal city. A 5x5 grid of
// avenues and streets, blocks of varied buildings (taller downtown, low and
// pastel near the beach), sidewalks, palm trees, lamps, a sandy beachfront and
// the ocean to the west. One fixed seed builds the same city every load.
import * as THREE from 'three';

export const CITY_HALF = 125;          // city edge on the land side
export const ROAD_SPACING = 50;        // distance between road centre lines
export const ROAD_WIDTH = 12;
export const BEACH_X = -125;           // sand starts here, ocean further west
export const OCEAN_X = -175;

// Warm sunset palette for the building faces.
const BUILDING_COLORS = [
  0xffd9a0, 0xffb38a, 0xf7ead1, 0xe8a87c, 0xd9c7a7,
  0xcfe3e8, 0xf2c14e, 0xe2725b, 0x9db8c4, 0xf6f1e7,
];
const ROOF_COLORS = [0x8a5a44, 0x5a6b7a, 0x7a7a6e, 0xa8574a];

// One canvas texture of lit windows, shared by every building side.
function makeWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 64, 128);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 4; col++) {
      const lit = (row * 4 + col) % 3 !== 0;
      ctx.fillStyle = lit ? '#ffe9a8' : '#2c3e55';
      ctx.fillRect(6 + col * 14, 8 + row * 15, 9, 10);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeRoadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#45454c';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#f5d76e';
  ctx.fillRect(30, 6, 4, 20);
  ctx.fillRect(30, 38, 4, 20);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const buildings = [];
  const windowTexture = makeWindowTexture();
  const roadTexture = makeRoadTexture();
  const group = new THREE.Group();
  group.name = 'SunsetShoresCity';
  scene.add(group);

  // --- sky, sun and light -------------------------------------------------
  scene.background = new THREE.Color(0xffc98f);
  scene.fog = new THREE.Fog(0xffc890, 220, 520);
  const hemi = new THREE.HemisphereLight(0xffe3b3, 0x8a6f52, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a8, 2.1);
  sun.position.set(90, 130, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -180; sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180; sun.shadow.camera.bottom = -180;
  sun.shadow.camera.far = 420;
  scene.add(sun);
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(16, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
  );
  sunDisc.position.set(300, 150, -260);
  sunDisc.lookAt(0, 20, 0);
  scene.add(sunDisc);

  // --- ground, beach and ocean --------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshStandardMaterial({ color: 0x9c8f7a, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 560),
    new THREE.MeshStandardMaterial({ color: 0xf2d8a0, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(BEACH_X - 26, 0.03, 0);
  sand.receiveShadow = true;
  group.add(sand);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 560),
    new THREE.MeshStandardMaterial({ color: 0x2e86c1, roughness: 0.35, metalness: 0.1 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(OCEAN_X - 110, 0.02, 0);
  group.add(ocean);

  // --- roads ---------------------------------------------------------------
  const roadLines = [-100, -50, 0, 50, 100];
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture, roughness: 1 });
  for (const c of roadLines) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(260, ROAD_WIDTH), roadMat);
      road.material = roadMat.clone();
      road.material.map = roadTexture.clone();
      road.material.map.repeat.set(260 / 16, 1);
      road.material.map.needsUpdate = true;
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = horizontal ? Math.PI / 2 : 0;
      road.position.set(horizontal ? 0 : c, 0.05, horizontal ? c : 0);
      road.receiveShadow = true;
      group.add(road);
    }
  }

  // --- sidewalks: pale strips framing every block -------------------------
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xcfc4ae, roughness: 1 });
  const blockCenters = [-75, -25, 25, 75];
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(38, 38), sidewalkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(bx, 0.04, bz);
      walk.receiveShadow = true;
      group.add(walk);
    }
  }

  // --- buildings: 1-4 per block, taller toward the centre -----------------
  const sideMat = new THREE.MeshStandardMaterial({ map: windowTexture, roughness: 0.9 });
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      const downtown = Math.max(0, 1 - (Math.abs(bx) + Math.abs(bz)) / 150);
      const count = rng.int(1, 3);
      const slots = [
        [-9, -9, 16, 16], [9, -9, 16, 16], [-9, 9, 16, 16], [9, 9, 16, 16],
      ];
      for (let i = 0; i < count; i++) {
        const [ox, oz, w, d] = slots[i];
        const height = Math.round(rng.range(7, 14) + downtown * rng.range(10, 42));
        const color = rng.pick(BUILDING_COLORS);
        const side = sideMat.clone();
        side.color.setHex(color);
        side.map = windowTexture.clone();
        side.map.repeat.set(Math.max(1, Math.round(w / 10)), Math.max(1, Math.round(height / 12)));
        side.map.needsUpdate = true;
        const roof = new THREE.MeshStandardMaterial({
          color: rng.pick(ROOF_COLORS), roughness: 1,
        });
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w, height, d),
          [side, side, roof, roof, side, side],
        );
        mesh.position.set(bx + ox, height / 2, bz + oz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        // A low roof slab (AC unit / penthouse) on the taller towers.
        // It stays flat and in the roof's own colour: the old tall grey
        // box poked above the rooflines of nearer buildings and read as
        // a box floating in the sky at the edge of the frame.
        if (height > 22 && rng.chance(0.6)) {
          const top = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.5, 1.2, d * 0.5),
            new THREE.MeshStandardMaterial({ color: roof.color, roughness: 1 }),
          );
          top.position.set(bx + ox, height + 0.4, bz + oz);
          top.castShadow = true;
          group.add(top);
        }
        const minX = bx + ox - w / 2; const maxX = bx + ox + w / 2;
        const minZ = bz + oz - d / 2; const maxZ = bz + oz + d / 2;
        colliders.push({ minX, maxX, minZ, maxZ });
        buildings.push({ x: bx + ox, z: bz + oz, w, d, h: height });
      }
    }
  }

  // --- palms along the beach and the main boulevard ------------------------
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6d4b, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3e9e4d, roughness: 1, side: THREE.DoubleSide });
  function addPalm(x, z) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat);
    trunk.position.y = 3.5;
    trunk.castShadow = true;
    palm.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), leafMat);
      leaf.position.y = 7.1;
      leaf.rotation.y = (i / 6) * Math.PI * 2;
      leaf.rotation.x = -0.5;
      leaf.translateZ(1.6);
      leaf.castShadow = true;
      palm.add(leaf);
    }
    palm.position.set(x, 0, z);
    palm.rotation.y = rng.range(0, Math.PI * 2);
    group.add(palm);
  }
  for (let z = -120; z <= 120; z += 24) {
    // Keep the mission-1 beacon clear: a palm trunk at (-133, 24) used
    // to stand exactly on the beacon beam at (-132, 24).
    let pz = z + rng.range(-4, 4);
    if (Math.abs(pz - 24) < 8) pz += 12;
    addPalm(BEACH_X - 8, pz);
  }
  for (let x = -100; x <= 100; x += 50) { addPalm(x + 8, -56); addPalm(x - 8, 56); }

  // --- street lamps on the central avenue ----------------------------------
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.6, metalness: 0.4 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc861, emissiveIntensity: 1.2 });
  for (let z = -100; z <= 100; z += 25) {
    for (const x of [-7, 7]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), poleMat);
      pole.position.set(x, 3, z);
      pole.castShadow = true;
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), lampMat);
      bulb.position.set(x, 6.2, z);
      group.add(bulb);
    }
  }

  // --- clouds: flat white slabs drifting high above the city ---------------
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xfff6e8, roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Mesh(new THREE.BoxGeometry(rng.range(18, 34), 2.5, rng.range(8, 14)), cloudMat);
    cloud.position.set(rng.range(-180, 180), rng.range(70, 95), rng.range(-180, 180));
    group.add(cloud);
  }

  return {
    colliders,
    buildings,
    roadLines,
    // Where the player starts: the beachfront promenade, facing downtown.
    spawn: { x: -108, z: 0, yaw: -Math.PI / 2 },
    // First mission target: Rico waiting by the pier on the west beach.
    missionTarget: { x: -132, z: 24 },
  };
}

// Push a circle (player, car, pedestrian) out of every building it overlaps.
export function resolveBuildingCollisions(colliders, x, z, radius) {
  let px = x;
  let pz = z;
  for (const b of colliders) {
    const cx = Math.max(b.minX, Math.min(px, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pz, b.maxZ));
    const dx = px - cx;
    const dz = pz - cz;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        px = cx + (dx / dist) * radius;
        pz = cz + (dz / dist) * radius;
      } else if (px < (b.minX + b.maxX) / 2) px = b.minX - radius;
      else px = b.maxX + radius;
    }
  }
  return { x: px, z: pz };
}
