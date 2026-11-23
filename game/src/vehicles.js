// Vehicles for Neon Bay v2: parked cars to steal, drivable player cars,
// and traffic AI that follows the road grid. All classes, colours and
// names are invented for this game; nothing is taken from any other game.
import { CITY, WORLD } from './constants.js';
import { collidesWithBuildings } from './collision.js';

/** Four invented classes: different size, speed, grip and handling. */
export const VEHICLE_CLASSES = {
  hatch: { name: 'Pipit Hatch', length: 44, width: 22, accel: 540, top: 560, reverse: 230, steer: 2.7, brake: 700 },
  sedan: { name: 'Merak Sedan', length: 50, width: 24, accel: 480, top: 630, reverse: 240, steer: 2.4, brake: 680 },
  van: { name: 'Kargo Van', length: 58, width: 27, accel: 380, top: 500, reverse: 200, steer: 2.0, brake: 600 },
  sports: { name: 'Sambar GT', length: 48, width: 23, accel: 700, top: 840, reverse: 260, steer: 3.1, brake: 780 },
};
const CLASS_KEYS = Object.keys(VEHICLE_CLASSES);
const PAINT = ['#c0392b', '#2e6fb0', '#d8a020', '#3f8f5a', '#7a4a9a', '#c0c8d0', '#22262b', '#b0622a', '#4aa8a0', '#8a2f4a'];

function cornersOf(car) {
  const c = Math.cos(car.angle);
  const s = Math.sin(car.angle);
  const hl = car.length / 2;
  const hw = car.width / 2;
  return [
    { x: car.x + c * hl - s * hw, y: car.y + s * hl + c * hw },
    { x: car.x + c * hl + s * hw, y: car.y + s * hl - c * hw },
    { x: car.x - c * hl - s * hw, y: car.y - s * hl + c * hw },
    { x: car.x - c * hl + s * hw, y: car.y - s * hl - c * hw },
  ];
}

function hitsBuilding(city, car, x, y) {
  const probe = { ...car, x, y };
  for (const p of cornersOf(probe)) {
    if (collidesWithBuildings(city, p.x, p.y, 2)) return true;
  }
  return collidesWithBuildings(city, x, y, Math.min(car.length, car.width) / 2 - 2) !== null;
}

function makeCar(rng, id, x, y, angle, kind) {
  const cls = rng.pick(CLASS_KEYS);
  const spec = VEHICLE_CLASSES[cls];
  return {
    id, x, y, angle, kind, classKey: cls, length: spec.length, width: spec.width,
    colour: rng.pick(PAINT), speed: 0, steerVisual: 0,
    route: null, cruise: rng.range(180, 260), justTurned: 0, honk: 0,
  };
}

/** A traffic route is one road centre line, driven on the right-hand side. */
function randomRoute(rng) {
  if (rng.chance(0.5)) {
    return { vertical: true, at: rng.pick(CITY.roadsX), dir: rng.chance(0.5) ? 1 : -1 };
  }
  return { vertical: false, at: rng.pick(CITY.roadsY), dir: rng.chance(0.5) ? 1 : -1 };
}

function routeStart(route) {
  if (route.vertical) return { x: route.at + (route.dir > 0 ? 22 : -22), y: route.dir > 0 ? 20 : CITY.beachY - 20 };
  return { x: route.dir > 0 ? 20 : WORLD.width - 20, y: route.at + (route.dir > 0 ? 22 : -22) };
}

