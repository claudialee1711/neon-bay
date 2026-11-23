// The camera for Neon Bay v2: a smooth follow camera that eases toward the
// player instead of snapping, and clamps to the world edges.
import { VIEW, WORLD } from './constants.js';

export function createCamera() {
  return {
    x: 0,
    y: 0,
    width: VIEW.width,
    height: VIEW.height,
    /** Snap straight to the target (used on spawn / stage setup). */
    snapTo(tx, ty) {
      this.x = clamp(tx - this.width / 2, 0, WORLD.width - this.width);
      this.y = clamp(ty - this.height / 2, 0, WORLD.height - this.height);
    },
    update(dt, tx, ty) {
      const wantX = clamp(tx - this.width / 2, 0, WORLD.width - this.width);
      const wantY = clamp(ty - this.height / 2, 0, WORLD.height - this.height);
      // Frame-rate independent ease: ~8/s toward the target.
      const k = 1 - Math.exp(-8 * dt);
      this.x += (wantX - this.x) * k;
      this.y += (wantY - this.y) * k;
    },
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
