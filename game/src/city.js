// Sunset Shores: a procedural sunset city on the beach. Deterministic from
// seed 7 — the same seed rebuilds the same streets every load.
import * as THREE from 'three';
import { SEED, WORLD } from './config.js';
import { createRng, range, pick } from './rng.js';

function windowTexture(rng, base, litRatio) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const c = canvas.getContext('2d');
  c.fillStyle = base;
  c.fillRect(0, 0, 128, 256);
  const cols = 6;
  const rows = 12;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const lit = rng() < litRatio;
      c.fillStyle = lit ? pick(rng, ['#ffd98a', '#ffe9b0', '#ffb46b']) : '#20242e';
      c.fillRect(8 + x * 19, 10 + y * 20, 12, 13);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(G) {
  const rng = createRng(SEED);
  const scene = G.scene;
  const colliders = [];

  // Warm late-afternoon sky, haze on the horizon.
  scene.background = new THREE.Color(0xff9e5e);
  scene.fog = new THREE.Fog(0xf2a06b, 90, 320);

  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x5a4a6a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffa54e, 2.4);
  sun.position.set(-120, 70, 60);
  // Crisp golden-hour shadows: a 1024 map over the whole downtown, tuned
  // tight enough that building edges stay sharp under SwiftShader.
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -170;
  sun.shadow.camera.right = 140;
  sun.shadow.camera.top = 140;
  sun.shadow.camera.bottom = -140;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 420;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8fb4ff, 0.35);
  fill.position.set(80, 40, -80);
  scene.add(fill);

  // Sun disc low over the sea.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(16, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
  );
  sunDisc.position.set(-260, 42, -20);
  sunDisc.lookAt(0, 42, -20);
  scene.add(sunDisc);

  // Ground: grass-ish city base, then roads, sidewalks, sand and sea.
  // The ground catches the long golden-hour shadows.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(340, 340),
    new THREE.MeshStandardMaterial({ color: 0x6f7f5a, roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-15, -0.05, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2e3138 });
  const walkMat = new THREE.MeshStandardMaterial({ color: 0x9a938a });
  for (const r of WORLD.roads) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(12, 264), roadMat);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(r, 0, 0);
    scene.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(264, 12), roadMat);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.01, r);
    scene.add(ew);
    // Sidewalks flank each road.
    for (const off of [-8.5, 8.5]) {
      const s1 = new THREE.Mesh(new THREE.PlaneGeometry(5, 264), walkMat);
      s1.rotation.x = -Math.PI / 2;
      s1.position.set(r + off, 0.02, 0);
      scene.add(s1);
      const s2 = new THREE.Mesh(new THREE.PlaneGeometry(264, 5), walkMat);
      s2.rotation.x = -Math.PI / 2;
      s2.position.set(0, 0.03, r + off);
      scene.add(s2);
    }
    // Dashed centre line.
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c86a });
    for (let d = -126; d <= 126; d += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(r, 0.04, d);
      scene.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), dashMat);
      dash2.rotation.x = -Math.PI / 2;
      dash2.position.set(d, 0.04, r);
      scene.add(dash2);
    }
  }

  // Sand and sea on the west edge, plus the wooden pier.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 300),
    new THREE.MeshStandardMaterial({ color: 0xe8cf9a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-142, 0.02, 0);
  scene.add(sand);
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x2f7fa8, transparent: true, opacity: 0.92 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(120, 300), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-228, 0.05, 0);
  scene.add(sea);
  G.sea = sea;
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8a6a44 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(24, 0.6, 9), pierMat);
  pier.position.set(-158, 0.35, 0);
  scene.add(pier);
  colliders.push({ minX: -170, maxX: -146, minZ: -4.5, maxZ: 4.5, top: 0.65, pier: true });
  for (let i = 0; i < 5; i += 1) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.6, 8), pierMat);
    post.position.set(-150 - i * 4.5, -0.2, i % 2 === 0 ? -4 : 4);
    scene.add(post);
  }

  // Buildings: taller and denser near the centre, lit windows at dusk.
  const facadeColors = ['#b98a6a', '#8a7a9a', '#7a8a9a', '#a89a7a', '#9a6a7a', '#6a8a7a'];
  const textures = facadeColors.map((c) => windowTexture(rng, c, 0.45));
  let texIndex = 0;
  for (const bx of WORLD.blocks) {
    for (const bz of WORLD.blocks) {
      const distCentre = Math.sqrt(bx * bx + bz * bz) / 125;
      const count = distCentre < 0.35 ? 2 : 1;
      for (let n = 0; n < count; n += 1) {
        const w = range(rng, 12, 16);
        const d = range(rng, 12, 16);
        const h = range(rng, 10, 16) + (1 - distCentre) * range(rng, 18, 42);
        const ox = count === 2 ? (n === 0 ? -6 : 6) : 0;
        const oz = count === 2 ? (n === 0 ? -6 : 6) : 0;
        const cx = bx + ox + range(rng, -1, 1);
        const cz = bz + oz + range(rng, -1, 1);
        const tex = textures[texIndex % textures.length];
        texIndex += 1;
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05 });
        const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        building.position.set(cx, h / 2, cz);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        // Flat roof cap, slightly darker.
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6),
          new THREE.MeshStandardMaterial({ color: 0x3a3f4a }),
        );
        roof.position.set(cx, h + 0.4, cz);
        scene.add(roof);
        colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, top: h });
      }
      // A few blocks get a small shop awning box at street level.
      if (rng() < 0.4) {
        const awn = new THREE.Mesh(
          new THREE.BoxGeometry(10, 0.4, 4),
          new THREE.MeshStandardMaterial({ color: pick(rng, [0xd94f3d, 0x3d7bd9, 0xe8b93c, 0x4fae5e]) }),
        );
        awn.position.set(bx, 3.4, bz + WORLD.blockHalf + 1);
        scene.add(awn);
      }
    }
  }

  // Central tower — the skyline landmark.
  const towerTex = windowTexture(rng, '#7a6a8a', 0.6);
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(20, 68, 20),
    new THREE.MeshStandardMaterial({ map: towerTex, roughness: 0.8, metalness: 0.1 }),
  );
  tower.position.set(0, 34, 0);
  tower.castShadow = true;
  tower.receiveShadow = true;
  scene.add(tower);
  colliders.push({ minX: -10, maxX: 10, minZ: -10, maxZ: 10, top: 68 });
  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 1.6, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xd9a03c, emissive: 0xaa7010, emissiveIntensity: 0.7 }),
  );
  spire.position.set(0, 74, 0);
  scene.add(spire);

  // Street lamps along every avenue.
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36 });
  const lampGlowMat = new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffc860, emissiveIntensity: 1.4 });
  for (const r of WORLD.roads) {
    for (let d = -110; d <= 110; d += 44) {
      for (const side of [-7, 7]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.4, 6), lampPoleMat);
        pole.position.set(r + side, 2.7, d);
        scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), lampGlowMat);
        bulb.position.set(r + side, 5.5, d);
        scene.add(bulb);
      }
      const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.4, 6), lampPoleMat);
      pole2.position.set(d, 2.7, r + 7);
      scene.add(pole2);
      const bulb2 = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), lampGlowMat);
      bulb2.position.set(d, 5.5, r + 7);
      scene.add(bulb2);
    }
  }

  // Palm trees along the beachfront.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f8f4f });
  G.palms = [];
  for (let z = -120; z <= 120; z += 16) {
    if (Math.abs(z) < 8) continue; // keep the pier approach clear
    const x = -118 + range(rng, -2, 2);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 6.5, 7), trunkMat);
    trunk.position.set(x, 3.25, z);
    trunk.rotation.z = range(rng, -0.08, 0.08);
    scene.add(trunk);
    for (let leaf = 0; leaf < 5; leaf += 1) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 5), leafMat);
      const a = (leaf / 5) * Math.PI * 2;
      frond.position.set(x + Math.cos(a) * 1.2, 6.6, z + Math.sin(a) * 1.2);
      frond.rotation.z = Math.cos(a) * 1.1;
      frond.rotation.x = -Math.sin(a) * 1.1;
      scene.add(frond);
    }
    G.palms.push({ x, z });
    colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4, top: 6.5 });
  }

  // Drifting sunset clouds.
  G.clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffe0c0, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 14; i += 1) {
    const cloud = new THREE.Group();
    for (let puff = 0; puff < 4; puff += 1) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(range(rng, 4, 9), 8, 6), cloudMat);
      s.position.set(puff * 6 - 9, range(rng, -1, 1), range(rng, -3, 3));
      s.scale.y = 0.45;
      cloud.add(s);
    }
    cloud.position.set(range(rng, -220, 160), range(rng, 55, 85), range(rng, -180, 180));
    scene.add(cloud);
    G.clouds.push(cloud);
  }

  G.colliders = colliders;
  return { colliders };
}

// Gentle sea shimmer + slow cloud drift. Cheap: only material/position tweaks.
export function updateCity(G, dt) {
  if (G.sea) {
    G.sea.position.y = 0.05 + Math.sin(G.state.time * 0.7) * 0.03;
  }
  if (G.clouds) {
    for (const cloud of G.clouds) {
      cloud.position.x += dt * 0.7;
      if (cloud.position.x > 220) cloud.position.x = -240;
    }
  }
}

// Circle-vs-AABB collision: push the circle out of any solid collider.
// Returns true when a collision happened. Pier deck is walkable (top 0.65),
// so it never blocks on foot.
export function collideCircle(G, x, z, radius, y) {
  let hit = false;
  for (const c of G.colliders) {
    if (c.pier) continue;
    if (y !== undefined && y > c.top) continue;
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (radius - d) / d;
        x += dx * push;
        z += dz * push;
      } else {
        x += radius;
      }
    }
  }
  return { x, z, hit };
}

export function insideWorld(x, z) {
  return {
    x: Math.max(WORLD.minX, Math.min(WORLD.maxX, x)),
    z: Math.max(WORLD.minZ, Math.min(WORLD.maxZ, z)),
  };
}
