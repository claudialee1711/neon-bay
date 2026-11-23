// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between title, play, paused, busted,
// wasted and story-complete screens, and progress saves to localStorage.
//
// ?seed=N fixes the city. ?shot=drive|foot|chase|night (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_MISSION_DONE, EVENT_MISSION_FAIL, EVENT_WASTED } from './world.js';
import {
  ACTION_CARJACK, ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_NEWGAME, ACTION_PAUSE, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { missionAt, storyLine } from './missions.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

/** The debug hook the headless playtest reads: live state, nothing more. */
window.__neonBay = { world, seed, version: 'neon-bay-1.0' };

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.saveData()));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}

function runShot(name) {
  const staged = stageShot(name, world);
  const state = world.state;
  const mission = world.currentMission();
  state.missionMarker = world.missionSpot();
  const hud = {
    objective: mission ? `${mission.name}: ${world.currentStage() ? world.currentStage().text : ''}` : '',
    prompt: '',
    message: '',
    missionSpot: world.missionSpot(),
    storyLine: storyLine(state.missionIndex),
    hasSave: false,
  };
  let painted = 0;
  function paint() {
    renderer.draw(state, staged.screen, hud);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const saved = readSave();
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let message = '';
  let messageColor = '#ffd23f';
  let messageUntil = 0;
  let briefing = '';
  let briefingUntil = 0;
  let lastMissionIndex = world.state.missionIndex;
  let lastStageIndex = world.state.stageIndex;

  function announce(text) {
    status.textContent = text;
  }

  function showMessage(text, seconds, color) {
    message = text;
    messageColor = color || '#ffd23f';
    messageUntil = performance.now() + seconds * 1000;
  }

  function mission() {
    return world.currentMission();
  }

  function objectiveText() {
    const m = mission();
    if (!m) return stateLine();
    const stage = world.currentStage();
    if (!stage) return m.name;
    let text = `${m.name}: ${stage.text}`;
    if (stage.type === 'deliver' && world.state.stageTimer > 0) text += ` — ${Math.ceil(world.state.stageTimer)}s`;
    if (stage.type === 'eliminate') text += ` (${world.state.stageCount}/${stage.count})`;
    if (stage.type === 'hold' && world.state.stageHold > 0) text += ` — ${Math.ceil(world.state.stageHold)}s`;
    return text;
  }

  function stateLine() {
    return world.state.storyDone ? 'Story complete — free roam' : storyLine(world.state.missionIndex);
  }

  function startGame(fromSave) {
    const fresh = readSave();
    if (fromSave && fresh) {
      world.loadData(fresh);
    } else {
      world.reset(true);
      clearSave();
    }
    lastMissionIndex = world.state.missionIndex;
    lastStageIndex = world.state.stageIndex;
    const m = mission();
    if (m) {
      briefing = m.briefing;
      briefingUntil = performance.now() + 7000;
    }
    screen = SCREEN_PLAY;
    audio.unlock();
    announce(`Playing Neon Bay. ${m ? m.name : 'Free roam'}.`);
  }

  function backToTitle() {
    writeSave();
    screen = SCREEN_TITLE;
    announce('Neon Bay. Press Enter to start.');
  }

  function handleEvents(events) {
    const state = world.state;
    if (events & EVENT_MISSION_DONE) {
      const finished = missionAt(lastMissionIndex);
      showMessage(finished ? `MISSION COMPLETE — ${finished.name} +$${finished.reward}` : 'STORY COMPLETE', 4, '#3fce6c');
      audio.missionDone();
      writeSave();
      if (state.storyDone) screen = SCREEN_COMPLETE;
      const m = mission();
      if (m && screen === SCREEN_PLAY) {
        briefing = m.briefing;
        briefingUntil = performance.now() + 7000;
      }
    }
    if (events & EVENT_MISSION_FAIL) {
      showMessage('MISSION FAILED — try again', 3, '#ff4d4d');
      audio.missionFail();
    }
    if (events & EVENT_BUSTED) {
      const lost = Math.floor(state.player.money * 0.2);
      state.player.money -= lost;
      state.wantedHeat = 0;
      state.stars = 0;
      state.bustedLine = `You lost $${lost}. The crew posts bail.`;
      audio.arrest();
      screen = SCREEN_BUSTED;
      writeSave();
    }
    if (events & EVENT_WASTED) {
      const lost = Math.floor(state.player.money * 0.1);
      state.player.money -= lost;
      state.player.health = 100;
      state.wantedHeat = 0;
      state.stars = 0;
      state.wastedLine = `You lost $${lost}. The hospital patches you up.`;
      screen = SCREEN_OVER;
      writeSave();
    }
    lastMissionIndex = state.missionIndex;
    lastStageIndex = state.stageIndex;
  }

  function contextPrompt() {
    const state = world.state;
    const p = state.player;
    if (p.inCar) return '';
    let best = null;
    let bestD = 70 * 70;
    for (const car of state.cars) {
      if (car.dead) continue;
      const d = (car.x - p.x) ** 2 + (car.y - p.y) ** 2;
      if (d < bestD) { bestD = d; best = car; }
    }
    if (!best) return '';
    if (best.kind === 'parked') return 'Press E to take this car';
    if (best.kind === 'traffic' && Math.abs(best.speed) < 140) return 'Press E to get in — or F to carjack it';
    if (best.kind === 'police') return 'Press F to carjack the police car — if you dare';
    return '';
  }

  function step() {
    const state = world.state;
    const keys = input.keys;
    const actions = input.takeActions();
    const mouse = input.mouse();
    // Aim: the pointer's world position, through the camera; straight ahead
    // when the pointer has never moved.
    const camX = Math.max(0, Math.min(state.player.x - 640, 3840 - 1280));
    const camY = Math.max(0, Math.min(state.player.y - 360, 2880 - 720));
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    const aimX = mouse.inside ? camX + mouse.x * scaleX : state.player.x + Math.cos(state.player.angle) * 200;
    const aimY = mouse.inside ? camY + mouse.y * scaleY : state.player.y + Math.sin(state.player.angle) * 200;

    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      showMessage(muted ? 'SOUND OFF' : 'SOUND ON', 1.5);
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      writeSave();
      announce('Paused.');
      return;
    }
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
      return;
    }

    if (screen !== SCREEN_PLAY) return;

    const worldInput = {
      up: keys.up, down: keys.down, left: keys.left, right: keys.right,
      shoot: keys.shoot, aimX, aimY,
      enter: Boolean(actions & ACTION_ENTER),
      carjack: Boolean(actions & ACTION_CARJACK),
      // Holding E is what the vault-cracking stage needs.
      interact: keys.interactHeld,
    };
    const events = world.step(STEP, worldInput);
    state.missionMarker = world.missionSpot();
    if (events) handleEvents(events);
    audio.engine(state.player.inCar ? state.player.inCar.speed : 0, Boolean(state.player.inCar));
    audio.siren(state.stars > 0, STEP);
    if (state.saveTimer > 20) {
      state.saveTimer = 0;
      writeSave();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // One-shot presses are taken once, by the screen that owns them: the title
    // and end screens take theirs here, the play screen takes its own in step().
    if (screen === SCREEN_TITLE) {
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) startGame(Boolean(saved));
      else if (actions & ACTION_NEWGAME) startGame(false);
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_OVER) {
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) {
        world.reset(false);
        lastMissionIndex = world.state.missionIndex;
        screen = SCREEN_PLAY;
      }
    } else if (screen === SCREEN_COMPLETE) {
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) screen = SCREEN_PLAY;
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        if (screen === SCREEN_TITLE) {
          // The title screen's backdrop: the city idles behind the menu.
          world.step(STEP, { up: false, down: false, left: false, right: false, shoot: false, aimX: 0, aimY: 0, enter: false, carjack: false, interact: false });
          world.state.missionMarker = world.missionSpot();
        } else {
          step();
        }
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const state = world.state;
    const hud = {
      objective: screen === SCREEN_PLAY ? objectiveText() : '',
      prompt: screen === SCREEN_PLAY ? contextPrompt() : '',
      message: message && performance.now() < messageUntil ? message : '',
      messageColor,
      missionSpot: world.missionSpot(),
      storyLine: stateLine(),
      hasSave: Boolean(saved),
      bustedLine: state.bustedLine,
      wastedLine: state.wastedLine,
    };
    if (briefing && performance.now() < briefingUntil && screen === SCREEN_PLAY) {
      hud.objective = briefing;
    }
    renderer.draw(state, screen, hud);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      writeSave();
      announce('Paused.');
    }
  });

  announce('Neon Bay. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
