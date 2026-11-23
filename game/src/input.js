// Keyboard and pointer input. Held keys are read every frame; one-shot presses
// (enter a car, carjack, pause, mute) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice. The
// mouse aims: the pointer's world position is where the player shoots.

export const ACTION_ENTER = 1;
export const ACTION_CARJACK = 2;
export const ACTION_PAUSE = 4;
export const ACTION_CONFIRM = 8;
export const ACTION_MUTE = 16;
export const ACTION_INTERACT = 32;
export const ACTION_NEWGAME = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false, shoot: false, interactHeld: false };
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseIn = false;

  function setKey(code, value) {
    if (UP.has(code)) keys.up = value;
    else if (DOWN.has(code)) keys.down = value;
    else if (LEFT.has(code)) keys.left = value;
    else if (RIGHT.has(code)) keys.right = value;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      setKey(event.code, true);
      event.preventDefault();
      return;
    }
    if (event.code === 'Space') keys.shoot = true;
    if (event.code === 'KeyE') keys.interactHeld = true;
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyE') actions |= ACTION_ENTER | ACTION_INTERACT;
    else if (event.code === 'KeyF') actions |= ACTION_CARJACK;
    else if (event.code === 'KeyN') actions |= ACTION_NEWGAME;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    setKey(event.code, false);
    if (event.code === 'Space') keys.shoot = false;
    if (event.code === 'KeyE') keys.interactHeld = false;
  });
  window.addEventListener('blur', () => {
    keys.up = false; keys.down = false; keys.left = false; keys.right = false; keys.shoot = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseIn = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      keys.shoot = true;
      actions |= ACTION_CONFIRM;
    }
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) keys.shoot = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    keys,
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Pointer position in canvas CSS pixels, and whether it has been seen yet. */
    mouse() {
      return { x: mouseX, y: mouseY, inside: mouseIn };
    },
    /** Drive input for tests and staged shots: set the held keys directly. */
    setKeys(next) {
      Object.assign(keys, next);
    },
    /** Queue one-shot actions directly (tests and staged shots). */
    queue(action) {
      actions |= action;
    },
  };
}
