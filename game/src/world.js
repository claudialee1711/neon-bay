// Neon Bay's rules and state, with no drawing and no browser in it: the player
// (on foot or in a car), traffic, pedestrians, police, missions, combat, money,
// the wanted level and the clock. step() advances one fixed step and returns what
// happened as bit flags, so the caller can react (sounds, screens) without the
// world knowing about them. Nothing here allocates after createWorld returns.

import {
  CAR, CITY, CLOCK, CRIME, MONEY, PEDESTRIANS, PLAYER, POLICE, TRAFFIC, WEAPON, WORLD,
} from './config.js';
import { buildCity } from './city.js';
import {
  MISSION_COUNT, STAGE_DELIVER, STAGE_ELIMINATE, STAGE_ESCAPE, STAGE_GOTO,
  STAGE_HOLD, STAGE_PICKUP, STAGE_STEAL_CAR, missionAt,
} from './missions.js';

export const EVENT_SHOT = 1;
export const EVENT_PICKUP = 2;
export const EVENT_CRASH = 4;
export const EVENT_WANTED_UP = 8;
export const EVENT_MISSION_DONE = 16;
export const EVENT_MISSION_FAIL = 32;
export const EVENT_BUSTED = 64;
export const EVENT_WASTED = 128;
export const EVENT_CARJACK = 256;
export const EVENT_ENEMY_DOWN = 512;

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Push a circle out of a rectangle; returns true when they overlapped. */
function pushOutOfRect(circle, r, radius) {
  const nx = clamp(circle.x, r.x, r.x + r.width);
  const ny = clamp(circle.y, r.y, r.y + r.height);
  const dx = circle.x - nx;
  const dy = circle.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return false;
  if (d2 === 0) {
    circle.y = r.y - radius;
    return true;
  }
  const d = Math.sqrt(d2);
  circle.x = nx + (dx / d) * radius;
  circle.y = ny + (dy / d) * radius;
  return true;
}

function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
}

