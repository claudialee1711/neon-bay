// The player on foot for Neon Bay v2: position, facing, walk/run speed,
// and the step that moves them through the city with building collision.
import { PLAYER, WORLD } from './constants.js';
import { moveCircle } from './collision.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    speed: 0,
    moving: false,
    health: PLAYER.health,
    money: 0,
    /** Seconds since the player last moved — the renderer idles the pose. */
    idleTime: 0,

    update(dt, input, city) {
      const v = input.moveVector();
      this.moving = v.x !== 0 || v.y !== 0;
      const target = input.is('run') ? PLAYER.runSpeed : PLAYER.walkSpeed;
      if (this.moving) {
        this.angle = Math.atan2(v.y, v.x);
        this.speed = target;
        this.idleTime = 0;
        const next = moveCircle(city, this.x, this.y, v.x * target * dt, v.y * target * dt, this.radius);
        this.x = next.x;
        this.y = next.y;
      } else {
        this.speed = 0;
        this.idleTime += dt;
      }
      // Stay inside the world, including the beach and the sea edge.
      this.x = Math.max(this.radius, Math.min(WORLD.width - this.radius, this.x));
      this.y = Math.max(this.radius, Math.min(WORLD.height - this.radius, this.y));
    },
  };
}
