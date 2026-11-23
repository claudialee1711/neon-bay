// Neon Bay: every tuning number and colour in one place.
// The world is a fixed 3840x2880 city; the renderer shows a 1280x720 window of it,
// scaled to the browser window, so no rule below depends on the screen size.

export const WORLD = { width: 3840, height: 2880 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The camera's logical viewport. */
export const VIEW = { width: 1280, height: 720 };

/** City grid: roads run on these centre lines; blocks sit between them. */
export const CITY = {
  roadsX: [240, 720, 1200, 1680, 2160, 2640, 3120, 3600],
  roadsY: [240, 720, 1200, 1680, 2160, 2640],
  roadWidth: 96,
  sidewalk: 26,
  /** South of this y the sand and the sea begin. */
  beachY: 2640,
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 230,
  runSpeed: 300,
  health: 100,
  /** Health regained per second while no cop can see the player. */
  regen: 2,
  startAmmo: 48,
  maxAmmo: 240,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 340,
  brake: 620,
  reverseAccel: 220,
  maxSpeed: 560,
  maxReverse: 180,
  /** Steering rate (radians/s) at full lock, scaled down as speed rises. */
  steer: 2.6,
  drag: 0.55,
  /** Speed above which a hard turn leaves skid marks. */
  skidSpeed: 300,
  health: 100,
};

export const TRAFFIC = {
  count: 26,
  speed: 150,
  speedJitter: 45,
  /** How close a traffic car gets before it slows for the car ahead. */
  followGap: 90,
};

export const PEDESTRIANS = {
  count: 42,
  walkSpeed: 55,
  fleeSpeed: 150,
};

export const POLICE = {
  /** Heat (0-100) at which each star lights up. */
  starHeat: [0, 18, 38, 58, 78, 92],
  maxCopCars: [0, 0, 2, 3, 4, 6],
  maxFootCops: [0, 2, 3, 4, 5, 6],
  carSpeed: 520,
  footSpeed: 235,
  /** Seconds a foot cop must stay touching a slow player to make the arrest. */
  arrestTime: 2.5,
  /** Heat lost per second while no cop is within sight range. */
  decay: 2.2,
  sightRange: 560,
  spawnRange: 750,
  despawnRange: 1500,
};

export const CRIME = {
  carjack: 20,
  hitPedestrian: 16,
  shoot: 8,
  killCop: 30,
  stealParked: 6,
};

export const WEAPON = {
  damage: 34,
  range: 520,
  fireInterval: 0.22,
  spread: 0.06,
  magazine: 12,
};

export const MONEY = {
  start: 100,
  bustedLoss: 0.2,
  wastedLoss: 0.1,
};

/** One in-game hour per this many real seconds; a full day is 8 minutes. */
export const CLOCK = { secondsPerHour: 20, startHour: 8 };

export const SAVE_KEY = 'neon-bay.save.v1';

export const PALETTE = {
  grass: '#3f7a4a',
  grassDark: '#356b3f',
  sand: '#d9c48a',
  sea: '#1d6f8e',
  seaDeep: '#145a76',
  asphalt: '#33373d',
  asphaltDark: '#2b2f35',
  roadLine: '#d8c95a',
  sidewalk: '#8f959c',
  curb: '#6e747c',
  buildingRoof: '#5a4a63',
  buildingRoof2: '#4a5a63',
  buildingRoof3: '#63503f',
  buildingEdge: '#2c2530',
  windowLit: '#ffd76a',
  windowDark: '#232a33',
  park: '#2e6b34',
  tree: '#2a5c2e',
  treeTop: '#3f8a3f',
  player: '#ffcf3f',
  playerCar: '#e23b3b',
  copCar: '#2f6fd0',
  cop: '#2f6fd0',
  trafficCar: '#c8cdd4',
  ped: '#e8e2d4',
  enemy: '#b03060',
  money: '#3fce6c',
  health: '#3fce6c',
  ammo: '#f2c94c',
  marker: '#ffd23f',
  text: '#f2f4f6',
  muted: '#9aa3ad',
  panel: 'rgba(12, 16, 22, 0.78)',
  panelBorder: 'rgba(255, 255, 255, 0.14)',
  wanted: '#ff4d4d',
  sky: '#7ec8e3',
  dusk: '#e8905a',
  night: '#0b1220',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Colours for the traffic cars and parked cars, so the city is not one grey fleet. */
export const CAR_COLOURS = [
  '#c8cdd4', '#8a94a6', '#b03030', '#3060b0', '#3f8a4f', '#c9a13b',
  '#7a4a8a', '#d06a2a', '#3a3a3a', '#e8e2d4', '#2a6a6a', '#a03060',
];

/** Names for the city's districts, streets and people: all invented, none from any real game. */
export const NAMES = {
  city: 'Neon Bay',
  districts: ['Downtown', 'The Docks', 'Casino Strip', 'Marina Beach', 'Palm Heights', 'Old Mill'],
  streets: ['Coral Ave', 'Sunset Blvd', 'Palm Row', 'Harbor St', 'Neon Way', 'Tide Rd', 'Vice Ln', 'Marina Dr'],
  player: 'Rex Marlowe',
  fixer: 'Mara Voss',
  crew: ['Dante', 'Luz'],
  rivals: 'The Vipers',
};
