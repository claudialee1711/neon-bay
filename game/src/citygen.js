// The city of Neon Bay v2, generated once from a seed: an irregular road
// grid, the blocks and buildings inside them, parks, the plaza, the beach
// and the sea, and the named spots the story will use. Everything is plain
// data (rectangles, roads, points) so the world, the renderer and the
// minimap all read the same map, and the same seed always builds the same
// city. v2 uses a different grid, different districts and different spot
// names from v1.
import { CITY, COLOURS, NAMES, WORLD } from './constants.js';

export const SPOT_DEPOT = 'depot';
export const SPOT_MARKET = 'market';
export const SPOT_OBSERVATORY = 'observatory';
export const SPOT_FERRY = 'ferry';
export const SPOT_ARENA = 'arena';
export const SPOT_CLINIC = 'clinic';
export const SPOT_PAWNSHOP = 'pawnshop';
export const SPOT_LIGHTHOUSE = 'lighthouse';

function rect(x, y, width, height) {
  return { x, y, width, height };
}

function centre(r) {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

/** Which district a point falls in, by its block column/row. */
export function districtAt(x, y) {
  const col = Math.max(0, Math.min(2, Math.floor(x / (WORLD.width / 3))));
  const row = Math.max(0, Math.min(1, Math.floor(y / (WORLD.height / 2))));
  return NAMES.districts[row * 3 + col];
}

export function buildCity(rng) {
  const roads = [];
  for (const x of CITY.roadsX) {
    roads.push({ ...rect(x - CITY.roadWidth / 2, 0, CITY.roadWidth, CITY.beachY), vertical: true });
  }
  for (const y of CITY.roadsY) {
    roads.push({ ...rect(0, y - CITY.roadWidth / 2, WORLD.width, CITY.roadWidth), vertical: false });
  }

  const buildings = [];
  const parks = [];
  const trees = [];
  const lamps = [];
  const plazas = [];

  // One block between each pair of neighbouring roads (and the world edges).
  const xs = [0, ...CITY.roadsX, WORLD.width];
  const ys = [0, ...CITY.roadsY]; // last road (2820) is also the beach line
  let blockIndex = 0;
  for (let ix = 0; ix < xs.length - 1; ix += 1) {
    for (let iy = 0; iy < ys.length - 1; iy += 1) {
      blockIndex += 1;
      const left = xs[ix] + (ix === 0 ? 0 : CITY.roadWidth / 2) + CITY.sidewalk;
      const top = ys[iy] + (iy === 0 ? 0 : CITY.roadWidth / 2) + CITY.sidewalk;
      const right = xs[ix + 1] - (ix === xs.length - 2 ? 0 : CITY.roadWidth / 2) - CITY.sidewalk;
      const bottom = ys[iy + 1] - CITY.roadWidth / 2 - CITY.sidewalk;
      const bw = right - left;
      const bh = bottom - top;
      if (bw < 90 || bh < 90) continue;

      // Every seventh block is a park; the central block is the plaza.
      const isCentre = ix === 3 && iy === 2;
      if (isCentre) {
        plazas.push({ ...rect(left, top, bw, bh), name: 'Harbourlight Plaza' });
        continue;
      }
      if (blockIndex % 7 === 0) {
        parks.push({ ...rect(left, top, bw, bh), name: NAMES.districts[(ix + iy) % NAMES.districts.length] });
        for (let t = 0; t < 8; t += 1) {
          trees.push({ x: rng.range(left + 20, right - 20), y: rng.range(top + 20, bottom - 20), r: rng.range(10, 18) });
        }
        continue;
      }

      // Otherwise 1-4 buildings fill the block, with a courtyard gap.
      const rows = bw > 380 ? 2 : 1;
      const cols = bh > 380 ? 2 : 1;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          if (rng.chance(0.12)) continue; // empty lot / courtyard
          const bx = left + (c * bw) / cols + 12;
          const by = top + (r * bh) / rows + 12;
          const bwid = bw / cols - 24 - rng.range(0, 30);
          const bhei = bh / rows - 24 - rng.range(0, 30);
          if (bwid < 50 || bhei < 50) continue;
          buildings.push({
            ...rect(bx, by, bwid, bhei),
            storeys: rng.int(1, 3),
            roof: rng.pick(COLOURS.roof),
            district: districtAt(bx + bwid / 2, by + bhei / 2),
          });
        }
      }
      // A couple of street trees on the block corners.
      for (let t = 0; t < 2; t += 1) {
        trees.push({ x: rng.range(left, right), y: rng.range(top, bottom), r: rng.range(8, 13) });
      }
    }
  }

  // Street lamps along the roads, every other intersection corner.
  for (const x of CITY.roadsX) {
    for (const y of CITY.roadsY) {
      if ((x + y) % 2 === 0) lamps.push({ x: x + CITY.roadWidth / 2 + 8, y: y + CITY.roadWidth / 2 + 8 });
    }
  }

  // Named spots the story uses, each on a road so cars and missions reach them.
  const spots = {
    [SPOT_DEPOT]: { x: 760, y: 780, label: 'Harbourlight Depot' },
    [SPOT_MARKET]: { x: 2480, y: 1290, label: 'Lantern Market' },
    [SPOT_OBSERVATORY]: { x: 3660, y: 260, label: 'Copper Hill Observatory' },
    [SPOT_FERRY]: { x: 280, y: 2820, label: 'Salt Wharf Ferry' },
    [SPOT_ARENA]: { x: 3090, y: 2360, label: 'Ember Arena' },
    [SPOT_CLINIC]: { x: 1320, y: 1840, label: 'Juniper Clinic' },
    [SPOT_PAWNSHOP]: { x: 1950, y: 780, label: 'Glasswater Pawnshop' },
    [SPOT_LIGHTHOUSE]: { x: 4050, y: 2960, label: 'Lighthouse Point' },
  };

  // Traffic routes: the road centre lines, for Stage 2's traffic AI.
  const routes = [];
  for (const x of CITY.roadsX) routes.push({ vertical: true, at: x, from: 0, to: CITY.beachY });
  for (const y of CITY.roadsY) routes.push({ vertical: false, at: y, from: 0, to: WORLD.width });

  return {
    roads, buildings, parks, plazas, trees, lamps, spots, routes,
    streets: NAMES.streets,
    districts: NAMES.districts,
    beach: { ...rect(0, CITY.beachY, WORLD.width, WORLD.height - CITY.beachY) },
    roadPoint(x, y) { return { x, y }; },
    spotCentre(kind) {
      const s = spots[kind];
      return s ? { x: s.x, y: s.y } : { x: WORLD.width / 2, y: WORLD.height / 2 };
    },
    buildingAt(x, y) {
      return buildings.find((b) => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) || null;
    },
  };
}
