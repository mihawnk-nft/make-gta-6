// Melee combat: Mara's punch (F). One short swing in front of her — a
// flashing amber wedge, a thud, and consequences: a pedestrian goes down,
// a patrol car takes the insult personally, and the wanted level notices.
//
// Deliberately simple: no weapons, no combos, one button, one cooldown.
// Hit detection is a cone in front of the player; the caller decides
// what each hit means (wanted stars, toasts, sounds).
import * as THREE from 'three';

const PUNCH_RANGE = 2.4;
const PUNCH_HALF_ARC = 1.0; // radians either side of the facing direction
const PUNCH_COOLDOWN = 0.45;
const FX_SECONDS = 0.18;

export function createCombat(scene) {
  // The swing flash: a flat amber wedge, parented to a group so it can
  // be turned to face wherever Mara faces.
  const swing = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffd23f, transparent: true, opacity: 0,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const wedge = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 12, -Math.PI / 2 - PUNCH_HALF_ARC, PUNCH_HALF_ARC * 2),
    mat,
  );
  wedge.rotation.x = -Math.PI / 2;
  swing.add(wedge);
  swing.visible = false;
  scene.add(swing);

  let cooldown = 0;
  let fxTimer = 0;

  // Distance to a target inside the punch cone, or 0 when it is not.
  function inCone(px, pz, heading, tx, tz) {
    const dx = tx - px;
    const dz = tz - pz;
    const dist = Math.hypot(dx, dz);
    if (dist > PUNCH_RANGE || dist < 0.01) return 0;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const dot = (dx * fx + dz * fz) / dist;
    return dot > Math.cos(PUNCH_HALF_ARC) ? dist : 0;
  }

  return {
    get ready() { return cooldown <= 0; },
    update(dt) {
      cooldown = Math.max(0, cooldown - dt);
      if (fxTimer > 0) {
        fxTimer -= dt;
        mat.opacity = Math.max(0, fxTimer / FX_SECONDS) * 0.7;
        if (fxTimer <= 0) swing.visible = false;
      }
    },

    // Swing once. peds are { x, z, down }, cops and cars are { x, z }.
    // Returns the nearest pedestrian hit, and whether a cop or a car was hit.
    punch(px, pz, heading, peds, cops, cars) {
      if (cooldown > 0) return { hit: false };
      cooldown = PUNCH_COOLDOWN;
      swing.position.set(px + Math.sin(heading) * 1.2, 1.1, pz + Math.cos(heading) * 1.2);
      swing.rotation.y = heading;
      swing.visible = true;
      fxTimer = FX_SECONDS;

      let hitPed = null;
      let best = Infinity;
      for (const w of peds) {
        if (w.down) continue;
        const d = inCone(px, pz, heading, w.x, w.z);
        if (d > 0 && d < best) { best = d; hitPed = w; }
      }
      let hitCop = false;
      for (const c of cops) {
        if (inCone(px, pz, heading, c.x, c.z) > 0) { hitCop = true; break; }
      }
      let hitCar = false;
      for (const c of cars) {
        if (inCone(px, pz, heading, c.x, c.z) > 0) { hitCar = true; break; }
      }
      return { hit: Boolean(hitPed || hitCop || hitCar), hitPed, hitCop, hitCar };
    },
  };
}
