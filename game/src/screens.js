// Screen state machine for Neon Bay v2: title, play, pause, busted,
// wasted and complete. The title offers Start (fresh) or Continue (a
// save exists); pause saves on X; busted and wasted respawn the player
// at Juniper Clinic with a fine; complete ends the story.
export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

export function createScreens() {
  return {
    screen: SCREEN_TITLE,
    message: '',
    savedFlash: 0,
    set(screen, message) {
      this.screen = screen;
      if (message !== undefined) this.message = message;
    },
    get isPlaying() { return this.screen === SCREEN_PLAY; },
  };
}

/** Respawn after busted/wasted: clinic, full health, fine, heat cleared. */
export function respawnPlayer(state) {
  const { player, police, combat, city, camera } = state;
  const clinic = city.spotCentre('clinic');
  player.x = clinic.x;
  player.y = clinic.y;
  player.health = 100;
  player.money = Math.max(0, player.money - 100);
  if (player.inCar && state.vehicles) state.vehicles.exitCar(player);
  if (combat) combat.bullets = [];
  if (police) { police.clear(); police.busted = false; }
  if (state.missions && state.missions.state === 'active') state.missions.fail('caught');
  if (camera) camera.snapTo(player.x, player.y);
}
