// Pedestrians for Neon Bay v2: people who walk the sidewalks, parks and
// plaza, wander between spots, idle, and flee from fast cars. All invented.
import { CITY, WORLD } from './constants.js';
import { collidesWithBuildings, isOnRoad } from './collision.js';

const SHIRTS = ['#d84a4a', '#4a7dd8', '#e8c33a', '#5ab06a', '#9a5ad8', '#e08a3a', '#3ab0a8', '#d8d8d8'];

function onSidewalk(city, x, y) {
  if (x < 0 || x > WORLD.width || y < 0 || y > WORLD.height) return false;
  if (collidesWithBuildings(city, x, y, 10)) return false;
  if (isOnRoad(city, x, y)) return true;
  for (const p of city.parks) if (x >= p.x && x <= p.x + p.width && y >= p.y && y <= p.y + p.height) return true;
  for (const p of city.plazas) if (x >= p.x && x <= p.x + p.width && y >= p.y && y <= p.y + p.height) return true;
  // The sidewalk band hugging a road counts as walkable.
  for (const xLine of CITY.roadsX) if (Math.abs(x - xLine) < CITY.roadWidth / 2 + CITY.sidewalk + 4) return true;
  for (const yLine of CITY.roadsY) if (Math.abs(y - yLine) < CITY.roadWidth / 2 + CITY.sidewalk + 4) return true;
  return false;
}

function pickTarget(city, rng, from) {
  for (let i = 0; i < 12; i += 1) {
    const x = from.x + rng.range(-520, 520);
    const y = from.y + rng.range(-520, 520);
    if (onSidewalk(city, x, y)) return { x, y };
  }
  return { x: from.x, y: from.y };
}

export function createPedestrians(city, rng) {
  const list = [];
  let guard = 0;
  while (list.length < 36 && guard < 400) {
    guard += 1;
    const x = rng.range(100, WORLD.width - 100);
    const y = rng.range(100, CITY.beachY - 100);
    if (!onSidewalk(city, x, y)) continue;
    list.push({
      x, y, angle: rng.range(0, Math.PI * 2), speed: rng.range(55, 92),
      colour: rng.pick(SHIRTS), state: 'walk', timer: rng.range(0, 3),
      target: null, vx: 0, vy: 0,
      fleeFrom(sx, sy) {
        const dx = this.x - sx;
        const dy = this.y - sy;
        const d = Math.hypot(dx, dy) || 1;
        this.vx = (dx / d) * 230;
        this.vy = (dy / d) * 230;
        this.angle = Math.atan2(this.vy, this.vx);
        this.state = 'flee';
        this.timer = 1.4;
      },
      knockDown(angle) {
        this.state = 'down';
        this.timer = 2.5;
        this.vx = Math.cos(angle) * 120;
        this.vy = Math.sin(angle) * 120;
      },
    });
  }
  for (const ped of list) ped.target = pickTarget(city, rng, ped);

  return {
    list,
    update(dt, city, rng) {
      for (const ped of list) {
        ped.timer -= dt;
        if (ped.state === 'down') {
          ped.x += ped.vx * dt;
          ped.y += ped.vy * dt;
          ped.vx *= 0.9;
          ped.vy *= 0.9;
          if (ped.timer <= 0) ped.fleeFrom(ped.x - ped.vx * 10 - 1, ped.y - ped.vy * 10 - 1);
          continue;
        }
        if (ped.state === 'flee') {
          const nx = ped.x + ped.vx * dt;
          const ny = ped.y + ped.vy * dt;
          if (!collidesWithBuildings(city, nx, ny, 10)) { ped.x = nx; ped.y = ny; }
          if (ped.timer <= 0) { ped.state = 'idle'; ped.timer = rng.range(0.5, 2); }
          continue;
        }
        if (ped.state === 'idle') {
          if (ped.timer <= 0) {
            ped.target = pickTarget(city, rng, ped);
            ped.state = 'walk';
          }
          continue;
        }
        // Walking toward the current target.
        const dx = ped.target.x - ped.x;
        const dy = ped.target.y - ped.y;
        const d = Math.hypot(dx, dy);
        if (d < 14) {
          ped.state = 'idle';
          ped.timer = rng.range(1, 3.5);
          continue;
        }
        ped.angle = Math.atan2(dy, dx);
        const nx = ped.x + (dx / d) * ped.speed * dt;
        const ny = ped.y + (dy / d) * ped.speed * dt;
        if (collidesWithBuildings(city, nx, ny, 10)) {
          ped.target = pickTarget(city, rng, ped);
        } else {
          ped.x = nx;
          ped.y = ny;
        }
      }
    },
  };
}
