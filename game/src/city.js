// The city of Neon Bay, generated once from a seed: the road grid, the blocks and
// buildings inside them, the parks and the beach, and the named places the story uses.
// Everything is plain data (rectangles, roads, points) so the world, the renderer and
// the minimap all read the same map, and the same seed always builds the same city.

import { CITY, WORLD } from './config.js';

export const SPOT_GARAGE = 'garage';
export const SPOT_DOCKS = 'docks';
export const SPOT_CLUB = 'club';
export const SPOT_BANK = 'bank';
export const SPOT_SAFEHOUSE = 'safehouse';
export const SPOT_WAREHOUSE = 'warehouse';
export const SPOT_CASINO = 'casino';
export const SPOT_MARINA = 'marina';
export const SPOT_HOSPITAL = 'hospital';
export const SPOT_GUNSTORE = 'gunstore';

function rect(x, y, width, height) {
  return { x, y, width, height };
}

function centre(r) {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

/** A point on a road centre line, used for traffic routes and spawns. */
function roadPoint(x, y) {
  return { x, y };
}

/**
 * Build the city. `random` is a seeded generator, so the layout is stable for a seed.
 * Returns roads, blocks, buildings, parks, trees, lamps, named spots and traffic routes.
 */
export function buildCity(random) {
  const roads = [];
  for (const x of CITY.roadsX) roads.push({ ...rect(x - CITY.roadWidth / 2, 0, CITY.roadWidth, CITY.beachY), vertical: true });
  for (const y of CITY.roadsY) roads.push({ ...rect(0, y - CITY.roadWidth / 2, WORLD.width, CITY.roadWidth), vertical: false });

  const buildings = [];
  const parks = [];
  const trees = [];
  const lamps = [];
  const roofColours = ['#5a4a63', '#4a5a63', '#63503f', '#3f4a5a', '#6b4a5a', '#4a6350'];

  // One block between each pair of neighbouring roads (and the world edges).
  const xs = [0, ...CITY.roadsX, WORLD.width];
  const ys = [0, ...CITY.roadsY, CITY.beachY];
  for (let ix = 0; ix < xs.length - 1; ix += 1) {
    for (let iy = 0; iy < ys.length - 1; iy += 1) {
      const left = xs[ix] + (ix === 0 ? 0 : CITY.roadWidth / 2) + CITY.sidewalk;
      const top = ys[iy] + (iy === 0 ? 0 : CITY.roadWidth / 2) + CITY.sidewalk;
      const right = xs[ix + 1] - (ix === xs.length - 2 ? 0 : CITY.roadWidth / 2) - CITY.sidewalk;
      const bottom = ys[iy + 1] - (iy === ys.length - 2 ? 0 : CITY.roadWidth / 2) - CITY.sidewalk;
      const bw = right - left;
      const bh = bottom - top;
      if (bw < 90 || bh < 90) continue;
      const cx = (left + right) / 2;
      const cy = (top + bottom) / 2;
      const downtown = Math.abs(cx - 1680) < 900 && Math.abs(cy - 1200) < 800;
      // A few blocks are parks, not buildings.
      if (random() < 0.12) {
        parks.push(rect(left, top, bw, bh));
        const treeCount = 3 + Math.floor(random() * 5);
        for (let t = 0; t < treeCount; t += 1) {
          trees.push({ x: left + 30 + random() * (bw - 60), y: top + 30 + random() * (bh - 60), r: 12 + random() * 8 });
        }
        continue;
      }
      const tall = downtown && random() < 0.6;
      const w = Math.min(bw - 40, tall ? 150 + random() * 90 : 110 + random() * 120);
      const h = Math.min(bh - 40, tall ? 150 + random() * 90 : 100 + random() * 110);
      const bx = left + (bw - w) / 2 + (random() - 0.5) * 20;
      const by = top + (bh - h) / 2 + (random() - 0.5) * 20;
      buildings.push({
        ...rect(bx, by, w, h),
        roof: roofColours[Math.floor(random() * roofColours.length)],
        // Storeys, not pixels: the rect height above is the footprint.
        floors: tall ? 3 + Math.floor(random() * 4) : 1 + Math.floor(random() * 2),
        lit: random(),
      });
      if (random() < 0.5) trees.push({ x: left + 20 + random() * 30, y: top + 20 + random() * 30, r: 10 + random() * 6 });
    }
  }

  // Street lamps along the roads, every other intersection corner.
  for (const x of CITY.roadsX) {
    for (const y of CITY.roadsY) {
      if ((x + y) % 960 === 0) lamps.push({ x: x + CITY.roadWidth / 2 + 8, y: y - CITY.roadWidth / 2 - 8 });
    }
  }

  // Named places the story and the missions use (fixed, so missions always find them).
  const spots = {
    [SPOT_GARAGE]: roadPoint(1680, 1200),
    [SPOT_DOCKS]: roadPoint(240, 720),
    [SPOT_CLUB]: roadPoint(3120, 1200),
    [SPOT_BANK]: roadPoint(1200, 1680),
    [SPOT_SAFEHOUSE]: roadPoint(3120, 240),
    [SPOT_WAREHOUSE]: roadPoint(720, 2160),
    [SPOT_CASINO]: roadPoint(3120, 1680),
    [SPOT_MARINA]: roadPoint(2160, 2760),
    [SPOT_HOSPITAL]: roadPoint(1200, 720),
    [SPOT_GUNSTORE]: roadPoint(2160, 1680),
  };

  // Traffic routes: rectangle loops on real roads, so cars keep moving.
  const routes = [];
  for (let i = 0; i < 8; i += 1) {
    const x1 = CITY.roadsX[i % CITY.roadsX.length];
    const x2 = CITY.roadsX[(i + 3) % CITY.roadsX.length];
    const y1 = CITY.roadsY[i % CITY.roadsY.length];
    const y2 = CITY.roadsY[(i + 2) % CITY.roadsY.length];
    routes.push([
      roadPoint(x1, y1), roadPoint(x1, y2), roadPoint(x2, y2), roadPoint(x2, y1),
    ]);
  }

  /** Where a parked car may sit: along a road edge, clear of intersections. */
  function parkingSpots() {
    const spotsList = [];
    for (const x of CITY.roadsX) {
      for (const y of CITY.roadsY) {
        if (random() < 0.55) spotsList.push({ x: x + CITY.roadWidth / 2 - 14, y: y + 90 + random() * 160, angle: Math.PI / 2 });
        if (random() < 0.55) spotsList.push({ x: x - CITY.roadWidth / 2 + 14, y: y + 90 + random() * 160, angle: -Math.PI / 2 });
      }
    }
    return spotsList;
  }

  /** A random point on a road, for spawning traffic and pedestrians. */
  function randomRoadPoint() {
    if (random() < 0.5) {
      return roadPoint(CITY.roadsX[Math.floor(random() * CITY.roadsX.length)], random() * CITY.beachY);
    }
    return roadPoint(random() * WORLD.width, CITY.roadsY[Math.floor(random() * CITY.roadsY.length)]);
  }

  /** The nearest road centre line to a point (used to snap the player back to a road). */
  function nearestRoad(x, y) {
    let best = { x: CITY.roadsX[0], y };
    let bestD = Infinity;
    for (const rx of CITY.roadsX) {
      const d = Math.abs(rx - x);
      if (d < bestD) { bestD = d; best = { x: rx, y }; }
    }
    for (const ry of CITY.roadsY) {
      const d = Math.abs(ry - y);
      if (d < bestD) { bestD = d; best = { x, y: ry }; }
    }
    return best;
  }

  return {
    roads, buildings, parks, trees, lamps, spots, routes, parkingSpots, randomRoadPoint, nearestRoad,
    /** The player's starting point: outside Mara's garage, downtown. */
    playerStart: { x: 1680, y: 1330 },
    centre,
  };
}
