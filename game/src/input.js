// Keyboard + mouse input for Sunset Shores. Held keys are read every frame;
// one-shot presses (enter car, jump, horn, pause, mute) are queued as flags
// and taken once by the game loop, so a press between frames is never lost.
export const PRESS_ENTER_CAR = 1;
export const PRESS_JUMP = 2;
export const PRESS_HORN = 4;
export const PRESS_PAUSE = 8;
export const PRESS_MUTE = 16;
export const PRESS_START = 32;
export const PRESS_PUNCH = 64;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas) {
  const held = new Set();
  let presses = 0;
  let yawDelta = 0;
  let pitchDelta = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'KeyE') presses |= PRESS_ENTER_CAR;
    else if (event.code === 'Space') { presses |= PRESS_JUMP; event.preventDefault(); }
    else if (event.code === 'KeyF') presses |= PRESS_PUNCH;
    else if (event.code === 'KeyH') presses |= PRESS_HORN;
    else if (event.code === 'Escape' || event.code === 'KeyP') presses |= PRESS_PAUSE;
    else if (event.code === 'KeyM') presses |= PRESS_MUTE;
    else if (event.code === 'Enter') presses |= PRESS_START;
  });
  window.addEventListener('keyup', (event) => { held.delete(event.code); });
  window.addEventListener('blur', () => { held.clear(); dragging = false; });

  // Drag to orbit the camera: pointer lock is avoided on purpose, so the
  // camera also works in a plain screenshot run without a user gesture.
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true; lastX = event.clientX; lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    yawDelta -= (event.clientX - lastX) * 0.005;
    pitchDelta += (event.clientY - lastY) * 0.004;
    lastX = event.clientX; lastY = event.clientY;
  });
  const endDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    pitchDelta += 0; // zoom is handled by the camera through takeWheel below
    wheelDelta += event.deltaY;
  }, { passive: false });

  let wheelDelta = 0;

  return {
    // Axes in -1..1, read fresh every frame.
    axes() {
      let x = 0;
      let z = 0;
      for (const code of held) {
        if (FORWARD.has(code)) z += 1;
        if (BACK.has(code)) z -= 1;
        if (LEFT.has(code)) x -= 1;
        if (RIGHT.has(code)) x += 1;
      }
      return { x, z };
    },
    running() {
      for (const code of held) if (RUN.has(code)) return true;
      return false;
    },
    takePresses() { const taken = presses; presses = 0; return taken; },
    takeOrbit() {
      const out = { yaw: yawDelta, pitch: pitchDelta, wheel: wheelDelta };
      yawDelta = 0; pitchDelta = 0; wheelDelta = 0;
      return out;
    },
  };
}