export function createWorld(random) {
  const city = buildCity(random);
  const state = {
    city,
    player: {
      x: city.playerStart.x, y: city.playerStart.y, angle: -Math.PI / 2,
      health: PLAYER.health, ammo: PLAYER.startAmmo, money: MONEY.start,
      inCar: null, speed: 0, invulnerable: 0, moving: false,
    },
    cars: [],
    pedestrians: [],
    footCops: [],
    enemies: [],
    pickups: [],
    particles: [],
    skids: [],
    wantedHeat: 0,
    stars: 0,
    clock: CLOCK.startHour,
    missionIndex: 0,
    stageIndex: 0,
    stageTimer: 0,
    stageCount: 0,
    stageHold: 0,
    missionDone: false,
    storyDone: false,
    elapsed: 0,
    shake: 0,
    carsStolen: 0,
    kills: 0,
    crewAboard: false,
    packageHeld: false,
    cashHeld: false,
    hideTimer: 0,
    saveTimer: 0,
    arrestTarget: null,
  };

  let carId = 0;

  function makeCar(x, y, angle, kind, color, route) {
    const car = {
      id: carId += 1, x, y, angle, speed: 0, color, kind,
      health: CAR.health, route: route || null, routeIndex: 0,
      waitTimer: 0, dead: false, driver: kind !== 'parked',
    };
    return car;
  }

  function resetTraffic() {
    state.cars.length = 0;
    carId = 0;
    const spots = city.parkingSpots();
    for (let i = 0; i < 14 && i < spots.length; i += 1) {
      const s = spots[Math.floor(random() * spots.length)];
      state.cars.push(makeCar(s.x, s.y, s.angle, 'parked', ['#c8cdd4', '#8a94a6', '#b03030', '#3060b0', '#3f8a4f', '#c9a13b'][i % 6], null));
    }
    for (let i = 0; i < TRAFFIC.count; i += 1) {
      const p = city.randomRoadPoint();
      const route = city.routes[i % city.routes.length];
      const car = makeCar(p.x, p.y, random() * TAU, 'traffic', ['#c8cdd4', '#8a94a6', '#b03030', '#3060b0', '#3f8a4f', '#c9a13b', '#7a4a8a', '#d06a2a'][i % 8], route);
      car.speed = TRAFFIC.speed * (0.8 + random() * 0.4);
      state.cars.push(car);
    }
  }

  function resetPedestrians() {
    state.pedestrians.length = 0;
    for (let i = 0; i < PEDESTRIANS.count; i += 1) {
      const p = city.randomRoadPoint();
      state.pedestrians.push({
        x: p.x + (random() - 0.5) * 60, y: p.y + (random() - 0.5) * 60,
        angle: random() * TAU, speed: PEDESTRIANS.walkSpeed * (0.8 + random() * 0.4),
        state: 'walk', stateTimer: 2 + random() * 6, down: 0,
        color: ['#e8e2d4', '#c9a13b', '#7a4a8a', '#3f8a4f', '#b03030', '#3060b0'][i % 6],
      });
    }
  }

  function spawnPickup(kind, x, y, amount) {
    state.pickups.push({ kind, x, y, amount: amount || 0, bob: random() * TAU });
  }

  function resetPickups() {
    state.pickups.length = 0;
    spawnPickup('health', city.spots.hospital.x + 60, city.spots.hospital.y + 40, 40);
    spawnPickup('health', city.spots.hospital.x - 60, city.spots.hospital.y - 40, 40);
    spawnPickup('ammo', city.spots.gunstore.x + 50, city.spots.gunstore.y + 30, 48);
    spawnPickup('ammo', city.spots.gunstore.x - 50, city.spots.gunstore.y - 30, 48);
    spawnPickup('money', city.spots.club.x + 40, city.spots.club.y - 50, 50);
  }

  function starsFor(heat) {
    let stars = 0;
    for (let i = 1; i <= 5; i += 1) if (heat >= POLICE.starHeat[i]) stars = i;
    return stars;
  }

  function addCrime(amount) {
    const before = state.stars;
    state.wantedHeat = clamp(state.wantedHeat + amount, 0, 100);
    state.stars = starsFor(state.wantedHeat);
    return state.stars > before ? EVENT_WANTED_UP : 0;
  }

  function addParticles(x, y, count, color, speed) {
    for (let i = 0; i < count; i += 1) {
      if (state.particles.length > 320) return;
      const a = random() * TAU;
      const s = speed * (0.4 + random() * 0.8);
      state.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.4 + random() * 0.5, maxLife: 0.9, color, size: 2 + random() * 4,
      });
    }
  }

  function burst(x, y, color) {
    addParticles(x, y, 18, color, 260);
  }

  function explodeCar(car) {
    car.dead = true;
    burst(car.x, car.y, '#ff8a3c');
    burst(car.x, car.y, '#3a3a3a');
    state.shake = Math.max(state.shake, 14);
    if (state.player.inCar === car) {
      state.player.inCar = null;
      state.player.x = car.x + 40;
      state.player.y = car.y;
      state.player.health = Math.max(1, state.player.health - 20);
    }
  }

  function nearestCar(x, y, maxDist, kinds) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of state.cars) {
      if (car.dead || (kinds && !kinds.includes(car.kind))) continue;
      const d = dist2(x, y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function spawnCopCar() {
    const p = city.randomRoadPoint();
    const car = makeCar(p.x, p.y, random() * TAU, 'police', '#2f6fd0', null);
    car.speed = POLICE.carSpeed * 0.7;
    state.cars.push(car);
    return car;
  }

  function spawnFootCop() {
    const p = city.randomRoadPoint();
    state.footCops.push({
      x: p.x, y: p.y, angle: random() * TAU, health: 50,
      arrest: 0, shootTimer: 1 + random(), dead: false,
    });
  }

  function spawnEnemies(count, spot) {
    for (let i = 0; i < count; i += 1) {
      state.enemies.push({
        x: spot.x + (random() - 0.5) * 220, y: spot.y + (random() - 0.5) * 220,
        angle: random() * TAU, health: 60, shootTimer: 0.5 + random() * 1.5, dead: false,
      });
    }
  }

  function currentMission() {
    return missionAt(state.missionIndex);
  }

  function currentStage() {
    const mission = currentMission();
    if (!mission) return null;
    return mission.stages[state.stageIndex] || null;
  }

  function missionSpot() {
    const stage = currentStage();
    if (!stage || !stage.spot) return null;
    return state.city.spots[stage.spot];
  }

  function advanceStage() {
    const mission = currentMission();
    state.stageIndex += 1;
    state.stageTimer = 0;
    state.stageCount = 0;
    state.stageHold = 0;
    if (state.stageIndex >= mission.stages.length) {
      state.player.money += mission.reward;
      state.missionIndex += 1;
      state.stageIndex = 0;
      state.packageHeld = false;
      state.cashHeld = false;
      state.crewAboard = false;
      if (state.missionIndex >= MISSION_COUNT) {
        state.storyDone = true;
        state.missionDone = true;
      }
      return EVENT_MISSION_DONE;
    }
    return 0;
  }

  function failMission() {
    state.stageIndex = 0;
    state.stageTimer = 0;
    state.stageCount = 0;
    state.stageHold = 0;
    state.packageHeld = false;
    state.cashHeld = false;
    state.crewAboard = false;
    return EVENT_MISSION_FAIL;
  }

  function startStageSideEffects(stage) {
    if (!stage) return;
    if (stage.wanted) {
      state.wantedHeat = Math.max(state.wantedHeat, POLICE.starHeat[stage.wanted]);
      state.stars = starsFor(state.wantedHeat);
    }
    if (stage.type === STAGE_ELIMINATE) spawnEnemies(stage.count, state.city.spots[stage.spot]);
    if (stage.type === STAGE_DELIVER) state.stageTimer = stage.time;
  }

  function reset(newGame) {
    const keep = newGame ? null : {
      money: state.player.money, missionIndex: state.missionIndex,
      carsStolen: state.carsStolen, kills: state.kills,
    };
    state.player.x = city.playerStart.x;
    state.player.y = city.playerStart.y;
    state.player.angle = -Math.PI / 2;
    state.player.health = PLAYER.health;
    state.player.ammo = PLAYER.startAmmo;
    state.player.money = keep ? keep.money : MONEY.start;
    state.player.inCar = null;
    state.player.speed = 0;
    state.player.invulnerable = 0;
    state.wantedHeat = 0;
    state.stars = 0;
    state.clock = CLOCK.startHour;
    state.missionIndex = keep ? keep.missionIndex : 0;
    state.stageIndex = 0;
    state.stageTimer = 0;
    state.stageCount = 0;
    state.stageHold = 0;
    state.missionDone = false;
    state.storyDone = false;
    state.elapsed = 0;
    state.shake = 0;
    state.carsStolen = keep ? keep.carsStolen : 0;
    state.kills = keep ? keep.kills : 0;
    state.crewAboard = false;
    state.packageHeld = false;
    state.cashHeld = false;
    state.hideTimer = 0;
    state.footCops.length = 0;
    state.enemies.length = 0;
    state.particles.length = 0;
    state.skids.length = 0;
    resetTraffic();
    resetPedestrians();
    resetPickups();
  }

  function onRoad(x, y) {
    for (const r of state.city.roads) if (pointInRect(x, y, r)) return true;
    return false;
  }

  function collideBuildingsCircle(obj, radius) {
    for (const b of state.city.buildings) {
      if (obj.x < b.x - radius || obj.x > b.x + b.width + radius || obj.y < b.y - radius || obj.y > b.y + b.height + radius) continue;
      pushOutOfRect(obj, b, radius);
    }
    obj.x = clamp(obj.x, 20, WORLD.width - 20);
    obj.y = clamp(obj.y, 20, WORLD.height - 20);
  }

  function stepPlayerOnFoot(dt, input) {
    const p = state.player;
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    p.moving = len > 0;
    if (len > 0) {
      mx /= len; my /= len;
      const speed = PLAYER.walkSpeed;
      p.x += mx * speed * dt;
      p.y += my * speed * dt;
      p.angle = Math.atan2(my, mx);
    }
    collideBuildingsCircle(p, PLAYER.radius);
    if (p.invulnerable > 0) p.invulnerable = Math.max(0, p.invulnerable - dt);
    if (p.health < PLAYER.health && state.stars === 0) p.health = Math.min(PLAYER.health, p.health + PLAYER.regen * dt);
  }

  function stepPlayerCar(dt, input) {
    const p = state.player;
    const car = p.inCar;
    if (!car) return;
    const forward = input.up ? 1 : 0;
    const reverse = input.down ? 1 : 0;
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const onRoadNow = onRoad(car.x, car.y);
    const topSpeed = onRoadNow ? CAR.maxSpeed : CAR.maxSpeed * 0.55;
    if (forward) car.speed += CAR.accel * dt;
    if (reverse) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
    if (!forward && !reverse) car.speed -= Math.sign(car.speed) * CAR.drag * 220 * dt;
    if (Math.abs(car.speed) < 8 && !forward && !reverse) car.speed = 0;
    car.speed = clamp(car.speed, -CAR.maxReverse, topSpeed);
    const steerAmount = steer * CAR.steer * clamp(Math.abs(car.speed) / 260, 0, 1) * (car.speed >= 0 ? 1 : -1);
    car.angle += steerAmount * dt;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    car.x = nx;
    car.y = ny;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = car.speed;
    // Skid marks on hard turns at speed.
    if (Math.abs(steer) > 0 && Math.abs(car.speed) > CAR.skidSpeed) {
      const bx = car.x - Math.cos(car.angle) * 20;
      const by = car.y - Math.sin(car.angle) * 20;
      state.skids.push({ x: bx, y: by, angle: car.angle, life: 6 });
      if (state.skids.length > 400) state.skids.shift();
    }
    // Building collision: stop and spark.
    let hit = false;
    for (const b of state.city.buildings) {
      if (car.x < b.x - 22 || car.x > b.x + b.width + 22 || car.y < b.y - 22 || car.y > b.y + b.height + 22) continue;
      const before = { x: car.x, y: car.y };
      pushOutOfRect(car, b, 22);
      if (car.x !== before.x || car.y !== before.y) hit = true;
    }
    car.x = clamp(car.x, 24, WORLD.width - 24);
    car.y = clamp(car.y, 24, WORLD.height - 24);
    if (hit && Math.abs(car.speed) > 120) {
      const impact = Math.abs(car.speed);
      car.speed *= 0.35;
      car.health -= impact * 0.06;
      addParticles(car.x, car.y, 8, '#ffd76a', 200);
      state.shake = Math.max(state.shake, 6);
      if (car.health <= 0) explodeCar(car);
      return EVENT_CRASH;
    }
    if (car.health < 40 && random() < dt * 6) {
      addParticles(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 1, '#5a5a5a', 40);
    }
    return 0;
  }

  function stepTrafficCar(dt, car) {
    if (car.kind !== 'traffic' || car.dead) return;
    if (!car.route || car.route.length === 0) return;
    const target = car.route[car.routeIndex];
    const dx = target.x - car.x;
    const dy = target.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d < 40) {
      car.routeIndex = (car.routeIndex + 1) % car.route.length;
      return;
    }
    const want = Math.atan2(dy, dx);
    car.angle += clamp(angleDiff(car.angle, want), -1.8 * dt, 1.8 * dt);
    // Slow for the car ahead.
    let blocked = false;
    for (const other of state.cars) {
      if (other === car || other.dead) continue;
      const odx = other.x - car.x;
      const ody = other.y - car.y;
      const od = Math.hypot(odx, ody);
      if (od < TRAFFIC.followGap && Math.abs(angleDiff(car.angle, Math.atan2(ody, odx))) < 0.6) { blocked = true; break; }
    }
    const targetSpeed = blocked ? 0 : TRAFFIC.speed;
    car.speed += clamp(targetSpeed - car.speed, -300 * dt, 200 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    for (const b of state.city.buildings) {
      if (car.x < b.x - 20 || car.x > b.x + b.width + 20 || car.y < b.y - 20 || car.y > b.y + b.height + 20) continue;
      pushOutOfRect(car, b, 20);
      car.angle += Math.PI / 2;
    }
  }

  function stepPoliceCar(dt, car) {
    if (car.kind !== 'police' || car.dead) return 0;
    const p = state.player;
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d > POLICE.despawnRange) { car.dead = true; return 0; }
    const want = Math.atan2(dy, dx);
    car.angle += clamp(angleDiff(car.angle, want), -2.4 * dt, 2.4 * dt);
    const targetSpeed = d > 120 ? POLICE.carSpeed : POLICE.carSpeed * 0.55;
    car.speed += clamp(targetSpeed - car.speed, -400 * dt, 320 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    for (const b of state.city.buildings) {
      if (car.x < b.x - 20 || car.x > b.x + b.width + 20 || car.y < b.y - 20 || car.y > b.y + b.height + 20) continue;
      pushOutOfRect(car, b, 20);
      car.angle += Math.PI / 3;
    }
    // Ram the player's car.
    if (p.inCar && d < 46) {
      p.inCar.health -= 6;
      p.inCar.speed *= 0.7;
      state.shake = Math.max(state.shake, 5);
      addParticles(car.x, car.y, 6, '#ffd76a', 160);
      if (p.inCar.health <= 0) explodeCar(p.inCar);
      return EVENT_CRASH;
    }
    return 0;
  }

  function stepPedestrian(dt, ped) {
    if (ped.down > 0) {
      ped.down -= dt;
      return;
    }
    if (ped.state === 'flee') {
      ped.stateTimer -= dt;
      ped.x += Math.cos(ped.angle) * PEDESTRIANS.fleeSpeed * dt;
      ped.y += Math.sin(ped.angle) * PEDESTRIANS.fleeSpeed * dt;
      if (ped.stateTimer <= 0) ped.state = 'walk';
    } else {
      ped.stateTimer -= dt;
      if (ped.stateTimer <= 0) {
        ped.angle = random() * TAU;
        ped.stateTimer = 2 + random() * 6;
      }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    // Stay on the sidewalks: bounce off buildings and out of the sea.
    let bounced = false;
    for (const b of state.city.buildings) {
      if (ped.x > b.x - 12 && ped.x < b.x + b.width + 12 && ped.y > b.y - 12 && ped.y < b.y + b.height + 12) {
        ped.angle += Math.PI / 2;
        bounced = true;
        break;
      }
    }
    if (ped.y > CITY.beachY + 30 || ped.x < 10 || ped.x > WORLD.width - 10 || ped.y < 10) {
      ped.angle += Math.PI;
      bounced = true;
    }
    if (bounced) {
      ped.x = clamp(ped.x, 14, WORLD.width - 14);
      ped.y = clamp(ped.y, 14, WORLD.height - 14);
    }
  }

  function fleeFrom(x, y, radius) {
    for (const ped of state.pedestrians) {
      if (ped.down > 0) continue;
      const d = Math.hypot(ped.x - x, ped.y - y);
      if (d < radius) {
        ped.state = 'flee';
        ped.angle = Math.atan2(ped.y - y, ped.x - x);
        ped.stateTimer = 3;
      }
    }
  }

  function stepFootCop(dt, cop) {
    if (cop.dead) return 0;
    const p = state.player;
    const dx = p.x - cop.x;
    const dy = p.y - cop.y;
    const d = Math.hypot(dx, dy);
    if (d > POLICE.despawnRange) { cop.dead = true; return 0; }
    cop.angle = Math.atan2(dy, dx);
    if (d > 34) {
      cop.x += Math.cos(cop.angle) * POLICE.footSpeed * dt;
      cop.y += Math.sin(cop.angle) * POLICE.footSpeed * dt;
      cop.arrest = 0;
    } else if (!p.inCar && Math.abs(p.speed) < 60) {
      cop.arrest += dt;
      if (cop.arrest >= POLICE.arrestTime) return EVENT_BUSTED;
    }
    // Cops open fire at 3 stars and up.
    if (state.stars >= 3 && d < 420 && d > 60) {
      cop.shootTimer -= dt;
      if (cop.shootTimer <= 0) {
        cop.shootTimer = 0.9 + random() * 0.7;
        if (random() < 0.3 && p.invulnerable === 0) {
          p.health -= 6;
          p.invulnerable = 0.3;
          if (p.health <= 0) return EVENT_WASTED;
        }
      }
    }
    for (const b of state.city.buildings) {
      if (cop.x > b.x - 12 && cop.x < b.x + b.width + 12 && cop.y > b.y - 12 && cop.y < b.y + b.height + 12) {
        pushOutOfRect(cop, b, 12);
      }
    }
    return 0;
  }

  function stepEnemy(dt, enemy) {
    if (enemy.dead) return 0;
    const p = state.player;
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const d = Math.hypot(dx, dy);
    enemy.angle = Math.atan2(dy, dx);
    if (d > 260) {
      enemy.x += Math.cos(enemy.angle) * 120 * dt;
      enemy.y += Math.sin(enemy.angle) * 120 * dt;
    } else {
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0) {
        enemy.shootTimer = 0.8 + random() * 0.8;
        if (random() < 0.35 && p.invulnerable === 0) {
          p.health -= 8;
          p.invulnerable = 0.3;
          if (p.health <= 0) return EVENT_WASTED;
        }
      }
    }
    return 0;
  }

  function shootAt(tx, ty) {
    const p = state.player;
    if (p.ammo <= 0) return 0;
    p.ammo -= 1;
    const angle = Math.atan2(ty - p.y, tx - p.x) + (random() - 0.5) * WEAPON.spread;
    const mx = p.x + Math.cos(angle) * 14;
    const my = p.y + Math.sin(angle) * 14;
    addParticles(mx, my, 4, '#ffd76a', 180);
    let events = EVENT_SHOT;
    // Hit an enemy, a cop or a pedestrian along the shot.
    const targets = [];
    for (const e of state.enemies) if (!e.dead) targets.push({ x: e.x, y: e.y, r: 14, kind: 'enemy', ref: e });
    for (const c of state.footCops) if (!c.dead) targets.push({ x: c.x, y: c.y, r: 13, kind: 'cop', ref: c });
    for (const ped of state.pedestrians) if (ped.down <= 0) targets.push({ x: ped.x, y: ped.y, r: 12, kind: 'ped', ref: ped });
    let best = null;
    let bestD = WEAPON.range;
    for (const t of targets) {
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      const along = dx * Math.cos(angle) + dy * Math.sin(angle);
      if (along < 0 || along > WEAPON.range) continue;
      const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
      if (perp < t.r + 4 && along < bestD) { bestD = along; best = t; }
    }
    if (best) {
      burst(best.x, best.y, '#ff5a5a');
      if (best.kind === 'enemy') {
        best.ref.health -= WEAPON.damage;
        if (best.ref.health <= 0) {
          best.ref.dead = true;
          state.kills += 1;
          state.stageCount += 1;
          spawnPickup('money', best.x, best.y, 25 + Math.floor(random() * 40));
          events |= EVENT_ENEMY_DOWN;
        }
      } else if (best.kind === 'cop') {
        best.ref.health -= WEAPON.damage;
        if (best.ref.health <= 0) {
          best.ref.dead = true;
          state.kills += 1;
          events |= addCrime(CRIME.killCop) | EVENT_ENEMY_DOWN;
        }
      } else {
        best.ref.down = 4;
        fleeFrom(best.x, best.y, 240);
        events |= addCrime(CRIME.hitPedestrian);
      }
    }
    return events;
  }

  function tryEnterCar() {
    const p = state.player;
    if (p.inCar) {
      if (Math.abs(p.inCar.speed) < 60) {
        const car = p.inCar;
        p.inCar = null;
        p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
        p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
        p.speed = 0;
      }
      return 0;
    }
    const car = nearestCar(p.x, p.y, 64, ['parked', 'traffic', 'police']);
    if (!car) return 0;
    if (car.kind === 'parked') {
      car.kind = 'player';
      car.driver = false;
      p.inCar = car;
      state.carsStolen += 1;
      return addCrime(CRIME.stealParked);
    }
    if (Math.abs(car.speed) < 140) {
      car.kind = 'player';
      if (car.driver) {
        state.pedestrians.push({
          x: car.x + 30, y: car.y + 30, angle: random() * TAU,
          speed: PEDESTRIANS.fleeSpeed, state: 'flee', stateTimer: 3, down: 0, color: '#e8e2d4',
        });
        car.driver = false;
      }
      p.inCar = car;
      state.carsStolen += 1;
      return addCrime(CRIME.carjack) | EVENT_CARJACK;
    }
    return 0;
  }

  function tryCarjack() {
    const p = state.player;
    if (p.inCar) return 0;
    const car = nearestCar(p.x, p.y, 76, ['traffic', 'police']);
    if (!car) return 0;
    car.kind = 'player';
    if (car.driver) {
      state.pedestrians.push({
        x: car.x + 30, y: car.y + 30, angle: random() * TAU,
        speed: PEDESTRIANS.fleeSpeed, state: 'flee', stateTimer: 3, down: 0, color: '#e8e2d4',
      });
      car.driver = false;
    }
    p.inCar = car;
    state.carsStolen += 1;
    return addCrime(CRIME.carjack) | EVENT_CARJACK;
  }

  function stepCollisions(dt) {
    let events = 0;
    const p = state.player;
    // Player car vs other cars. The player's car is captured up front: it can
    // explode mid-loop, and nothing below may touch it once it has.
    if (p.inCar && !p.inCar.dead) {
      const myCar = p.inCar;
      for (const other of state.cars) {
        if (other === myCar || other.dead) continue;
        const d = Math.hypot(other.x - myCar.x, other.y - myCar.y);
        if (d < 44 && d > 0.01) {
          const push = (44 - d) / 2;
          const nx = (other.x - myCar.x) / d;
          const ny = (other.y - myCar.y) / d;
          myCar.x -= nx * push;
          myCar.y -= ny * push;
          other.x += nx * push;
          other.y += ny * push;
          const impact = Math.abs(myCar.speed - other.speed);
          if (impact > 180) {
            myCar.health -= impact * 0.04;
            other.health -= impact * 0.05;
            addParticles(myCar.x, myCar.y, 6, '#ffd76a', 160);
            state.shake = Math.max(state.shake, 4);
            events |= EVENT_CRASH;
            if (other.kind === 'police') events |= addCrime(4);
            if (myCar.health <= 0) explodeCar(myCar);
            if (other.health <= 0 && other.kind !== 'player') explodeCar(other);
          }
          if (!myCar.dead) myCar.speed *= 0.92;
          if (other.kind === 'traffic') other.speed *= 0.6;
          if (myCar.dead) break;
        }
      }
      // Running over pedestrians.
      if (p.inCar && !p.inCar.dead) {
        for (const ped of state.pedestrians) {
          if (ped.down > 0) continue;
          const d = Math.hypot(ped.x - p.inCar.x, ped.y - p.inCar.y);
          if (d < 30 && Math.abs(p.inCar.speed) > 60) {
            ped.down = 4;
            fleeFrom(ped.x, ped.y, 240);
            p.inCar.speed *= 0.8;
            state.shake = Math.max(state.shake, 5);
            events |= addCrime(CRIME.hitPedestrian);
          }
        }
      }
    }
    return events;
  }

  function stepPickups() {
    const p = state.player;
    let events = 0;
    for (const pk of state.pickups) {
      const d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (d < 34) {
        pk.taken = true;
        if (pk.kind === 'health') p.health = Math.min(PLAYER.health, p.health + pk.amount);
        else if (pk.kind === 'ammo') p.ammo = Math.min(PLAYER.maxAmmo, p.ammo + pk.amount);
        else if (pk.kind === 'money') p.money += pk.amount;
        events |= EVENT_PICKUP;
      }
    }
    state.pickups = state.pickups.filter((pk) => !pk.taken);
    return events;
  }

  function stepWanted(dt) {
    // Count the cops close enough to see the player.
    let near = 0;
    for (const car of state.cars) {
      if (car.kind === 'police' && !car.dead && Math.hypot(car.x - state.player.x, car.y - state.player.y) < POLICE.sightRange) near += 1;
    }
    for (const cop of state.footCops) {
      if (!cop.dead && Math.hypot(cop.x - state.player.x, cop.y - state.player.y) < POLICE.sightRange) near += 1;
    }
    if (near === 0) {
      state.hideTimer += dt;
      if (state.hideTimer > 3) {
        state.wantedHeat = Math.max(0, state.wantedHeat - POLICE.decay * dt);
        state.stars = starsFor(state.wantedHeat);
      }
    } else {
      state.hideTimer = 0;
    }
    // Keep the right number of police around, by stars.
    const wantCars = POLICE.maxCopCars[state.stars];
    const wantFoot = POLICE.maxFootCops[state.stars];
    let haveCars = 0;
    for (const car of state.cars) if (car.kind === 'police' && !car.dead) haveCars += 1;
    let haveFoot = 0;
    for (const cop of state.footCops) if (!cop.dead) haveFoot += 1;
    if (haveCars < wantCars && random() < dt * 2) spawnCopCar();
    if (haveFoot < wantFoot && random() < dt * 2) spawnFootCop();
  }

  function stepMission(dt, input) {
    const mission = currentMission();
    if (!mission) return 0;
    const stage = currentStage();
    if (!stage) return 0;
    const p = state.player;
    const spot = stage.spot ? state.city.spots[stage.spot] : null;
    const nearSpot = (radius) => spot && Math.hypot(p.x - spot.x, p.y - spot.y) < radius;
    let events = 0;
    if (stage.type === STAGE_STEAL_CAR) {
      if (p.inCar) {
        events |= advanceStage();
        startStageSideEffects(currentStage());
      }
    } else if (stage.type === STAGE_GOTO) {
      if (nearSpot(80)) {
        events |= advanceStage();
        startStageSideEffects(currentStage());
      }
    } else if (stage.type === STAGE_PICKUP) {
      if (nearSpot(80)) {
        if (mission.id === 'getaway') state.crewAboard = true;
        else state.packageHeld = true;
        events |= advanceStage();
        startStageSideEffects(currentStage());
      }
    } else if (stage.type === STAGE_DELIVER) {
      state.stageTimer -= dt;
      if (nearSpot(80)) {
        events |= advanceStage();
        startStageSideEffects(currentStage());
      } else if (state.stageTimer <= 0) {
        events |= failMission();
      }
    } else if (stage.type === STAGE_ELIMINATE) {
      if (state.stageCount >= stage.count) {
        events |= advanceStage();
        startStageSideEffects(currentStage());
      }
    } else if (stage.type === STAGE_HOLD) {
      if (nearSpot(70) && input.interact) {
        state.stageHold += dt;
        if (state.stageHold >= stage.hold) {
          state.cashHeld = true;
          events |= advanceStage();
          startStageSideEffects(currentStage());
        }
      } else {
        state.stageHold = Math.max(0, state.stageHold - dt);
      }
    } else if (stage.type === STAGE_ESCAPE) {
      if (nearSpot(90)) {
        events |= advanceStage();
        startStageSideEffects(currentStage());
      }
    }
    return events;
  }

  /**
   * One fixed step. `input` carries the held keys, the aim point in world
   * coordinates, and one-shot actions already consumed by the caller. Returns
   * EVENT_* flags for sounds and screens.
   */
  function step(dt, input) {
    let events = 0;
    state.elapsed += dt;
    state.clock = (CLOCK.startHour + state.elapsed / CLOCK.secondsPerHour) % 24;
    state.saveTimer += dt;

    if (input.enter) events |= tryEnterCar();
    if (input.carjack) events |= tryCarjack();

    if (state.player.inCar) events |= stepPlayerCar(dt, input) || 0;
    else stepPlayerOnFoot(dt, input);

    for (const car of state.cars) {
      if (car.dead) continue;
      if (car.kind === 'traffic') stepTrafficCar(dt, car);
      else if (car.kind === 'police') events |= stepPoliceCar(dt, car) || 0;
    }
    state.cars = state.cars.filter((c) => !c.dead || c === state.player.inCar);
    for (const ped of state.pedestrians) stepPedestrian(dt, ped);
    for (const cop of state.footCops) events |= stepFootCop(dt, cop) || 0;
    state.footCops = state.footCops.filter((c) => !c.dead);
    for (const enemy of state.enemies) events |= stepEnemy(dt, enemy) || 0;
    state.enemies = state.enemies.filter((e) => !e.dead);

    events |= stepCollisions(dt) || 0;
    events |= stepPickups() || 0;
    stepWanted(dt);

    // Shooting (on foot only; driving uses the car).
    if (input.shoot && !state.player.inCar) {
      state.shootTimer = (state.shootTimer || 0) - dt;
      if (state.shootTimer <= 0) {
        state.shootTimer = WEAPON.fireInterval;
        events |= shootAt(input.aimX, input.aimY) || 0;
        if (state.player.ammo > 0) fleeFrom(state.player.x, state.player.y, 200);
      }
    } else {
      state.shootTimer = 0;
    }

    events |= stepMission(dt, input) || 0;

    // Particles and skid marks age out.
    for (const pt of state.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
      pt.life -= dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
    for (const sk of state.skids) sk.life -= dt;
    state.skids = state.skids.filter((sk) => sk.life > 0);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);

    if (state.player.health <= 0) events |= EVENT_WASTED;
    return events;
  }

  /** A plain snapshot for saving (localStorage) and for the debug hook. */
  function saveData() {
    const p = state.player;
    return {
      money: p.money, missionIndex: state.missionIndex, health: p.health, ammo: p.ammo,
      x: p.x, y: p.y, clock: state.clock, carsStolen: state.carsStolen, kills: state.kills,
    };
  }

  function loadData(data) {
    reset(true);
    const p = state.player;
    p.money = data.money ?? MONEY.start;
    state.missionIndex = data.missionIndex ?? 0;
    p.health = data.health ?? PLAYER.health;
    p.ammo = data.ammo ?? PLAYER.startAmmo;
    p.x = data.x ?? city.playerStart.x;
    p.y = data.y ?? city.playerStart.y;
    state.clock = data.clock ?? CLOCK.startHour;
    state.carsStolen = data.carsStolen ?? 0;
    state.kills = data.kills ?? 0;
  }

  reset(true);
  return {
    state, reset, step, currentMission, currentStage, missionSpot,
    saveData, loadData, addCrime, spawnPickup, startStageSideEffects,
  };
}
