// The renderer for Neon Bay v2: one canvas, top-down, drawing the city in
// layers — ground, beach and sea, parks and plaza, roads, buildings with
// height shading, trees and lamps, named spots, the player, then weather
// and a placeholder HUD with a small minimap (the full HUD lands in Stage 3).
import { CITY, COLOURS, NAMES, VIEW, WORLD } from './constants.js';
import { districtAt } from './citygen.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let walkPhase = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  function draw(state, dt) {
    const { city, player, camera, weather, vehicles, pedestrians, effects } = state;
    walkPhase += dt * (player.moving ? player.speed / 28 : 0);
    const scale = canvas.width / VIEW.width;
    const viewH = canvas.height / scale;
    const vx = camera.x;
    const vy = camera.y;
    const vw = VIEW.width;
    const vh = viewH;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // World layer: translate so the camera's top-left lands at the origin.
    ctx.setTransform(scale, 0, 0, scale, -vx * scale, -vy * scale);

    // Ground.
    ctx.fillStyle = COLOURS.ground;
    ctx.fillRect(vx, vy, vw, vh);
    // Dry patches in Juniper Fields (north).
    ctx.fillStyle = COLOURS.groundDry;
    ctx.fillRect(vx, Math.max(vy, 0), vw, Math.max(0, Math.min(CITY.greenY, vy + vh) - Math.max(vy, 0)));

    // Sea and sand, south of the beach line.
    ctx.fillStyle = COLOURS.sand;
    ctx.fillRect(vx, Math.max(vy, CITY.beachY), vw, Math.max(0, vy + vh - Math.max(vy, CITY.beachY)));
    ctx.fillStyle = COLOURS.sea;
    ctx.fillRect(vx, Math.max(vy, CITY.beachY + 90), vw, Math.max(0, vy + vh - Math.max(vy, CITY.beachY + 90)));
    ctx.fillStyle = COLOURS.seaDeep;
    for (let i = 0; i < 6; i += 1) {
      const wy = CITY.beachY + 150 + i * 38;
      if (wy < vy || wy > vy + vh) continue;
      ctx.fillRect(vx, wy, vw, 5);
    }

    // Parks and the plaza.
    for (const p of city.parks) {
      if (!visible(p, vx, vy, vw, vh)) continue;
      ctx.fillStyle = COLOURS.park;
      ctx.fillRect(p.x, p.y, p.width, p.height);
      ctx.strokeStyle = '#3a6b2e';
      ctx.lineWidth = 3;
      ctx.strokeRect(p.x, p.y, p.width, p.height);
    }
    for (const p of city.plazas) {
      if (!visible(p, vx, vy, vw, vh)) continue;
      ctx.fillStyle = COLOURS.plaza;
      ctx.fillRect(p.x, p.y, p.width, p.height);
      ctx.strokeStyle = '#7a7268';
      ctx.lineWidth = 4;
      ctx.strokeRect(p.x + 8, p.y + 8, p.width - 16, p.height - 16);
    }

    // Roads: dark asphalt, pale sidewalks, dashed centre lines.
    for (const r of city.roads) {
      if (!visible(r, vx, vy, vw, vh)) continue;
      ctx.fillStyle = COLOURS.sidewalk;
      ctx.fillRect(r.x - 6, r.y - 6, r.width + 12, r.height + 12);
      ctx.fillStyle = COLOURS.road;
      ctx.fillRect(r.x, r.y, r.width, r.height);
      ctx.strokeStyle = COLOURS.lane;
      ctx.lineWidth = 3;
      ctx.setLineDash([26, 30]);
      ctx.beginPath();
      if (r.vertical) {
        ctx.moveTo(r.x + r.width / 2, Math.max(r.y, vy));
        ctx.lineTo(r.x + r.width / 2, Math.min(r.y + r.height, vy + vh));
      } else {
        ctx.moveTo(Math.max(r.x, vx), r.y + r.height / 2);
        ctx.lineTo(Math.min(r.x + r.width, vx + vw), r.y + r.height / 2);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Buildings: shadow offset by height, roof, and a lighter top edge.
    for (const b of city.buildings) {
      if (!visible(b, vx, vy, vw, vh)) continue;
      const off = b.storeys * 5;
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.fillRect(b.x + off, b.y + off, b.width, b.height);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.width, b.height);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.width - 2, b.height - 2);
      // Rooftop detail: a darker inset for taller blocks.
      if (b.storeys >= 2) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(b.x + 10, b.y + 10, b.width - 20, b.height - 20);
      }
    }

    // Trees and lamps.
    for (const t of city.trees) {
      if (t.x < vx - 30 || t.x > vx + vw + 30 || t.y < vy - 30 || t.y > vy + vh + 30) continue;
      ctx.fillStyle = '#2e5d23';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f7d31';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#d8c56a';
    for (const l of city.lamps) {
      if (l.x < vx || l.x > vx + vw || l.y < vy || l.y > vy + vh) continue;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Named spots: a marker and label.
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const [kind, s] of Object.entries(city.spots)) {
      if (s.x < vx - 80 || s.x > vx + vw + 80 || s.y < vy - 40 || s.y > vy + vh + 40) continue;
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillText('★', s.x, s.y + 5);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(s.label, s.x, s.y - 16);
    }

    drawSkids(effects, vx, vy, vw, vh);
    drawCars(vehicles, vx, vy, vw, vh);
    drawPedestrians(pedestrians, vx, vy, vw, vh);
    if (!player.inCar) drawPlayer(player);
    drawParticles(effects, vx, vy, vw, vh);
    drawWeatherOverlay(weather, vx, vy, vw, vh);
    // HUD layer: back to screen space (no camera translation).
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawHud(state, vw, vh);
  }

  function drawSkids(effects, vx, vy, vw, vh) {
    if (!effects) return;
    ctx.strokeStyle = 'rgba(12,12,14,0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (const s of effects.skids) {
      if (s.x1 < vx - 20 || s.x1 > vx + vw + 20 || s.y1 < vy - 20 || s.y1 > vy + vh + 20) continue;
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }
    ctx.stroke();
  }

  function drawCars(vehicles, vx, vy, vw, vh) {
    if (!vehicles) return;
    for (const car of vehicles.cars) {
      if (car.x < vx - 60 || car.x > vx + vw + 60 || car.y < vy - 60 || car.y > vy + vh + 60) continue;
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-car.length / 2 + 3, -car.width / 2 + 4, car.length, car.width);
      ctx.fillStyle = car.colour;
      ctx.beginPath();
      ctx.roundRect(-car.length / 2, -car.width / 2, car.length, car.width, 7);
      ctx.fill();
      // Roof, windshield and headlights.
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(-car.length * 0.18, -car.width * 0.36, car.length * 0.36, car.width * 0.72);
      ctx.fillStyle = '#bcd8ea';
      ctx.fillRect(car.length * 0.22, -car.width * 0.36, 5, car.width * 0.72);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(car.length / 2 - 3, -car.width / 2 + 2, 3, 5);
      ctx.fillRect(car.length / 2 - 3, car.width / 2 - 7, 3, 5);
      ctx.restore();
      if (car.kind === 'player') {
        ctx.strokeStyle = '#ffd94d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(car.x, car.y, car.length * 0.62, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawPedestrians(pedestrians, vx, vy, vw, vh) {
    if (!pedestrians) return;
    for (const p of pedestrians.list) {
      if (p.x < vx - 20 || p.x > vx + vw + 20 || p.y < vy - 20 || p.y > vy + vh + 20) continue;
      if (p.state === 'down') {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(p.x + 2, p.y + 3, 11, 6, p.angle, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.colour;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 11, 6, p.angle, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(p.x + 2, p.y + 3, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.colour;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8c9a0';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 2, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles(effects, vx, vy, vw, vh) {
    if (!effects) return;
    for (const p of effects.particles) {
      if (p.x < vx - 20 || p.x > vx + vw + 20 || p.y < vy - 20 || p.y > vy + vh + 20) continue;
      const a = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.kind === 'spark' ? `rgba(255,210,90,${a})` : p.kind === 'dust' ? `rgba(190,170,130,${a * 0.6})` : `rgba(160,160,160,${a * 0.45})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.kind === 'smoke' ? 1 + (1 - a) : 1), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer(player) {
    const px = player.x;
    const py = player.y;
    // Shadow, then a walking figure: body, head, facing wedge, bobbing feet.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(px + 3, py + 5, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    const bob = player.moving ? Math.sin(walkPhase) * 3 : 0;
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath();
    ctx.arc(px, py + bob * 0.4, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b6cb0';
    ctx.beginPath();
    ctx.arc(px, py - 2 + bob * 0.4, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(player.angle) * 20, py + Math.sin(player.angle) * 20);
    ctx.lineTo(px + Math.cos(player.angle + 2.6) * 10, py + Math.sin(player.angle + 2.6) * 10);
    ctx.lineTo(px + Math.cos(player.angle - 2.6) * 10, py + Math.sin(player.angle - 2.6) * 10);
    ctx.closePath();
    ctx.fill();
  }

  function drawWeatherOverlay(weather, vx, vy, vw, vh) {
    if (weather.kind === 'cloudy' || weather.kind === 'rain') {
      ctx.fillStyle = `rgba(20,30,45,${0.14 * weather.blend})`;
      ctx.fillRect(vx, vy, vw, vh);
      ctx.fillStyle = `rgba(10,16,26,${0.10 * weather.blend})`;
      for (const c of weather.clouds) {
        if (c.x < vx - c.r || c.x > vx + vw + c.r || c.y < vy - c.r || c.y > vy + vh + c.r) continue;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.r, c.r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (weather.kind === 'rain') {
      ctx.strokeStyle = `rgba(180,210,235,${0.55 * weather.blend})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const d of weather.drops) {
        ctx.moveTo(vx + d.x, vy + d.y);
        ctx.lineTo(vx + d.x - 6, vy + d.y + 18);
      }
      ctx.stroke();
    }
    if (weather.kind === 'dusk') {
      ctx.fillStyle = `rgba(255,120,40,${0.10 * weather.blend})`;
      ctx.fillRect(vx, vy, vw, vh);
      ctx.fillStyle = `rgba(20,10,40,${0.18 * weather.blend})`;
      ctx.fillRect(vx, vy, vw, vh);
    }
  }

  function drawHud(state, vw, vh) {
    const { city, player, weather, camera } = state;
    // Top-left: city, district, weather. Full HUD (health/money/stars) is Stage 3.
    ctx.textAlign = 'left';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(12, 12, 330, 78);
    ctx.fillStyle = '#fff';
    ctx.fillText(NAMES.city, 24, 38);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#cfe3ff';
    ctx.fillText(`${districtAt(player.x, player.y)}  •  ${weather.label()}`, 24, 62);
    ctx.fillStyle = '#ffd94d';
    ctx.fillText(player.inCar ? 'Driving — WASD drive, Space brake, E to get out' : 'On foot — WASD move, Shift run, E near a car to steal it', 24, 82);

    // Small minimap, bottom-right: roads, sea, spots, player dot.
    const mw = 210;
    const mh = 160;
    const mx = vw - mw - 14;
    const my = vh - mh - 14;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.fillStyle = '#2f4a2f';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#2a6f8e';
    ctx.fillRect(mx, my + CITY.beachY * sy, mw, mh - CITY.beachY * sy);
    ctx.fillStyle = '#555';
    for (const r of city.roads) ctx.fillRect(mx + r.x * sx, my + r.y * sy, Math.max(1, r.width * sx), Math.max(1, r.height * sy));
    ctx.fillStyle = '#ffd94d';
    for (const s of Object.values(city.spots)) {
      ctx.beginPath();
      ctx.arc(mx + s.x * sx, my + s.y * sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.vehicles) {
      ctx.fillStyle = '#9fd8ff';
      for (const car of state.vehicles.cars) {
        ctx.fillRect(mx + car.x * sx - 1, my + car.y * sy - 1, 2.5, 2.5);
      }
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(mx + player.x * sx, my + player.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 2;
    ctx.strokeRect(mx + camera.x * sx, my + camera.y * sy, VIEW.width * sx, vh * sy);
  }

  function visible(r, vx, vy, vw, vh) {
    return r.x + r.width >= vx - 20 && r.x <= vx + vw + 20 && r.y + r.height >= vy - 20 && r.y <= vy + vh + 20;
  }

  return { draw, resize };
}
