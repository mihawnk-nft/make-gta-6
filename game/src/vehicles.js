// Cars of Sunset Shores: a low-poly car factory (body, cabin, wheels,
// headlights, taillights) and the parked cars that line the avenues, waiting
// to be stolen. Driving itself lives in the traffic and player-car code.
import * as THREE from 'three';

export const CAR_COLORS = [
  0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6,
  0xecf0f1, 0x1abc9c, 0xe67e22, 0x34495e, 0xfd79a8,
];
export const CAR_NAMES = [
  'Comet GT', 'Sunrunner', 'Bay Cruiser', 'Palma Coupe', 'Coral Sedan',
  'Vista Van', 'Neon Hatch', 'Dune Buggy', 'Marina Sport', 'Coco Taxi',
];

export function createCarMesh(colorHex) {
  const car = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: colorHex, roughness: 0.35, metalness: 0.45,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x1a2b3c, roughness: 0.15, metalness: 0.6,
  });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 1 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.3), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  car.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.55, 2.1), glass);
  cabin.position.set(0, 1.1, -0.25);
  cabin.castShadow = true;
  car.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.9), paint);
  roof.position.set(0, 1.4, -0.25);
  car.add(roof);

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14);
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, tyre);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    car.add(wheel);
  }
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffedb0, emissiveIntensity: 0.9 });
  for (const hx of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headMat);
    lamp.position.set(hx, 0.62, 2.16);
    car.add(lamp);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2d2d, emissive: 0xaa0000, emissiveIntensity: 0.8 });
  for (const tx of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
    lamp.position.set(tx, 0.62, -2.16);
    car.add(lamp);
  }
  return car;
}

// Parked cars along the avenue edges. Returns the list so the steal-car
// interaction (E key) can find the nearest one.
export function spawnParkedCars(scene, rng) {
  const parked = [];
  const spots = [];
  for (const road of [-100, -50, 0, 50, 100]) {
    for (let t = -90; t <= 90; t += 30) {
      spots.push({ x: road + 8.6, z: t, heading: Math.PI / 2 });
      spots.push({ x: road - 8.6, z: t + 15, heading: -Math.PI / 2 });
    }
  }
  for (const spot of spots) {
    if (!rng.chance(0.45)) continue;
    const color = rng.pick(CAR_COLORS);
    const mesh = createCarMesh(color);
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = spot.heading;
    scene.add(mesh);
    parked.push({
      mesh, x: spot.x, z: spot.z, heading: spot.heading,
      color, name: rng.pick(CAR_NAMES),
    });
  }
  return parked;
}
