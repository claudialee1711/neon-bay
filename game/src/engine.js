// The game loop for Neon Bay v2: fixed 1/60 s simulation steps (several in
// a slow frame, none in a fast one), then one paint per frame. A long stall
// (a hidden tab) is dropped, not replayed.
import { STEP } from './constants.js';

const MAX_FRAME = 0.25;

export function createEngine({ update, render }) {
  let running = false;
  let last = 0;
  let accumulator = 0;
  let frames = 0;
  let fpsTime = 0;
  let fps = 0;

  function frame(now) {
    if (!running) return;
    const dt = Math.min(MAX_FRAME, (now - last) / 1000 || 0);
    last = now;
    accumulator += dt;
    while (accumulator >= STEP) {
      update(STEP);
      accumulator -= STEP;
    }
    render(dt);
    frames += 1;
    fpsTime += dt;
    if (fpsTime >= 1) {
      fps = Math.round(frames / fpsTime);
      frames = 0;
      fpsTime = 0;
    }
    requestAnimationFrame(frame);
  }

  return {
    get fps() { return fps; },
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    },
    stop() { running = false; },
  };
}
