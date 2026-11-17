// Keyboard + mouse input. Held keys steer; one-shot presses (E, F, H, Esc,
// Space) are queued as flags and consumed once by the loop, so a press
// between frames is never lost and never counted twice.
export const PRESS_ENTER_CAR = 1;
export const PRESS_PUNCH = 2;
export const PRESS_HORN = 4;
export const PRESS_PAUSE = 8;
export const PRESS_JUMP = 16;
export const PRESS_CONFIRM = 32;

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

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, run: false };
  let presses = 0;
  let yaw = 0; // camera orbit yaw, radians
  let pitch = 0.32;
  let distance = 10;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
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
  });

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    yaw -= (event.clientX - lastX) * 0.005;
    pitch = Math.max(0.08, Math.min(1.1, pitch + (event.clientY - lastY) * 0.004));
    lastX = event.clientX;
    lastY = event.clientY;
  });
  const endDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
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
    camera: {
      get yaw() { return yaw; },
      set yaw(v) { yaw = v; },
      get pitch() { return pitch; },
      get distance() { return distance; },
    },
  };
}