export function createVehicles(city, rng) {
  const cars = [];
  let nextId = 1;

  // Parked cars along the road edges: the ones the player can steal.
  let parked = 0;
  let guard = 0;
  while (parked < 18 && guard < 300) {
    guard += 1;
    const vertical = rng.chance(0.5);
    const at = vertical ? rng.pick(CITY.roadsX) : rng.pick(CITY.roadsY);
    const along = vertical ? rng.range(120, CITY.beachY - 120) : rng.range(120, WORLD.width - 120);
    const side = rng.chance(0.5) ? 34 : -34;
    const x = vertical ? at + side : along;
    const y = vertical ? along : at + side;
    const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    if (cars.some((c) => Math.hypot(c.x - x, c.y - y) < 80)) continue;
    const car = makeCar(rng, nextId, x, y, angle, 'parked');
    nextId += 1;
    cars.push(car);
    parked += 1;
  }

  // Traffic cars, each on a route, spread along it.
  for (let i = 0; i < 14; i += 1) {
    const route = randomRoute(rng);
    const start = routeStart(route);
    const car = makeCar(rng, nextId, start.x, start.y, route.vertical ? (route.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (route.dir > 0 ? 0 : Math.PI), 'traffic');
    nextId += 1;
    car.route = route;
    // Spread along the route so they do not all bunch at the start.
    const spread = rng.range(0, route.vertical ? CITY.beachY : WORLD.width);
    if (route.vertical) car.y = route.dir > 0 ? 20 + spread : CITY.beachY - 20 - spread;
    else car.x = route.dir > 0 ? 20 + spread : WORLD.width - 20 - spread;
    car.speed = car.cruise;
    cars.push(car);
  }

  const vehicles = {
    cars,
    playerCar: null,
    /** Set when the player steals a moving traffic car — Stage 3 reads it for wanted. */
    stoleTraffic: false,
    get parkedCount() { return cars.filter((c) => c.kind === 'parked').length; },
    get trafficCount() { return cars.filter((c) => c.kind === 'traffic').length; },

    nearestStealable(player) {
      let best = null;
      let bestD = 78;
      for (const car of cars) {
        if (car.kind === 'player') continue;
        if (car.kind === 'traffic' && Math.abs(car.speed) > 40) continue;
        const d = Math.hypot(car.x - player.x, car.y - player.y);
        if (d < bestD) { best = car; bestD = d; }
      }
      return best;
    },

    enterCar(player, car) {
      if (car.kind === 'traffic') vehicles.stoleTraffic = true;
      car.kind = 'player';
      car.speed = 0;
      vehicles.playerCar = car;
      player.inCar = true;
      player.x = car.x;
      player.y = car.y;
    },

    exitCar(player) {
      const car = vehicles.playerCar;
      if (!car) return;
      car.kind = 'parked';
      car.speed = 0;
      vehicles.playerCar = null;
      player.inCar = false;
      // Step out on the car's left side, clear of traffic.
      const px = car.x + Math.cos(car.angle + Math.PI / 2) * (car.width / 2 + 18);
      const py = car.y + Math.sin(car.angle + Math.PI / 2) * (car.width / 2 + 18);
      player.x = Math.max(14, Math.min(WORLD.width - 14, px));
      player.y = Math.max(14, Math.min(WORLD.height - 14, py));
      player.angle = car.angle;
    },

    update(dt, input, player, city, weather, effects, pedestrians) {
      const wet = weather ? weather.wet : 0;
      if (input.wasPressed('use')) {
        if (vehicles.playerCar) vehicles.exitCar(player);
        else {
          const car = vehicles.nearestStealable(player);
          if (car) vehicles.enterCar(player, car);
        }
      }
      if (vehicles.playerCar) vehicles.updatePlayerCar(dt, input, city, wet, effects);
      for (const car of cars) {
        if (car.kind === 'traffic') vehicles.updateTraffic(dt, car, city, wet);
      }
      vehicles.resolveCarCollisions(city, effects);
      vehicles.collideWithPedestrians(pedestrians, effects);
      vehicles.pushPlayer(player, effects);
      if (vehicles.playerCar) {
        player.x = vehicles.playerCar.x;
        player.y = vehicles.playerCar.y;
        player.angle = vehicles.playerCar.angle;
        player.speed = Math.abs(vehicles.playerCar.speed);
        player.moving = Math.abs(vehicles.playerCar.speed) > 5;
      }
    },

    updatePlayerCar(dt, input, city, wet, effects) {
      const car = vehicles.playerCar;
      const spec = VEHICLE_CLASSES[car.classKey];
      const grip = 1 - 0.25 * wet;
      const up = input.is('up');
      const down = input.is('down');
      const left = input.is('left');
      const right = input.is('right');
      const handbrake = input.is('use') && (up || down);
      if (up) car.speed += spec.accel * (1 - 0.12 * wet) * dt;
      if (down) {
        if (car.speed > 20) car.speed -= spec.brake * (1 - 0.30 * wet) * dt;
        else car.speed -= spec.accel * 0.55 * dt;
      }
      if (!up && !down) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
      if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 900 * dt);
      car.speed = Math.max(-spec.reverse, Math.min(spec.top, car.speed));
      const steerIn = (left ? -1 : 0) + (right ? 1 : 0);
      const steerAuthority = Math.min(1, Math.abs(car.speed) / 130 + 0.25);
      const turn = steerIn * spec.steer * steerAuthority * grip * Math.sign(car.speed || 1);
      car.angle += turn * dt;
      car.steerVisual = steerIn;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const hit = vehicles.moveCar(city, car, nx, ny);
      // Stay inside the world: the beach road is the southern edge.
      const cx = Math.max(24, Math.min(WORLD.width - 24, car.x));
      const cy = Math.max(24, Math.min(WORLD.height - 24, car.y));
      if (cx !== car.x || cy !== car.y) { car.x = cx; car.y = cy; car.speed *= 0.4; }
      if (hit) {
        car.speed *= 0.45;
        effects.burst(car.x, car.y, 'spark', 8);
      }
      // Skid marks + smoke on hard braking / hard turning at speed.
      const skidding = (handbrake && Math.abs(car.speed) > 240) || (Math.abs(steerIn) > 0 && Math.abs(car.speed) > 380);
      if (skidding) {
        const bx = car.x - Math.cos(car.angle) * car.length * 0.32;
        const by = car.y - Math.sin(car.angle) * car.length * 0.32;
        effects.skid(bx, by, bx - Math.cos(car.angle) * car.speed * dt, by - Math.sin(car.angle) * car.speed * dt);
        if (Math.random() < 0.5) effects.burst(bx, by, 'smoke', 1);
      }
      // Exhaust puffs while accelerating.
      if (up && Math.random() < 0.35) {
        effects.burst(car.x - Math.cos(car.angle) * car.length * 0.5, car.y - Math.sin(car.angle) * car.length * 0.5, 'smoke', 1);
      }
    },

    /** Move a car, sliding along buildings axis by axis; true on a hard hit. */
    moveCar(city, car, nx, ny) {
      if (!hitsBuilding(city, car, nx, ny)) { car.x = nx; car.y = ny; return false; }
      if (!hitsBuilding(city, car, nx, car.y)) { car.x = nx; return true; }
      if (!hitsBuilding(city, car, car.x, ny)) { car.y = ny; return true; }
      return true;
    },

    updateTraffic(dt, car, city, wet) {
      const route = car.route;
      if (!route) return;
      car.justTurned = Math.max(0, car.justTurned - dt);
      const cruise = car.cruise * (1 - 0.22 * wet);
      // Slow for a car ahead in the same lane.
      let target = cruise;
      for (const other of cars) {
        if (other === car || other.kind === 'parked') continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const ahead = route.vertical ? dy * route.dir : dx * route.dir;
        const side = route.vertical ? Math.abs(dx) : Math.abs(dy);
        if (ahead > 0 && ahead < 110 && side < 30) target = Math.min(target, Math.max(0, Math.abs(other.speed) - 20));
        if (ahead > 0 && ahead < 55 && side < 30) target = 0;
      }
      car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), 320 * dt);
      // Keep on the right-hand lane of the route.
      if (route.vertical) {
        car.x += ((route.at + (route.dir > 0 ? 22 : -22)) - car.x) * Math.min(1, 3 * dt);
        car.y += route.dir * car.speed * dt;
        car.angle = route.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.y += ((route.at + (route.dir > 0 ? 22 : -22)) - car.y) * Math.min(1, 3 * dt);
        car.x += route.dir * car.speed * dt;
        car.angle = route.dir > 0 ? 0 : Math.PI;
      }
      car.x = Math.max(20, Math.min(WORLD.width - 20, car.x));
      car.y = Math.max(20, Math.min(CITY.beachY - 20, car.y));
      // Turn at an intersection, sometimes, onto the crossing road.
      if (car.justTurned <= 0) {
        const cross = route.vertical ? CITY.roadsY : CITY.roadsX;
        const along = route.vertical ? car.y : car.x;
        for (const c of cross) {
          if (Math.abs(along - c) < 26 && Math.random() < 0.30) {
            const next = route.vertical
              ? { vertical: false, at: c, dir: Math.random() < 0.5 ? 1 : -1 }
              : { vertical: true, at: c, dir: Math.random() < 0.5 ? 1 : -1 };
            car.route = next;
            car.justTurned = 2;
            if (next.vertical) car.x = next.at + (next.dir > 0 ? 22 : -22);
            else car.y = next.at + (next.dir > 0 ? 22 : -22);
            break;
          }
        }
      }
      // Reached the end of the road: respawn on a fresh route.
      const atEnd = route.vertical
        ? (route.dir > 0 && car.y >= CITY.beachY - 30) || (route.dir < 0 && car.y <= 30)
        : (route.dir > 0 && car.x >= WORLD.width - 30) || (route.dir < 0 && car.x <= 30);
      if (atEnd) {
        const next = randomRoute(rng);
        const start = routeStart(next);
        car.route = next;
        car.x = start.x;
        car.y = start.y;
        car.speed = car.cruise;
        car.justTurned = 2;
      }
    },

    resolveCarCollisions(city, effects) {
      for (let i = 0; i < cars.length; i += 1) {
        for (let j = i + 1; j < cars.length; j += 1) {
          const a = cars[i];
          const b = cars[j];
          if (a.kind === 'parked' && b.kind === 'parked') continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const min = (a.length + b.length) / 2 - 6;
          if (dist > 0 && dist < min) {
            const push = (min - dist) / 2;
            const nx = dx / dist;
            const ny = dy / dist;
            a.x -= nx * push; a.y -= ny * push;
            b.x += nx * push; b.y += ny * push;
            const bump = Math.abs(a.speed - b.speed);
            if (bump > 120) effects.burst((a.x + b.x) / 2, (a.y + b.y) / 2, 'spark', 5);
            if (a.kind !== 'parked') a.speed *= 0.7;
            if (b.kind !== 'parked') b.speed *= 0.7;
          }
        }
      }
    },

    collideWithPedestrians(pedestrians, effects) {
      if (!pedestrians) return;
      for (const car of cars) {
        if (Math.abs(car.speed) < 20) continue;
        for (const ped of pedestrians.list) {
          if (ped.state === 'down') continue;
          const d = Math.hypot(ped.x - car.x, ped.y - car.y);
          if (d < car.length / 2 + 8) {
            if (Math.abs(car.speed) > 90) {
              ped.knockDown(car.angle);
              effects.burst(ped.x, ped.y, 'dust', 6);
            } else {
              ped.fleeFrom(car.x, car.y);
            }
          }
        }
      }
    },

    pushPlayer(player, effects) {
      if (player.inCar) return;
      for (const car of cars) {
        if (car.kind === 'parked' || Math.abs(car.speed) < 40) continue;
        const dx = player.x - car.x;
        const dy = player.y - car.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < car.length / 2 + player.radius) {
          const push = (car.length / 2 + player.radius - d) + 6;
          player.x += (dx / d) * push;
          player.y += (dy / d) * push;
          if (Math.abs(car.speed) > 150) effects.burst(player.x, player.y, 'dust', 4);
        }
      }
    },
  };
  return vehicles;
}
