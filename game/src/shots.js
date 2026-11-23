// The screenshot scenes behind ?shot=drive|foot|chase|night. Each one plays the
// real rules forward from a fresh world for a fixed number of seconds, steered by
// a simple autopilot (follow the road loop, walk at the nearest rival and shoot,
// outrun the police), so the frame is what a short game really looks like and the
// same seed always gives the same frame. The loop paints the scene twice and the
// caller sets window.__shotReady for the screenshot.

import { STEP } from './config.js';
import { STAGE_ELIMINATE } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const DRIVE_SECONDS = 22;
const FOOT_SECONDS = 9;
const CHASE_SECONDS = 10;
const NIGHT_SECONDS = 20;

function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Drive input toward a waypoint: steer to it, brake for sharp turns. */
function driveInput(state, target) {
  const car = state.player.inCar;
  if (!car) return { up: false, down: false, left: false, right: false, shoot: false, aimX: 0, aimY: 0, enter: false, carjack: false, interact: false };
  const want = Math.atan2(target.y - car.y, target.x - car.x);
  const diff = angleDiff(car.angle, want);
  return {
    up: Math.abs(diff) < 1.2,
    down: Math.abs(diff) >= 1.2,
    left: diff > 0.12,
    right: diff < -0.12,
    shoot: false, aimX: 0, aimY: 0, enter: false, carjack: false, interact: false,
  };
}

/** Follow one of the city's traffic loops, waypoint by waypoint. */
function roadAutopilot(state, routeIndex = 0) {
  const route = state.city.routes[routeIndex];
  const car = state.player.inCar;
  if (!car) return driveInput(state, state.city.playerStart);
  let best = route[0];
  let bestD = Infinity;
  for (const wp of route) {
    const d = (wp.x - car.x) ** 2 + (wp.y - car.y) ** 2;
    if (d < bestD) { bestD = d; best = wp; }
  }
  const idx = route.indexOf(best);
  // Only look ahead once the nearest waypoint is nearly reached: aiming past
  // a corner cuts it diagonally through the buildings inside the block.
  const target = bestD < 100 * 100 ? route[(idx + 1) % route.length] : best;
  const input = driveInput(state, target);
  // Slow for the corner ahead. Every waypoint on a rectangle loop is a
  // 90-degree turn, and at full speed the car covers 500 units a second, so
  // it cannot turn at the waypoint itself — it slides into the building
  // inside the block instead. Only brake while still fast: braking all the
  // way to a stop inside the zone strands the car there with no gas.
  if (bestD < 320 * 320 && Math.abs(car.speed) > 260) input.up = false;
  // Ease off the gas when another car is right ahead, instead of rear-ending it.
  // Police cars do not count: braking for the cops chasing you is how you get caught.
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const other of state.cars) {
    if (other === car || other.dead || other.kind === 'police') continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d < 150 && d > 0.01 && (dx * fx + dy * fy) / d > 0.75) {
      input.up = false;
      if (d < 80) input.down = true;
      break;
    }
  }
  return input;
}

/** Walk at the nearest rival and shoot it. */
function footAutopilot(state) {
  const p = state.player;
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < bestD) { bestD = d; best = e; }
  }
  if (!best) return { up: false, down: false, left: false, right: false, shoot: false, aimX: p.x + 100, aimY: p.y, enter: false, carjack: false, interact: false };
  const dx = best.x - p.x;
  const dy = best.y - p.y;
  const d = Math.hypot(dx, dy);
  return {
    up: dy < -20,
    down: dy > 20,
    left: dx < -20,
    right: dx > 20,
    shoot: d < 460,
    aimX: best.x,
    aimY: best.y,
    enter: false, carjack: false, interact: false,
  };
}

/** Put the player in the nearest parked car, ready to drive. */
function putPlayerInCar(world) {
  const state = world.state;
  let best = null;
  let bestD = Infinity;
  for (const car of state.cars) {
    if (car.kind !== 'parked') continue;
    const d = (car.x - state.player.x) ** 2 + (car.y - state.player.y) ** 2;
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return;
  state.player.x = best.x;
  state.player.y = best.y;
  world.step(STEP, { up: false, down: false, left: false, right: false, shoot: false, aimX: 0, aimY: 0, enter: true, carjack: false, interact: false });
}

/**
 * Set `world` to the named scene and return the screen and HUD to draw over it.
 * Any other name stages the title screen.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset(true);
  if (name === 'drive') {
    putPlayerInCar(world);
    for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) {
      world.step(STEP, roadAutopilot(state));
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'foot') {
    state.missionIndex = 3;
    state.stageIndex = 1;
    const stage = world.currentStage();
    if (stage && stage.type === STAGE_ELIMINATE) world.startStageSideEffects(stage);
    const spot = state.city.spots.warehouse;
    state.player.x = spot.x - 160;
    state.player.y = spot.y + 60;
    for (let i = 0; i < FOOT_SECONDS / STEP; i += 1) {
      world.step(STEP, footAutopilot(state));
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    state.wantedHeat = 62;
    state.stars = 3;
    putPlayerInCar(world);
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      world.step(STEP, roadAutopilot(state));
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'night') {
    // 22:00 is (22 - 8) * 20 seconds into the clock.
    state.elapsed = (22 - 8) * 20;
    state.wantedHeat = 20;
    state.stars = 1;
    putPlayerInCar(world);
    for (let i = 0; i < NIGHT_SECONDS / STEP; i += 1) {
      // A different loop from the day drive, so the night frame is not the same corner.
      world.step(STEP, roadAutopilot(state, 1));
    }
    return { screen: SCREEN_PLAY };
  }
  for (let i = 0; i < 5 / STEP; i += 1) {
    world.step(STEP, { up: false, down: false, left: false, right: false, shoot: false, aimX: 0, aimY: 0, enter: false, carjack: false, interact: false });
  }
  return { screen: SCREEN_TITLE };
}
