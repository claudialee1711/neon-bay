# Neon Bay — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/claudialee1711/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/claudialee1711/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Built for the [make.fun](https://make.fun/bounty/gta6-01) **Make GTA 6** bounty (gta6-01): a complete 2D top-down open-world crime game that runs in a desktop browser from plain static files — no build step, no network requests, everything original.

## The city

Neon Bay is a sun-soaked coastal city, procedurally built from seed **77031** into a 4200×3200 world: an irregular 7×6 road grid, 67 buildings, 5 parks, Harbourlight Plaza, a beach and sea to the south, and districts with their own character — Glasswater Quarter, Foundry Row, Lantern Market, Copper Hill, Salt Wharf and Juniper Fields. The weather is alive, cycling sunny → overcast → rain → dusk, and rain makes the roads slick.

## What you can do

- **Explore on foot and by car** — walk the sidewalks or steal one of the parked cars (E to get in and out) and drive it. Four vehicle classes — Pipit Hatch, Merak Sedan, Kargo Van, Sambar GT — each with its own speed and handling. Traffic drives the road grid around you and 36 pedestrians wander the sidewalks.
- **Outrun the law** — a wanted level from 0 to 5 stars. Steal a moving car, knock down a pedestrian or open fire and the police respond: patrol cars chase and ram, foot cops chase and arrest. Lay low and the heat slowly cools off. Get caught and you're busted; run out of health and you're wasted.
- **Fight** — pistol (mouse aim, click to fire) and melee (F), with ammo and medkit pickups that respawn around the city.
- **Run the story** — five missions for courier **Rani Kestrel**, working against fixer **Mara Voss**: a first errand at Harbourlight Depot, a timed delivery through Lantern Market, a handoff at Copper Hill Observatory, a getaway from Ember Arena, and a final run to Lighthouse Point. Missions pay out in cash, with markers on the map and minimap and a timer where it counts.
- **Feel it** — a full HUD (health, money, ammo, wanted stars, clock, speed, objective, minimap), skid marks and exhaust, and a fully synthesised WebAudio soundscape: engine hum, sirens, gunshots, pickups and mission jingles (M to mute).
- **Keep your progress** — save with X (autosaves on mission completion) and continue from the title screen; progress lives in localStorage.

## How to play

```sh
node serve.ts
# then open http://localhost:8080
```

| Keys | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Shift | Run |
| E | Enter / exit car |
| Space | Handbrake |
| Mouse + click | Aim / shoot pistol |
| F | Melee |
| X | Save |
| P | Pause |
| M | Mute |
| N | Continue (title screen) |

## Under the hood

The game is 21 focused modules under `game/src/` — city generation (`citygen.js`), weather (`weather.js`), vehicles and traffic AI (`vehicles.js`), pedestrians (`pedestrians.js`), police (`police.js`), combat (`combat.js`), missions (`missions.js`), audio (`audio.js`), save (`save.js`) and screens (`screens.js`) — loaded from `game/index.html` and served by `serve.ts`. `main.ts` at the repo root hands the entry in: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json`.

## Screenshots

Four screenshots of the game itself live in `screenshots/` — driving with the HUD and minimap, a mission on foot, a police chase, and the city at dusk.

---

<sub>Entered on [make.fun](https://make.fun/?ref=vvk4eerf&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
