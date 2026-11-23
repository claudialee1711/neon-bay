// Collision for Neon Bay v2: a moving circle (the player, later a
// pedestrian) against the city's building rectangles, resolved axis by axis
// so the player slides along walls instead of sticking to them.
export function collidesWithBuildings(city, x, y, radius) {
  for (const b of city.buildings) {
    const nearestX = Math.max(b.x, Math.min(x, b.x + b.width));
    const nearestY = Math.max(b.y, Math.min(y, b.y + b.height));
    const dx = x - nearestX;
    const dy = y - nearestY;
    if (dx * dx + dy * dy < radius * radius) return b;
  }
  return null;
}

/** Move a circle by (dx, dy), sliding along buildings; returns the new spot. */
export function moveCircle(city, x, y, dx, dy, radius) {
  let nx = x + dx;
  if (!collidesWithBuildings(city, nx, y, radius)) x = nx;
  let ny = y + dy;
  if (!collidesWithBuildings(city, x, ny, radius)) y = ny;
  return { x, y };
}

/** True when the point is on a road (used for footstep / spawn checks). */
export function isOnRoad(city, x, y) {
  return city.roads.some((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
}
