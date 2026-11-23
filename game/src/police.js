// Wanted level and police for Neon Bay v2: heat 0–5, police cars that
// chase and ram, and foot cops who arrest the player. Heat rises from
// crimes the police can see or hear — stealing a moving car, knocking a
// pedestrian down, shooting — and cools slowly when the player is out of
// sight at low levels. Rain and dusk shorten police sight.
import { CITY, WORLD } from './constants.js';
import { moveCircle } from './collision.js';

const COP_HEALTH = 100;

function spawnPointNear(city, rng, px, py, dist) {
  for (let i = 0; i < 16; i += 1) {
    const a = rng.range(0, Math.PI * 2);
    const x = Math.max(40, Math.min(WORLD.width - 40, px + Math.cos(a) * dist));
    const y = Math.max(40, Math.min(CITY.beachY - 40, py + Math.sin(a) * dist));
    if (!city.buildingAt(x, y)) return { x, y };
  }
  return { x: Math.max(40, Math.min(WORLD.width - 40, px + dist)), y: py };
}

export function createPolice(city, rng) {
  const police = {
    level: 0,
    heat: 0,
    cars: [],
    cops: [],
    decayTimer: 0,
    arrestTimer: 0,
    pinTimer: 0,
    busted: false,
    lastKnocks: 0,
    get count() { return police.cars.length + police.cops.length; },

    addHeat(n, reason) {
      if (n <= 0) return;
      police.heat = Math.min(100, police.heat + n);
      const next = police.heat <= 0 ? 0 : police.heat < 18 ? 1 : police.heat < 38 ? 2 : police.heat < 58 ? 3 : police.heat < 80 ? 4 : 5;
      if (next > police.level) police.level = next;
    },
    clear() {
      police.level = 0;
      police.heat = 0;
      police.cars = [];
      police.cops = [];
      police.arrestTimer = 0;
      police.pinTimer = 0;
      police.busted = false;
    },

    spawnCar(player) {
      const p = spawnPointNear(city, rng, player.x, player.y, 720);
      police.cars.push({
        x: p.x, y: p.y, angle: 0, speed: 0, length: 52, width: 25,
        colour: '#1e4fa3', kind: 'police', ramCooldown: 0, flash: 0,
      });
    },
    spawnCop(player) {
      const p = spawnPointNear(city, rng, player.x, player.y, 420);
      police.cops.push({
        x: p.x, y: p.y, angle: 0, speed: 0, health: COP_HEALTH,
        state: 'chase', timer: 0, punchCooldown: 0,
      });
    },

    update(dt, ctx) {
      const { player, vehicles, pedestrians, weather, effects, audio } = ctx;
      // Consume crime hooks: stealing a moving traffic car, ped knockdowns.
      if (vehicles && vehicles.stoleTraffic) {
        vehicles.stoleTraffic = false;
        police.addHeat(22, 'stole-traffic');
        if (audio) audio.sirenBlip();
      }
      if (vehicles && typeof vehicles.pedKnocks === 'number' && vehicles.pedKnocks !== police.lastKnocks) {
        const fresh = vehicles.pedKnocks - police.lastKnocks;
        police.lastKnocks = vehicles.pedKnocks;
        police.addHeat(12 * fresh, 'hit-pedestrian');
      }
      // Wanted force matches the level: cars up to 3, cops up to 4.
      const wantCars = police.level === 0 ? 0 : Math.min(3, 1 + Math.floor(police.level / 2));
      const wantCops = police.level === 0 ? 0 : Math.min(4, police.level);
      while (police.cars.length < wantCars) police.spawnCar(player);
      while (police.cops.length < wantCops) police.spawnCop(player);
      if (police.level === 0) { police.cars = []; police.cops = []; }

      // Sight range shrinks in rain and at dusk.
      const sight = (weather ? 900 : 900) * (1 - 0.25 * (weather ? weather.wet : 0)) * (1 - 0.2 * (weather ? weather.dark : 0));
      let anyNear = false;
      for (const car of police.cars) {
        const d = Math.hypot(player.x - car.x, player.y - car.y);
        if (d < sight) anyNear = true;
        const wantAngle = Math.atan2(player.y - car.y, player.x - car.x);
        let diff = wantAngle - car.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const targetSpeed = 430 + police.level * 45;
        car.speed += Math.sign(targetSpeed - car.speed) * Math.min(Math.abs(targetSpeed - car.speed), 420 * dt);
        car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff * 2.2 * dt));
        const nx = car.x + Math.cos(car.angle) * car.speed * dt;
        const ny = car.y + Math.sin(car.angle) * car.speed * dt;
        const moved = vehicles ? vehicles.moveCar(city, car, nx, ny) : false;
        if (moved) car.speed *= 0.5;
        car.x = Math.max(24, Math.min(WORLD.width - 24, car.x));
        car.y = Math.max(24, Math.min(WORLD.height - 24, car.y));
        car.flash += dt;
        car.ramCooldown = Math.max(0, car.ramCooldown - dt);
        // Ram: hit the player's car or the player on foot.
        if (d < 62 && car.ramCooldown <= 0) {
          car.ramCooldown = 1.1;
          if (player.inCar && vehicles && vehicles.playerCar) {
            vehicles.playerCar.speed *= 0.55;
            player.health = Math.max(0, player.health - 6);
          } else {
            player.health = Math.max(0, player.health - 9);
            const push = 26;
            player.x += Math.cos(car.angle) * push;
            player.y += Math.sin(car.angle) * push;
          }
          if (effects) effects.burst(player.x, player.y, 'spark', 8);
          if (audio) audio.punch();
        }
      }
      // Foot cops chase on foot and arrest at close range.
      let arresting = false;
      for (const cop of police.cops) {
        const d = Math.hypot(player.x - cop.x, player.y - cop.y);
        if (d < sight) anyNear = true;
        cop.angle = Math.atan2(player.y - cop.y, player.x - cop.x);
        const speed = 265 + police.level * 12;
        const step = moveCircle(city, cop.x, cop.y, Math.cos(cop.angle) * speed * dt, Math.sin(cop.angle) * speed * dt, 12);
        cop.x = step.x;
        cop.y = step.y;
        cop.punchCooldown = Math.max(0, cop.punchCooldown - dt);
        if (d < 34 && !player.inCar) {
          arresting = true;
          if (cop.punchCooldown <= 0) {
            cop.punchCooldown = 0.9;
            player.health = Math.max(0, player.health - 5);
            if (audio) audio.punch();
          }
        }
      }
      police.arrestTimer = arresting ? police.arrestTimer + dt : 0;
      // Pinned by a police car at low speed while driving also busts.
      const pinned = player.inCar && vehicles && vehicles.playerCar
        && Math.abs(vehicles.playerCar.speed) < 25
        && police.cars.some((c) => Math.hypot(player.x - c.x, player.y - c.y) < 70);
      police.pinTimer = pinned ? police.pinTimer + dt : 0;
      if (police.arrestTimer > 1.1 || police.pinTimer > 1.6) police.busted = true;

      // Cool down: no police near for a while, heat drains (faster at low levels).
      if (police.level > 0) {
        if (!anyNear) {
          police.decayTimer += dt;
          if (police.decayTimer > 7) {
            police.heat = Math.max(0, police.heat - dt * (police.level <= 2 ? 6 : 2.5));
            if (police.heat <= 0) police.clear();
            else police.level = police.heat < 18 ? 1 : police.heat < 38 ? 2 : police.heat < 58 ? 3 : police.heat < 80 ? 4 : 5;
          }
        } else police.decayTimer = 0;
      }
      // Drop surplus units when the level falls.
      while (police.cars.length > wantCars) police.cars.pop();
      while (police.cops.length > wantCops) police.cops.pop();
    },
  };
  return police;
}
