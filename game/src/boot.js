// Boot for Neon Bay v2: build the city from the seed, spawn the player at
// Harbourlight Plaza, wire input, camera, weather, vehicles, pedestrians
// and effects, and paint.
// ?seed=N fixes the city (default 77031). Stage 2 adds vehicles and traffic,
// Stage 3 adds wanted/police/missions/combat/HUD/audio/save, Stage 4 adds
// the screenshot staging. On foot and by car.
import { DEFAULT_SEED, PLAYER } from './constants.js';
import { createRng } from './rng.js';
import { buildCity } from './citygen.js';
import { createPlayer } from './player.js';
import { createCamera } from './camera.js';
import { createWeather } from './weather.js';
import { createInput } from './input.js';
import { createRenderer } from './draw.js';
import { createEngine } from './engine.js';
import { createVehicles } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createEffects } from './effects.js';

const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : DEFAULT_SEED;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRng(seed);
const city = buildCity(rng);
const player = createPlayer(PLAYER.startX, PLAYER.startY);
const camera = createCamera();
camera.snapTo(player.x, player.y);
const weather = createWeather(createRng(seed + 101));
const vehicles = createVehicles(city, createRng(seed + 202));
const pedRng = createRng(seed + 303);
const pedestrians = createPedestrians(city, pedRng);
const effects = createEffects();
const input = createInput(canvas);
const renderer = createRenderer(canvas);

const state = { city, player, camera, weather, seed, version: 'neon-bay-2.0', vehicles, pedestrians, effects };

/** The debug hook headless probes read: live state, nothing more. */
window.__neonBay = state;

function announce(text) {
  if (status) status.textContent = text;
}
announce('Neon Bay. Explore the city on foot or by car. WASD to move and drive, E to steal a car.');

const engine = createEngine({
  update(dt) {
    weather.update(dt);
    vehicles.update(dt, input, player, city, weather, effects, pedestrians);
    if (!player.inCar) player.update(dt, input, city);
    pedestrians.update(dt, city, pedRng);
    effects.update(dt);
    // Camera follows the car with a little speed look-ahead, else the player.
    const focus = vehicles.playerCar || player;
    const lead = vehicles.playerCar ? 0.22 : 0;
    const lx = focus.x + Math.cos(focus.angle || 0) * Math.abs(vehicles.playerCar ? vehicles.playerCar.speed : 0) * lead;
    const ly = focus.y + Math.sin(focus.angle || 0) * Math.abs(vehicles.playerCar ? vehicles.playerCar.speed : 0) * lead;
    camera.update(dt, lx, ly);
  },
  render(dt) {
    renderer.draw(state, dt);
    input.endFrame();
  },
});
engine.start();
