// Keyboard + mouse input for Neon Bay v2. Keys are tracked as a live set so
// the player, the camera and later the car code all read the same state.
// WASD and arrows move, Shift runs, Space is the action key, P pauses,
// Enter confirms, M mutes (wired up by the audio stage).
export const ACTION_UP = 'up';
export const ACTION_DOWN = 'down';
export const ACTION_LEFT = 'left';
export const ACTION_RIGHT = 'right';
export const ACTION_RUN = 'run';
export const ACTION_USE = 'use';
export const ACTION_PAUSE = 'pause';
export const ACTION_CONFIRM = 'confirm';
export const ACTION_MUTE = 'mute';
export const ACTION_NEWGAME = 'newgame';

const KEY_MAP = {
  KeyW: ACTION_UP, ArrowUp: ACTION_UP,
  KeyS: ACTION_DOWN, ArrowDown: ACTION_DOWN,
  KeyA: ACTION_LEFT, ArrowLeft: ACTION_LEFT,
  KeyD: ACTION_RIGHT, ArrowRight: ACTION_RIGHT,
  ShiftLeft: ACTION_RUN, ShiftRight: ACTION_RUN,
  Space: ACTION_USE,
  KeyE: ACTION_USE, KeyF: ACTION_USE,
  KeyP: ACTION_PAUSE, Escape: ACTION_PAUSE,
  Enter: ACTION_CONFIRM,
  KeyM: ACTION_MUTE,
  KeyN: ACTION_NEWGAME,
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false };

  function onKeyDown(event) {
    const action = KEY_MAP[event.code];
    if (!action) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!held.has(action)) pressed.add(action);
    held.add(action);
  }
  function onKeyUp(event) {
    const action = KEY_MAP[event.code];
    if (action) held.delete(action);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', () => { mouse.down = true; });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  window.addEventListener('blur', () => { held.clear(); });

  return {
    held,
    mouse,
    is(action) { return held.has(action); },
    /** True once, on the frame the key went down. */
    wasPressed(action) { return pressed.has(action); },
    /** Unit movement vector from the held movement keys. */
    moveVector() {
      let x = 0;
      let y = 0;
      if (held.has(ACTION_LEFT)) x -= 1;
      if (held.has(ACTION_RIGHT)) x += 1;
      if (held.has(ACTION_UP)) y -= 1;
      if (held.has(ACTION_DOWN)) y += 1;
      if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    },
    endFrame() { pressed.clear(); },
  };
}
