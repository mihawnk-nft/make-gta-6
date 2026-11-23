// Cars: mesh factory + parked-car spawns. A car is a low-poly body, cabin,
// four spinning wheels and headlights; police cars add a light bar.
// Luxury styles change the silhouette: the supercar is low and wide with
// a spoiler, the limo is long, the muscle car gets a hood scoop.
import * as THREE from 'three';
import { CAR_NAMES, CAR_COLORS, WORLD, CAR_STYLES, LUXURY_NAMES } from './config.js';
import { createRng, pick, range } from './rng.js';

export function createCarMesh(color, isPolice, style) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.45 });
  const isSuper = style === 'supercar';
  const isLimo = style === 'limo';
  const isMuscle = style === 'muscle';
  const bodyLen = isLimo ? 6.4 : isSuper ? 4.2 : 4.4;
  const bodyH = isSuper ? 0.5 : 0.62;
  const bodyW = isSuper ? 2.2 : 2.0;
  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyLen), bodyMat);
  body.position.y = isSuper ? 0.55 : 0.62;
  body.castShadow = true;
  group.add(body);
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1c2733, metalness: 0.6, roughness: 0.25 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(isSuper ? 1.5 : 1.7, isSuper ? 0.45 : 0.55, isLimo ? 2.6 : 2.2), cabinMat);
  cabin.position.set(0, isSuper ? 1.0 : 1.18, isLimo ? -0.5 : -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  if (isSuper) {
    // Rear spoiler on two small struts.
    const spoilerMat = new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.6, roughness: 0.3 });
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.5), spoilerMat);
    wing.position.set(0, 1.05, -2.0);
    group.add(wing);
    for (const sx of [-0.7, 0.7]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), spoilerMat);
      strut.position.set(sx, 0.85, -2.0);
      group.add(strut);
    }
  }
  if (isMuscle) {
    // Hood scoop.
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 1.0), bodyMat);
    scoop.position.set(0, 1.0, 1.3);
    group.add(scoop);
  }
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14161a });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffedb0, emissiveIntensity: 0.9 });
  for (const sx of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.1), lightMat);
    lamp.position.set(sx, 0.7, 2.22);
    group.add(lamp);
  }
  let lightBar = null;
  let redLight = null;
  let blueLight = null;
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    bar.position.set(0, 1.55, -0.25);
    group.add(bar);
    redLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.24, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 2 }),
    );
    redLight.position.set(-0.32, 1.55, -0.25);
    group.add(redLight);
    blueLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.24, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x0033ff, emissiveIntensity: 2 }),
    );
    blueLight.position.set(0.32, 1.55, -0.25);
    group.add(blueLight);
    lightBar = bar;
  }
  return { group, wheels, lightBar, redLight, blueLight };
}

export function makeCar(G, opts) {
  const style = opts.style || 'sedan';
  const tune = CAR_STYLES[style] || CAR_STYLES.sedan;
  const mesh = createCarMesh(opts.color, !!opts.isPolice, style);
  mesh.group.position.set(opts.x, 0, opts.z);
  mesh.group.rotation.y = opts.angle || 0;
  G.scene.add(mesh.group);
  const car = {
    kind: opts.kind || 'parked', // parked | traffic | police | player
    name: opts.name || 'Mobil',
    color: opts.color,
    style,
    maxSpeed: opts.maxSpeed ?? tune.maxSpeed,
    steer: opts.steer ?? tune.steer,
    value: opts.value ?? tune.value,
    minRank: opts.minRank ?? tune.minRank,
    x: opts.x,
    z: opts.z,
    angle: opts.angle || 0,
    speed: 0,
    condition: opts.condition ?? 100,
    stolen: false,
    stopped: false,
    mesh,
    // traffic loop state
    loop: opts.loop || null,
    waypoint: 0,
    // police state
    ramCooldown: 0,
    flash: 0,
  };
  return car;
}

export function syncCarMesh(car) {
  car.mesh.group.position.x = car.x;
  car.mesh.group.position.z = car.z;
  car.mesh.group.rotation.y = car.angle;
  const spin = car.speed * 0.9;
  for (const wheel of car.mesh.wheels) wheel.rotation.x += spin * 0.016;
}

export function removeCar(G, car) {
  G.scene.remove(car.mesh.group);
}

// Parked cars line the avenues. Returns the list; the player can steal any.
export function spawnParkedCars(G) {
  const rng = createRng(99);
  const spots = [];
  const roads = WORLD.roads;
  for (let i = 0; i < 12; i += 1) {
    const road = pick(rng, roads);
    const along = pick(rng, [-100, -80, -56, -34, -12, 12, 34, 56, 80, 100]);
    const side = rng() < 0.5 ? -1 : 1;
    const horizontal = rng() < 0.5;
    let x;
    let z;
    let angle;
    if (horizontal) {
      x = along;
      z = road + side * 4.2;
      angle = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = road + side * 4.2;
      z = along;
      angle = side > 0 ? 0 : Math.PI;
    }
    // Keep the spawn avenue and the mission targets clear.
    if (Math.abs(x) < 6 && Math.abs(z - 100) < 8) continue;
    if (Math.abs(x - 104) < 8 && Math.abs(z - 88) < 8) continue;
    if (Math.abs(x + 104) < 8 && Math.abs(z + 88) < 8) continue;
    spots.push({ x, z, angle });
  }
  const cars = [];
  for (let i = 0; i < spots.length; i += 1) {
    const spot = spots[i];
    // The first spot always holds a supercar, so the city never lacks one;
    // the rest mix street cars with sports, muscle and limo sightings.
    let style = 'sedan';
    let name = pick(rng, CAR_NAMES);
    if (i === 0) {
      style = 'supercar';
      name = pick(rng, LUXURY_NAMES.supercar);
    } else {
      const roll = rng();
      if (roll < 0.18) { style = 'sports'; name = pick(rng, LUXURY_NAMES.sports); }
      else if (roll < 0.32) { style = 'muscle'; name = pick(rng, LUXURY_NAMES.muscle); }
      else if (roll < 0.4) { style = 'limo'; name = pick(rng, LUXURY_NAMES.limo); }
    }
    const color = pick(rng, CAR_COLORS);
    cars.push(makeCar(G, { kind: 'parked', style, name, color, x: spot.x, z: spot.z, angle: spot.angle }));
  }
  return cars;
}
