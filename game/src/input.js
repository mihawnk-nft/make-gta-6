// Keyboard + mouse input. Held keys steer; one-shot presses (E, F, H, Esc,
// Space, P, R, Q, Tab, Z, X, C) are queued as flags and consumed once by
// the loop, so a press between frames is never lost and never counted
// twice. Digit 1-8 picks a weapon slot directly. Every letter key also
// feeds the cheat-code buffer (GTA style). Left click attacks, right
// click aims (hold), dragging orbits the camera.
import { feedCheatLetter, applyCheat } from './cheats.js';

export const PRESS_ENTER_CAR = 1;
export const PRESS_PUNCH = 2;
export const PRESS_HORN = 4;
export const PRESS_PAUSE = 8;
export const PRESS_JUMP = 16;
export const PRESS_CONFIRM = 32;
export const PRESS_RADIO = 64;
export const PRESS_PHONE = 128;
export const PRESS_CYCLE_WEAPON = 256;
export const PRESS_WHEEL = 512;
export const PRESS_CREW_DEX = 1024;
export const PRESS_CREW_MAYA = 2048;
export const PRESS_CREW_REX = 4096;
export const PRESS_RELOAD = 8192;

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
};

export function createInput(G, canvas) {
  const held = { up: false, down: false, left: false, right: false, run: false };
  let presses = 0;
  let weaponSelect = -1; // Digit1-8 sets 0-7; main consumes it once
  let aiming = false;
  let yaw = 0; // camera orbit yaw, radians
  let pitch = 0.32;
  let distance = 10;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let downX = 0;
  let downY = 0;
  let downTime = 0;

  window.addEventListener('keydown', (event) => {
    // Cheat buffer first: every letter counts, even W/A/S/D.
    if (!event.repeat && event.key && event.key.length === 1) {
      const code = feedCheatLetter(G, event.key);
      if (code) applyCheat(G, code);
    }
    const name = KEYMAP[event.code];
    if (name) {
      held[name] = true;
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (event.code === 'KeyE') presses |= PRESS_ENTER_CAR;
    else if (event.code === 'KeyF') presses |= PRESS_PUNCH;
    else if (event.code === 'KeyH') presses |= PRESS_HORN;
    else if (event.code === 'Escape') presses |= PRESS_PAUSE;
    else if (event.code === 'Space') presses |= PRESS_JUMP;
    else if (event.code === 'Enter') presses |= PRESS_CONFIRM;
    else if (event.code === 'KeyR') { presses |= PRESS_RADIO; presses |= PRESS_RELOAD; }
    else if (event.code === 'KeyP') presses |= PRESS_PHONE;
    else if (event.code === 'KeyQ') presses |= PRESS_CYCLE_WEAPON;
    else if (event.code === 'Tab') presses |= PRESS_WHEEL;
    else if (event.code === 'KeyZ') presses |= PRESS_CREW_DEX;
    else if (event.code === 'KeyX') presses |= PRESS_CREW_MAYA;
    else if (event.code === 'KeyC') presses |= PRESS_CREW_REX;
    else if (/^Digit[1-8]$/.test(event.code)) weaponSelect = Number(event.code.slice(5)) - 1;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const name = KEYMAP[event.code];
    if (name) held[name] = false;
  });
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.run = false;
    dragging = false;
    aiming = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 2) {
      // Right button: hold to aim.
      aiming = true;
      event.preventDefault();
      return;
    }
    if (event.button !== 0) return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    downX = event.clientX;
    downY = event.clientY;
    downTime = performance.now();
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    yaw -= (event.clientX - lastX) * 0.005;
    pitch = Math.max(0.08, Math.min(1.1, pitch + (event.clientY - lastY) * 0.004));
    lastX = event.clientX;
    lastY = event.clientY;
  });
  const endDrag = (event) => {
    // A quick click (not a drag) with the left button fires the weapon.
    if (dragging && event && event.type === 'pointerup' && event.button === 0) {
      const moved = Math.hypot(event.clientX - downX, event.clientY - downY);
      if (moved < 6 && performance.now() - downTime < 400) presses |= PRESS_PUNCH;
    }
    dragging = false;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerup', (event) => {
    if (event.button === 2) aiming = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('wheel', (event) => {
    distance = Math.max(6, Math.min(17, distance + Math.sign(event.deltaY) * 1.5));
    event.preventDefault();
  }, { passive: false });

  return {
    held,
    takePresses() {
      const taken = presses;
      presses = 0;
      return taken;
    },
    peekPresses() { return presses; },
    takeWeaponSelect() {
      const taken = weaponSelect;
      weaponSelect = -1;
      return taken;
    },
    get aiming() { return aiming; },
    camera: {
      get yaw() { return yaw; },
      set yaw(v) { yaw = v; },
      get pitch() { return pitch; },
      get distance() { return distance; },
    },
  };
}
