// The renderer: the city, the cars and the people, the day/night light, and the
// HUD (health, money, wanted stars, minimap, mission objective, speed, clock).
// One canvas, one logical viewport (1280x720) scaled to the window, camera
// following the player. No layout depends on the window size.

import { CAR, CITY, FONT, PALETTE, VIEW, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_COMPLETE = 'complete';

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** How dark the world is at this hour: 0 at noon, up to 0.5 at midnight. */
export function darknessAt(hour) {
  if (hour >= 8 && hour < 17) return 0;
  if (hour >= 17 && hour < 19) return (hour - 17) / 2 * 0.28;
  if (hour >= 19 || hour < 5) return 0.5;
  if (hour >= 5 && hour < 8) return (8 - hour) / 3 * 0.5;
  return 0;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewScale = 1;
  let viewOX = 0;
  let viewOY = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    viewScale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    viewOX = (canvas.width - VIEW.width * viewScale) / 2;
    viewOY = (canvas.height - VIEW.height * viewScale) / 2;
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCar(x, y, angle, color, isPolice, headlights) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    rr(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width, 8);
    ctx.fill();
    ctx.fillStyle = color;
    rr(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,26,34,0.9)';
    rr(-8, -CAR.width / 2 + 4, 16, CAR.width - 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(CAR.length / 2 - 8, -CAR.width / 2 + 3, 3, 5);
    ctx.fillRect(CAR.length / 2 - 8, CAR.width / 2 - 8, 3, 5);
    if (isPolice) {
      const flash = Math.floor(performance.now() / 180) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#2f7bff';
      ctx.fillRect(-4, -CAR.width / 2 + 1, 8, 6);
      ctx.fillStyle = flash ? '#2f7bff' : '#ff3b30';
      ctx.fillRect(-4, CAR.width / 2 - 7, 8, 6);
    }
    if (headlights) {
      ctx.fillStyle = 'rgba(255, 230, 140, 0.85)';
      ctx.beginPath();
      ctx.arc(CAR.length / 2, -CAR.width / 2 + 5, 3, 0, Math.PI * 2);
      ctx.arc(CAR.length / 2, CAR.width / 2 - 5, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, color, gun) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(2, 3, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.rotate(angle);
    ctx.fillStyle = '#2c2530';
    ctx.fillRect(8, -3, 10, 6);
    if (gun) {
      ctx.strokeStyle = '#1c1c22';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(26, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWorld(state) {
    const city = state.city;
    const p = state.player;
    const camX = clamp(p.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    const camY = clamp(p.y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const night = darknessAt(state.clock);

    ctx.save();
    ctx.translate(viewOX, viewOY);
    ctx.scale(viewScale, viewScale);
    ctx.translate(-camX + shakeX, -camY + shakeY);

    const vx0 = camX - 60;
    const vy0 = camY - 60;
    const vx1 = camX + VIEW.width + 60;
    const vy1 = camY + VIEW.height + 60;
    const visible = (r) => r.x < vx1 && r.x + r.width > vx0 && r.y < vy1 && r.y + r.height > vy0;

    // Ground: grass, then the beach and the sea along the south edge.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(vx0, CITY.beachY, vx1 - vx0, WORLD.height - CITY.beachY);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(vx0, CITY.beachY + 120, vx1 - vx0, WORLD.height - CITY.beachY - 120);
    ctx.fillStyle = PALETTE.seaDeep;
    for (let i = 0; i < 8; i += 1) {
      ctx.fillRect(vx0 + ((i * 613) % (vx1 - vx0)), CITY.beachY + 150 + (i % 3) * 60, 180, 8);
    }
    for (const park of city.parks) {
      if (!visible(park)) continue;
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.width, park.height);
    }

    // Roads: asphalt, then a dashed centre line.
    for (const road of city.roads) {
      if (!visible(road)) continue;
      ctx.fillStyle = PALETTE.asphalt;
      ctx.fillRect(road.x, road.y, road.width, road.height);
      ctx.strokeStyle = PALETTE.roadLine;
      ctx.lineWidth = 3;
      ctx.setLineDash([26, 22]);
      ctx.beginPath();
      if (road.vertical) {
        ctx.moveTo(road.x + road.width / 2, road.y);
        ctx.lineTo(road.x + road.width / 2, road.y + road.height);
      } else {
        ctx.moveTo(road.x, road.y + road.height / 2);
        ctx.lineTo(road.x + road.width, road.y + road.height / 2);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Buildings: roof, edge, and windows (lit at night).
    for (const b of city.buildings) {
      if (!visible(b)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x + 6, b.y + 8, b.width, b.height);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.width, b.height);
      ctx.strokeStyle = PALETTE.buildingEdge;
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x, b.y, b.width, b.height);
      const cols = Math.max(2, Math.floor(b.width / 34));
      const rows = Math.max(2, Math.floor(b.height / 34));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          const lit = ((cx * 7 + cy * 13 + Math.floor(b.lit * 100)) % 5) < 2;
          ctx.fillStyle = night > 0.25 && lit ? PALETTE.windowLit : PALETTE.windowDark;
          ctx.fillRect(b.x + 10 + cx * ((b.width - 20) / cols), b.y + 10 + cy * ((b.height - 20) / rows), 12, 10);
        }
      }
    }

    // Trees and street lamps.
    for (const t of city.trees) {
      if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.treeTop;
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const lamp of city.lamps) {
      if (lamp.x < vx0 || lamp.x > vx1 || lamp.y < vy0 || lamp.y > vy1) continue;
      ctx.fillStyle = '#3a3f46';
      ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 10);
      if (night > 0.25) {
        ctx.fillStyle = 'rgba(255, 214, 106, 0.9)';
        ctx.beginPath();
        ctx.arc(lamp.x, lamp.y - 4, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Skid marks.
    ctx.strokeStyle = 'rgba(20,20,24,0.55)';
    ctx.lineWidth = 5;
    for (const sk of state.skids) {
      ctx.globalAlpha = Math.min(1, sk.life / 3);
      ctx.beginPath();
      ctx.moveTo(sk.x, sk.y);
      ctx.lineTo(sk.x - Math.cos(sk.angle) * 26, sk.y - Math.sin(sk.angle) * 26);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Pickups.
    for (const pk of state.pickups) {
      const bob = Math.sin(state.elapsed * 3 + pk.bob) * 3;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      if (pk.kind === 'health') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-11, -11, 22, 22);
        ctx.fillStyle = PALETTE.health;
        ctx.fillRect(-3, -9, 6, 18);
        ctx.fillRect(-9, -3, 18, 6);
      } else if (pk.kind === 'ammo') {
        ctx.fillStyle = '#2c2530';
        ctx.fillRect(-11, -8, 22, 16);
        ctx.fillStyle = PALETTE.ammo;
        ctx.fillRect(-7, -4, 14, 8);
      } else {
        ctx.fillStyle = PALETTE.money;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0c2a16';
        ctx.font = 'bold 13px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 1);
      }
      ctx.restore();
    }

    // Mission marker: a pulsing diamond and a beam, so the goal is never lost.
    const marker = state.missionMarker;
    if (marker) {
      const pulse = 1 + Math.sin(state.elapsed * 4) * 0.15;
      ctx.save();
      ctx.translate(marker.x, marker.y);
      ctx.scale(pulse, pulse);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = PALETTE.marker;
      ctx.fillRect(-14, -14, 28, 28);
      ctx.strokeStyle = '#7a5c00';
      ctx.lineWidth = 3;
      ctx.strokeRect(-14, -14, 28, 28);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255, 210, 63, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(marker.x, marker.y - 90);
      ctx.lineTo(marker.x, marker.y - 20);
      ctx.stroke();
    }

    // Cars.
    for (const car of state.cars) {
      if (car.dead) continue;
      if (car.x < vx0 || car.x > vx1 || car.y < vy0 || car.y > vy1) continue;
      drawCar(car.x, car.y, car.angle, car.color, car.kind === 'police', night > 0.25);
      if (car.health < 45 && car.kind !== 'parked') {
        ctx.fillStyle = 'rgba(90,90,90,0.7)';
        ctx.beginPath();
        ctx.arc(car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, 6 + Math.random() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // People: pedestrians, foot cops, rivals, then the player.
    for (const ped of state.pedestrians) {
      if (ped.down > 0) {
        ctx.save();
        ctx.translate(ped.x, ped.y);
        ctx.rotate(0.6);
        ctx.fillStyle = ped.color;
        ctx.fillRect(-11, -5, 22, 10);
        ctx.restore();
        continue;
      }
      if (ped.x < vx0 || ped.x > vx1 || ped.y < vy0 || ped.y > vy1) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.color, false);
    }
    for (const cop of state.footCops) {
      if (cop.dead) continue;
      drawPerson(cop.x, cop.y, cop.angle, '#2f6fd0', false);
    }
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      drawPerson(enemy.x, enemy.y, enemy.angle, '#b03060', true);
      ctx.fillStyle = '#1c1c22';
      ctx.fillRect(enemy.x - 14, enemy.y - 22, 28, 5);
      ctx.fillStyle = '#ff5a7a';
      ctx.fillRect(enemy.x - 14, enemy.y - 22, 28 * Math.max(0, enemy.health / 60), 5);
    }
    if (!p.inCar) {
      drawPerson(p.x, p.y, p.angle, PALETTE.player, true);
      if (p.invulnerable > 0 && Math.floor(state.elapsed * 8) % 2 === 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Particles.
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Night falls over the city; headlights and lamps cut through it.
    if (night > 0) {
      ctx.fillStyle = `rgba(6, 10, 26, ${night})`;
      ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
      ctx.fillStyle = 'rgba(255, 230, 140, 0.10)';
      if (p.inCar) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.beginPath();
        ctx.moveTo(20, -12);
        ctx.lineTo(260, -70);
        ctx.lineTo(260, 70);
        ctx.lineTo(20, 12);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      for (const lamp of city.lamps) {
        if (lamp.x < vx0 || lamp.x > vx1 || lamp.y < vy0 || lamp.y > vy1) continue;
        const g = ctx.createRadialGradient(lamp.x, lamp.y, 4, lamp.x, lamp.y, 90);
        g.addColorStop(0, 'rgba(255, 214, 106, 0.20)');
        g.addColorStop(1, 'rgba(255, 214, 106, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(lamp.x - 90, lamp.y - 90, 180, 180);
      }
    }
    ctx.restore();
  }

  function drawMinimap(state, missionSpot) {
    const mw = 208;
    const mh = 156;
    const mx = VIEW.width - mw - 16;
    const my = VIEW.height - mh - 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.save();
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelBorder;
    ctx.lineWidth = 1;
    rr(mx, my, mw, mh, 8);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    rr(mx, my, mw, mh, 8);
    ctx.clip();
    ctx.translate(mx, my);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (const road of state.city.roads) {
      ctx.beginPath();
      if (road.vertical) {
        ctx.moveTo(road.x * sx, road.y * sy);
        ctx.lineTo((road.x + road.width) * sx, (road.y + road.height) * sy);
        ctx.moveTo((road.x + road.width) * sx, road.y * sy);
        ctx.lineTo(road.x * sx, (road.y + road.height) * sy);
      } else {
        ctx.moveTo(road.x * sx, road.y * sy);
        ctx.lineTo((road.x + road.width) * sx, road.y * sy);
        ctx.moveTo(road.x * sx, (road.y + road.height) * sy);
        ctx.lineTo((road.x + road.width) * sx, (road.y + road.height) * sy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#1d6f8e';
    ctx.fillRect(0, CITY.beachY * sy, mw, mh - CITY.beachY * sy);
    if (missionSpot) {
      const pulse = 1 + Math.sin(state.elapsed * 5) * 0.25;
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(missionSpot.x * sx, missionSpot.y * sy, 6 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.cars) {
      if (car.dead || car.kind === 'parked') continue;
      ctx.fillStyle = car.kind === 'police' ? '#ff4d4d' : 'rgba(255,255,255,0.7)';
      ctx.fillRect(car.x * sx - 1.5, car.y * sy - 1.5, 3, 3);
    }
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      ctx.fillStyle = '#ff5a7a';
      ctx.fillRect(enemy.x * sx - 2, enemy.y * sy - 2, 4, 4);
    }
    const p = state.player;
    ctx.save();
    ctx.translate(p.x * sx, p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(mx + 0.5, my + 0.5, mw - 1, mh - 1);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '11px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('NEON BAY', mx + 6, my - 6);
    ctx.restore();
  }

  function drawHud(state, hud) {
    const p = state.player;
    ctx.save();
    ctx.translate(viewOX, viewOY);
    ctx.scale(viewScale, viewScale);

    // Top-left: health, money, ammo.
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelBorder;
    rr(16, 14, 250, 74, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 15px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`$${Math.floor(p.money)}`, 30, 32);
    ctx.fillStyle = '#1c1c22';
    ctx.fillRect(30, 48, 150, 12);
    ctx.fillStyle = p.health > 30 ? PALETTE.health : '#ff4d4d';
    ctx.fillRect(30, 48, 150 * Math.max(0, p.health / 100), 12);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px ' + FONT;
    ctx.fillText(`AMMO ${p.ammo}`, 196, 54);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 13px ' + FONT;
    ctx.fillText(p.inCar ? 'DRIVING' : 'ON FOOT', 30, 76);

    // Top-right: wanted stars and the clock.
    ctx.fillStyle = PALETTE.panel;
    rr(VIEW.width - 266, 14, 250, 74, 10);
    ctx.fill();
    ctx.stroke();
    const hour = Math.floor(state.clock) % 24;
    const min = Math.floor((state.clock % 1) * 60);
    const clockText = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 15px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillText(clockText, VIEW.width - 30, 32);
    ctx.font = '22px ' + FONT;
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.stars ? '★' : '☆';
    ctx.fillStyle = state.stars > 0 ? PALETTE.wanted : PALETTE.muted;
    ctx.fillText(stars, VIEW.width - 30, 62);
    ctx.textAlign = 'left';

    // Speed, when driving.
    if (p.inCar) {
      ctx.fillStyle = PALETTE.panel;
      rr(16, VIEW.height - 66, 130, 50, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 22px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(Math.abs(p.inCar.speed) * 0.22)}`, 81, VIEW.height - 34);
      ctx.font = '11px ' + FONT;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('MPH', 81, VIEW.height - 20);
      ctx.textAlign = 'left';
    }

    // Mission objective, top centre, wrapped to at most two lines.
    if (hud.objective) {
      ctx.font = 'bold 15px ' + FONT;
      const words = hud.objective.split(' ');
      const lines = [''];
      for (const word of words) {
        const trial = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + word : word;
        if (ctx.measureText(trial).width > 700 && lines.length < 2) lines.push(word);
        else lines[lines.length - 1] = trial;
      }
      const w = Math.min(760, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 36);
      const h = 14 + lines.length * 20 + 8;
      ctx.fillStyle = PALETTE.panel;
      rr((VIEW.width - w) / 2, 14, w, h, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.textAlign = 'center';
      lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 32 + i * 20));
      ctx.textAlign = 'left';
    }

    // Context prompt, bottom centre.
    if (hud.prompt) {
      ctx.font = '15px ' + FONT;
      const w = ctx.measureText(hud.prompt).width + 32;
      ctx.fillStyle = 'rgba(12,16,22,0.85)';
      rr((VIEW.width - w) / 2, VIEW.height - 52, w, 32, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.textAlign = 'center';
      ctx.fillText(hud.prompt, VIEW.width / 2, VIEW.height - 35);
      ctx.textAlign = 'left';
    }

    // Transient centre message (mission complete, busted, ...).
    if (hud.message) {
      ctx.font = 'bold 34px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const w = ctx.measureText(hud.message).width + 60;
      rr((VIEW.width - w) / 2, VIEW.height / 2 - 110, w, 58, 12);
      ctx.fill();
      ctx.fillStyle = hud.messageColor || '#ffd23f';
      ctx.fillText(hud.message, VIEW.width / 2, VIEW.height / 2 - 80);
      ctx.textAlign = 'left';
    }

    drawMinimap(state, hud.missionSpot);
    ctx.restore();
  }

  function overlay(title, lines, hint) {
    ctx.save();
    ctx.translate(viewOX, viewOY);
    ctx.scale(viewScale, viewScale);
    ctx.fillStyle = 'rgba(8, 12, 20, 0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 64px ' + FONT;
    ctx.fillText(title, VIEW.width / 2, VIEW.height / 2 - 90);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '18px ' + FONT;
    let y = VIEW.height / 2 - 30;
    for (const line of lines) {
      ctx.fillText(line, VIEW.width / 2, y);
      y += 30;
    }
    if (hint) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '16px ' + FONT;
      ctx.fillText(hint, VIEW.width / 2, y + 30);
    }
    ctx.restore();
  }

  function draw(state, screen, hud) {
    resize();
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (screen === SCREEN_TITLE) {
      drawWorld(state);
      overlay('NEON BAY', [
        'A sun-soaked open-world crime story.',
        hud.storyLine || '',
        '',
        'WASD drive & walk · E enter a car · F carjack · Mouse aim, click to shoot',
        'P pause · M mute · Your progress saves as you play.',
      ], hud.hasSave ? 'Press Enter to continue, or N for a new game' : 'Press Enter to start');
      return;
    }
    drawWorld(state);
    if (screen === SCREEN_PLAY) {
      drawHud(state, hud);
      return;
    }
    drawHud(state, hud);
    if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['Take a breath. The city waits.'], 'Press P or Enter to keep playing');
    } else if (screen === SCREEN_BUSTED) {
      overlay('BUSTED', ['The Neon Bay PD caught you.', hud.bustedLine || ''], 'Press Enter to walk free and try again');
    } else if (screen === SCREEN_OVER) {
      overlay('WASTED', ['Rex is down. The crew picks up the pieces.', hud.wastedLine || ''], 'Press Enter to get back on your feet');
    } else if (screen === SCREEN_COMPLETE) {
      overlay('THE BIG SCORE', [
        'The vault is empty, the boat is waiting, and the sun is coming up',
        'over Marina Beach. Neon Bay is yours, Rex.',
        '',
        `Money: $${Math.floor(state.player.money)} · Cars stolen: ${state.carsStolen} · Takedowns: ${state.kills}`,
      ], 'Press Enter to keep cruising the city');
    }
  }

  return { draw, resize };
}
