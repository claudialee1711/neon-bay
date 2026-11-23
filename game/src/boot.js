// Boot for Neon Bay v2: build the city from the seed, spawn the player at
// Harbourlight Plaza, wire input, camera, weather, vehicles, pedestrians,
// effects, and the Stage 3 systems — police/wanted, combat, missions,
// HUD, synth audio, save and screens — then paint.
// ?seed=N fixes the city (default 77031). On foot and by car.
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
import { createAudio } from './audio.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createScreens, respawnPlayer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_BUSTED, SCREEN_WASTED, SCREEN_COMPLETE } from './screens.js';
import { saveGame, loadGame, hasSave, applySave } from './save.js';

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
const audio = createAudio();
const police = createPolice(city, createRng(seed + 404));
const combat = createCombat(city, createRng(seed + 505));
const missions = createMissions(city);
const screens = createScreens();
// In-game clock: starts 09:00, 2 game-minutes per real second.
const clock = { minutes: 540 };

const state = {
  city, player, camera, weather, seed, version: 'neon-bay-2.0',
  vehicles, pedestrians, effects, audio, police, combat, missions, screens, clock,
  hasSaveFn: hasSave,
};

/** The debug hook headless probes read: live state, nothing more. */
window.__neonBay = state;

function announce(text) {
  if (status) status.textContent = text;
}
announce('Neon Bay. Rani Kestrel owes Mara Voss. Press Enter to start the first job.');

function startMission() {
  const def = missions.current;
  if (!def) return;
  if (missions.start()) {
    if (def.wantedOnStart) police.addHeat(22 * def.wantedOnStart, 'job-heat');
    audio.ensure();
    audio.click();
  }
}

function doSave() {
  if (saveGame(state)) {
    screens.savedFlash = 2.5;
    audio.pickup();
  }
}

const engine = createEngine({
  update(dt) {
    // Screens gate the simulation: only 'play' advances the world.
    if (screens.screen === SCREEN_TITLE) {
      if (input.wasPressed('confirm')) {
        audio.ensure();
        missions.index = 0;
        missions.leg = 0;
        missions.state = 'idle';
        player.money = 0;
        player.health = 100;
        combat.ammo = 24;
        police.clear();
        screens.set(SCREEN_PLAY);
        startMission();
      } else if (input.wasPressed('newgame') && hasSave()) {
        const data = loadGame();
        if (data) {
          applySave(state, data);
          audio.ensure();
          screens.set(SCREEN_PLAY);
          if (missions.state === 'idle') startMission();
        }
      }
      return;
    }
    if (screens.screen === SCREEN_PAUSE) {
      screens.savedFlash = Math.max(0, screens.savedFlash - dt);
      if (input.wasPressed('pause')) { screens.set(SCREEN_PLAY); audio.click(); }
      else if (input.wasPressed('save')) doSave();
      else if (input.wasPressed('confirm')) screens.set(SCREEN_TITLE);
      return;
    }
    if (screens.screen === SCREEN_BUSTED || screens.screen === SCREEN_WASTED) {
      if (input.wasPressed('confirm')) {
        respawnPlayer(state);
        screens.set(SCREEN_PLAY);
        if (missions.state === 'idle' && missions.current) startMission();
      }
      return;
    }
    if (screens.screen === SCREEN_COMPLETE) {
      if (input.wasPressed('confirm')) screens.set(SCREEN_TITLE);
      return;
    }
    // --- playing ---
    if (input.wasPressed('mute')) audio.toggleMute();
    if (input.wasPressed('pause')) { screens.set(SCREEN_PAUSE); audio.setEngine(0, false); return; }
    if (input.wasPressed('save')) doSave();
    if (input.wasPressed('confirm') && (missions.state === 'idle' || missions.state === 'failed')) {
      missions.retry();
      const def = missions.current;
      if (def && def.wantedOnStart && missions.state === 'active') police.addHeat(22 * def.wantedOnStart, 'job-heat');
    }
    clock.minutes = (clock.minutes + dt * 2) % 1440;
    weather.update(dt);
    // Combat first: mouse aim, click to shoot, F to punch.
    if (!player.inCar) {
      // Mouse is in CSS pixels; convert to world coords via the view size.
      const cssW = canvas.clientWidth || 1280;
      const cssH = canvas.clientHeight || 720;
      const viewH = (canvas.height / (canvas.width / 1280)) || 720;
      const worldMouseX = camera.x + input.mouse.x * (1280 / cssW);
      const worldMouseY = camera.y + input.mouse.y * (viewH / cssH);
      const aim = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);
      if (input.mouse.clicked) combat.shoot(player, aim, police, audio, effects);
      if (input.wasPressed('attack')) combat.melee(player, police, pedestrians, audio, effects);
    }
    vehicles.update(dt, input, player, city, weather, effects, pedestrians);
    if (!player.inCar) player.update(dt, input, city);
    pedestrians.update(dt, city, pedRng);
    police.update(dt, { player, vehicles, pedestrians, weather, effects, audio });
    combat.update(dt, { player, police, pedestrians, effects, audio });
    missions.update(dt, {
      player, police, audio,
      onComplete() {
        screens.set(SCREEN_COMPLETE, 'Story complete — Rani is free of Mara Voss.');
        doSave();
      },
      onMissionDone() { doSave(); },
    });
    if (police.busted) {
      police.busted = false;
      screens.set(SCREEN_BUSTED, 'Busted! The Neon Bay police took you in. $100 fine.');
      audio.fail();
    } else if (player.health <= 0) {
      screens.set(SCREEN_WASTED, 'Wasted! Rani went down. $100 hospital bill.');
      audio.fail();
    } else if (missions.state === 'failed') {
      // Mission fail is handled by Enter-to-retry; keep playing.
    }
    if (missions.state === 'failed' && police.level === 0 && player.health > 0) {
      // nothing: player retries with Enter
    }
    effects.update(dt);
    audio.setEngine(vehicles.playerCar ? vehicles.playerCar.speed : 0, !!vehicles.playerCar);
    audio.setSiren(police.level > 0, dt);
    screens.savedFlash = Math.max(0, screens.savedFlash - dt);
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
