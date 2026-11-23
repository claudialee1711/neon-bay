// Combat for Neon Bay v2: a pistol (mouse aim, click to fire) and a
// melee punch (F), with health, ammo, bullets, muzzle flash and pickups.
// Shooting or punching a cop raises the wanted level; shooting near
// pedestrians makes them flee. Ammo and health pickups sit at fixed
// spots and respawn after a while.
import { WORLD } from './constants.js';
import { collidesWithBuildings } from './collision.js';

const BULLET_SPEED = 980;
const BULLET_RANGE = 620;
const MELEE_RANGE = 52;
const MELEE_ARC = 1.1;

export function createCombat(city, rng) {
  const pickups = [
    { x: 1950, y: 780, kind: 'ammo', amount: 12, taken: false, timer: 0, label: 'Ammo' },
    { x: 760, y: 780, kind: 'ammo', amount: 12, taken: false, timer: 0, label: 'Ammo' },
    { x: 1320, y: 1840, kind: 'health', amount: 40, taken: false, timer: 0, label: 'Medkit' },
    { x: 3090, y: 2360, kind: 'health', amount: 40, taken: false, timer: 0, label: 'Medkit' },
  ];
  const combat = {
    bullets: [],
    pickups,
    meleeCooldown: 0,
    shootCooldown: 0,
    muzzle: 0,
    get ammo() { return combat._ammo; },
    set ammo(v) { combat._ammo = Math.max(0, Math.min(60, v)); },
    _ammo: 24,

    shoot(player, aimAngle, police, audio, effects) {
      if (combat.shootCooldown > 0 || combat._ammo <= 0 || player.inCar) return false;
      combat.shootCooldown = 0.22;
      combat._ammo -= 1;
      combat.muzzle = 0.07;
      player.angle = aimAngle;
      const bx = player.x + Math.cos(aimAngle) * 22;
      const by = player.y + Math.sin(aimAngle) * 22;
      combat.bullets.push({ x: bx, y: by, angle: aimAngle, travelled: 0 });
      if (effects) effects.burst(bx, by, 'spark', 3);
      if (audio) audio.shot();
      if (police) police.addHeat(8, 'gunshot');
      return true;
    },

    melee(player, police, pedestrians, audio, effects) {
      if (combat.meleeCooldown > 0 || player.inCar) return false;
      combat.meleeCooldown = 0.38;
      const hx = player.x + Math.cos(player.angle) * 30;
      const hy = player.y + Math.sin(player.angle) * 30;
      if (effects) effects.burst(hx, hy, 'dust', 5);
      if (audio) audio.punch();
      let hit = false;
      if (police) {
        for (let i = police.cops.length - 1; i >= 0; i -= 1) {
          const cop = police.cops[i];
          const d = Math.hypot(cop.x - player.x, cop.y - player.y);
          let da = Math.atan2(cop.y - player.y, cop.x - player.x) - player.angle;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          if (d < MELEE_RANGE && Math.abs(da) < MELEE_ARC) {
            cop.health -= 30;
            cop.x += Math.cos(player.angle) * 26;
            cop.y += Math.sin(player.angle) * 26;
            hit = true;
            if (cop.health <= 0) { police.cops.splice(i, 1); police.addHeat(14, 'cop-down'); }
          }
        }
      }
      if (pedestrians) {
        for (const ped of pedestrians.list) {
          const d = Math.hypot(ped.x - player.x, ped.y - player.y);
          if (d < MELEE_RANGE) { ped.fleeFrom(player.x, player.y); hit = true; }
        }
      }
      return hit;
    },

    update(dt, ctx) {
      const { player, police, pedestrians, effects, audio } = ctx;
      combat.meleeCooldown = Math.max(0, combat.meleeCooldown - dt);
      combat.shootCooldown = Math.max(0, combat.shootCooldown - dt);
      combat.muzzle = Math.max(0, combat.muzzle - dt);
      // Bullets fly, stop at buildings, hit cops and fleeing pedestrians.
      for (let i = combat.bullets.length - 1; i >= 0; i -= 1) {
        const b = combat.bullets[i];
        const step = BULLET_SPEED * dt;
        b.x += Math.cos(b.angle) * step;
        b.y += Math.sin(b.angle) * step;
        b.travelled += step;
        let dead = b.travelled > BULLET_RANGE || b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height;
        if (!dead && collidesWithBuildings(city, b.x, b.y, 2)) {
          dead = true;
          if (effects) effects.burst(b.x, b.y, 'spark', 4);
        }
        if (!dead && police) {
          for (let j = police.cops.length - 1; j >= 0; j -= 1) {
            const cop = police.cops[j];
            if (Math.hypot(cop.x - b.x, cop.y - b.y) < 16) {
              dead = true;
              cop.health -= 34;
              if (effects) effects.burst(b.x, b.y, 'dust', 5);
              if (cop.health <= 0) { police.cops.splice(j, 1); police.addHeat(14, 'cop-down'); }
              break;
            }
          }
        }
        if (!dead && pedestrians) {
          for (const ped of pedestrians.list) {
            if (Math.hypot(ped.x - b.x, ped.y - b.y) < 12) {
              dead = true;
              ped.fleeFrom(player.x, player.y);
              break;
            }
          }
        }
        if (dead) combat.bullets.splice(i, 1);
      }
      // Pickups: walk over one to collect it; it respawns after 25 s.
      for (const p of pickups) {
        if (p.taken) {
          p.timer -= dt;
          if (p.timer <= 0) p.taken = false;
          continue;
        }
        if (Math.hypot(player.x - p.x, player.y - p.y) < 30) {
          p.taken = true;
          p.timer = 25;
          if (p.kind === 'ammo') combat.ammo += p.amount;
          else player.health = Math.min(100, player.health + p.amount);
          if (audio) audio.pickup();
          if (effects) effects.burst(p.x, p.y, 'spark', 6);
        }
      }
    },
  };
  return combat;
}
