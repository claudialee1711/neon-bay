// Save / load for Neon Bay v2: one localStorage slot holding money,
// mission progress, the player's spot, health and ammo, and the clock.
// Saved on mission completion and on demand (X, or from the pause menu);
// loaded from the title screen's Continue option.
import { SAVE_KEY } from './constants.js';

export function saveGame(state) {
  try {
    const { player, missions, clock } = state;
    const data = {
      version: 2, savedAt: Date.now(),
      money: player.money, health: player.health, ammo: state.combat ? state.combat.ammo : 24,
      x: Math.round(player.x), y: Math.round(player.y),
      missionIndex: missions.index, missionState: missions.state === 'complete' ? 'complete' : 'idle',
      clockMinutes: clock ? clock.minutes : 540, wanted: state.police ? state.police.level : 0,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 2) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function applySave(state, data) {
  const { player, missions, clock } = state;
  player.money = data.money || 0;
  player.health = data.health || 100;
  player.x = data.x || player.x;
  player.y = data.y || player.y;
  if (state.combat) state.combat.ammo = data.ammo ?? 24;
  missions.index = Math.max(0, Math.min(missions.defs.length, data.missionIndex || 0));
  missions.leg = 0;
  missions.state = data.missionState === 'complete' ? 'complete' : 'idle';
  if (clock) clock.minutes = data.clockMinutes || 540;
  if (state.police) state.police.clear();
  if (state.camera) state.camera.snapTo(player.x, player.y);
}
