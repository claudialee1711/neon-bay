// Neon Bay v2: every tuning number and colour in one place.
// The world is a fixed 4200x3200 coastal city; the renderer shows a 1280x720
// window of it, scaled to the browser window, so no rule below depends on
// the screen size. All names here are invented for this game.
export const WORLD = { width: 4200, height: 3200 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** The camera's logical viewport. */
export const VIEW = { width: 1280, height: 720 };

/** Default city seed for v2 (a different city from v1). */
export const DEFAULT_SEED = 77031;

export const SAVE_KEY = 'neon-bay-v2-save';

/** City grid: roads run on these centre lines; blocks sit between them. */
export const CITY = {
  roadsX: [280, 760, 1320, 1950, 2480, 3090, 3660],
  roadsY: [260, 780, 1290, 1840, 2360, 2820],
  roadWidth: 100,
  sidewalk: 28,
  /** South of this y the sand and the sea begin. */
  beachY: 2820,
  /** North of this y is the Juniper Fields green belt. */
  greenY: 260,
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 240,
  runSpeed: 335,
  health: 100,
  startX: 1950,
  startY: 1290,
};

/** Names for the city's districts, streets and landmarks: all invented. */
export const NAMES = {
  city: 'Neon Bay',
  districts: ['Glasswater Quarter', 'Foundry Row', 'Lantern Market', 'Copper Hill', 'Salt Wharf', 'Juniper Fields'],
  streets: ['Glasswater Ave', 'Foundry St', 'Lantern Row', 'Copper Hill Rd', 'Salt Wharf Ln', 'Juniper Way', 'Harbourlight Blvd', 'Ember St'],
};

export const COLOURS = {
  ground: '#3d6b4f',
  groundDry: '#6b7a4a',
  sand: '#d9c27a',
  sea: '#2a6f8e',
  seaDeep: '#1d4f6e',
  road: '#33373d',
  roadEdge: '#26292e',
  sidewalk: '#8a8d90',
  lane: '#e8d44d',
  park: '#4a7d3a',
  plaza: '#9a938a',
  roof: ['#6b5a7a', '#5a6b7a', '#7a5a4a', '#4a5a6b', '#7a6b4a', '#5a7a5a', '#8a4a5a', '#4a7a6b'],
};
