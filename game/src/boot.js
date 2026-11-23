// Boot for Neon Bay v2: build the city from the seed, spawn the player at
// Harbourlight Plaza, wire input, camera, weather and the loop, and paint.
// ?seed=N fixes the city (default 77031). Stage 2 adds vehicles and traffic,
// Stage 3 adds wanted/police/missions/combat/HUD/audio/save, Stage 4 adds
// the screenshot staging. This stage is on-foot play only.
import { DEFAULT_SEED, PLAYER } from './constants.js';
import { createRng } from './rng.js';
import { buildCity } from './citygen.js';
import { createPlayer } from './player.js';
import { createCamera } from './camera.js';
import { createWeather } from './weather.js';
import { createInput } from './input.js';
import { createRenderer } from './draw.js';
import { createEngine } from './engine.js';

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
const input = createInput(canvas);
const renderer = createRenderer(canvas);

const state = { city, player, camera, weather, seed, version: 'neon-bay-2.0' };

/** The debug hook headless probes read: live state, nothing more. */
window.__neonBay = state;

function announce(text) {
  if (status) status.textContent = text;
}
announce('Neon Bay. Explore the city on foot. WASD to move, Shift to run.');

const engine = createEngine({
  update(dt) {
    weather.update(dt);
    player.update(dt, input, city);
    camera.update(dt, player.x, player.y);
  },
  render(dt) {
    renderer.draw(state, dt);
    input.endFrame();
  },
});
engine.start();
