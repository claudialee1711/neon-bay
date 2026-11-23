// Dynamic weather for Neon Bay v2 — the new system seeded in Stage 1.
// The sky cycles sunny -> cloudy -> rain -> dusk on a slow timer, so the same
// city reads differently over a session. The renderer asks for the current
// tint, cloud shadows and rain streaks; later stages can tie police sight
// range and traffic speed to `wet` and `dark`.
export const WEATHER_SUNNY = 'sunny';
export const WEATHER_CLOUDY = 'cloudy';
export const WEATHER_RAIN = 'rain';
export const WEATHER_DUSK = 'dusk';

const CYCLE = [WEATHER_SUNNY, WEATHER_CLOUDY, WEATHER_RAIN, WEATHER_SUNNY, WEATHER_DUSK];
const CYCLE_SECONDS = 50;

export function createWeather(rng) {
  let index = 0;
  let timer = 0;
  let blend = 1; // 0..1, how fully the current state applies
  const clouds = [];
  for (let i = 0; i < 9; i += 1) {
    clouds.push({ x: rng.range(0, 4200), y: rng.range(0, 3200), r: rng.range(180, 420), speed: rng.range(6, 18) });
  }
  const drops = [];
  for (let i = 0; i < 120; i += 1) {
    drops.push({ x: rng.range(0, 1280), y: rng.range(0, 720), speed: rng.range(700, 1100) });
  }

  function current() { return CYCLE[index]; }
  return {
    get kind() { return current(); },
    get blend() { return blend; },
    /** 0 in dry sun, 1 in full rain — later stages use it for grip/sight. */
    get wet() { return current() === WEATHER_RAIN ? blend : 0; },
    /** 0 in daylight, 1 at dusk — later stages use it for lamps/police. */
    get dark() { return current() === WEATHER_DUSK ? blend * 0.55 : 0; },
    clouds,
    drops,
    update(dt) {
      timer += dt;
      blend = Math.min(1, blend + dt / 4);
      if (timer >= CYCLE_SECONDS) {
        timer = 0;
        index = (index + 1) % CYCLE.length;
        blend = 0;
      }
      for (const c of clouds) {
        c.x += c.speed * dt;
        if (c.x - c.r > 4200) c.x = -c.r;
      }
      if (current() === WEATHER_RAIN) {
        for (const d of drops) {
          d.y += d.speed * dt;
          d.x -= d.speed * 0.18 * dt;
          if (d.y > 720) { d.y = -20; d.x = Math.random() * 1400; }
        }
      }
    },
    /** Short label for the HUD. */
    label() {
      return { sunny: 'Sunny', cloudy: 'Overcast', rain: 'Rain', dusk: 'Dusk' }[current()];
    },
  };
}
