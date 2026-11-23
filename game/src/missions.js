// Missions for Neon Bay v2: a five-job story chain for Rani Kestrel, a
// courier who owes money to fixer Mara Voss. Each mission is one or two
// legs to a named spot, with a marker on the map and minimap, a reward
// in cash, and a fail state (timer out, busted or wasted) that retries
// the same job. The last job ends the story on the complete screen.
// All names and characters are invented for this game.
import { SPOT_DEPOT, SPOT_MARKET, SPOT_OBSERVATORY, SPOT_FERRY, SPOT_ARENA, SPOT_LIGHTHOUSE, SPOT_CLINIC } from './citygen.js';

const MISSION_DEFS = [
  {
    id: 'first-errand', name: 'First Errand', giver: 'Mara Voss',
    brief: 'Mara Voss needs a parcel moved, no questions. Pick it up at Harbourlight Depot.',
    legs: [{ spot: SPOT_DEPOT, text: 'Pick up the parcel at Harbourlight Depot' }],
    reward: 150, timeLimit: 0,
  },
  {
    id: 'lantern-run', name: 'Lantern Run', giver: 'Mara Voss',
    brief: 'The parcel is hot. Get it to the Lantern Market stall before the lunch crowd thins out.',
    legs: [{ spot: SPOT_MARKET, text: 'Deliver the parcel to Lantern Market (90 s)' }],
    reward: 250, timeLimit: 90,
  },
  {
    id: 'observatory-handoff', name: 'The Observatory Handoff', giver: 'Dara Quinn',
    brief: 'Dara Quinn trades in sky charts and secrets. Meet her at Copper Hill Observatory, then slip away to the Salt Wharf Ferry.',
    legs: [
      { spot: SPOT_OBSERVATORY, text: 'Meet Dara Quinn at Copper Hill Observatory' },
      { spot: SPOT_FERRY, text: 'Slip away to the Salt Wharf Ferry' },
    ],
    reward: 400, timeLimit: 150,
  },
  {
    id: 'ember-getaway', name: 'Ember Arena Getaway', giver: 'Mara Voss',
    brief: 'The arena crew tipped off the police. Grab any car and get to Ember Arena fast — the heat is already on.',
    legs: [{ spot: SPOT_ARENA, text: 'Drive any car to Ember Arena', needsCar: true }],
    reward: 600, timeLimit: 120, wantedOnStart: 1,
  },
  {
    id: 'lighthouse-point', name: 'Lighthouse Point', giver: 'Rani Kestrel',
    brief: 'One last run: the debt ledger itself. Carry it to Lighthouse Point and Rani is free of Mara Voss for good.',
    legs: [
      { spot: SPOT_CLINIC, text: 'Collect the ledger at Juniper Clinic' },
      { spot: SPOT_LIGHTHOUSE, text: 'Carry the ledger to Lighthouse Point' },
    ],
    reward: 1000, timeLimit: 180,
  },
];

export function createMissions(city) {
  const missions = {
    defs: MISSION_DEFS,
    index: 0,
    leg: 0,
    state: 'idle', // idle | active | done | failed | complete
    timer: 0,
    banner: '',
    bannerTimer: 0,
    get current() { return MISSION_DEFS[missions.index] || null; },
    get doneCount() { return missions.index; },
    get target() {
      const def = missions.current;
      if (!def || missions.state !== 'active') return null;
      const legDef = def.legs[missions.leg];
      const c = city.spotCentre(legDef.spot);
      return { x: c.x, y: c.y, text: legDef.text, needsCar: !!legDef.needsCar };
    },
    get objectiveText() {
      if (missions.state === 'complete') return 'Story complete — Neon Bay is yours, Rani.';
      if (missions.state === 'failed') return 'Job failed — press Enter to retry.';
      const t = missions.target;
      return t ? t.text : 'Press Enter to start the next job.';
    },

    start() {
      const def = missions.current;
      if (!def) return false;
      missions.leg = 0;
      missions.state = 'active';
      missions.timer = def.timeLimit || 0;
      missions.setBanner(`Job ${missions.index + 1}/5: ${def.name} — ${def.giver}`);
      return true;
    },
    setBanner(text) { missions.banner = text; missions.bannerTimer = 4; },
    fail(reason) {
      if (missions.state !== 'active') return;
      missions.state = 'failed';
      missions.setBanner(`Job failed: ${reason}. Press Enter to retry.`);
    },
    retry() {
      if (missions.state === 'failed') missions.start();
      else if (missions.state === 'idle') missions.start();
    },

    update(dt, ctx) {
      const { player, police, audio, onComplete, onMissionDone } = ctx;
      missions.bannerTimer = Math.max(0, missions.bannerTimer - dt);
      if (missions.state !== 'active') return;
      const def = missions.current;
      if (def.timeLimit > 0) {
        missions.timer -= dt;
        if (missions.timer <= 0) { missions.fail('out of time'); if (audio) audio.fail(); return; }
      }
      const t = missions.target;
      if (!t) return;
      const d = Math.hypot(player.x - t.x, player.y - t.y);
      if (t.needsCar && !player.inCar) return;
      if (d < 78) {
        missions.leg += 1;
        if (audio) audio.pickup();
        if (missions.leg >= def.legs.length) {
          player.money += def.reward;
          if (audio) audio.cash();
          if (audio) audio.jingle();
          missions.index += 1;
          if (missions.index >= MISSION_DEFS.length) {
            missions.state = 'complete';
            missions.setBanner('Story complete! Rani is free.');
            if (onComplete) onComplete();
          } else {
            missions.state = 'idle';
            missions.setBanner(`Job done: +$${def.reward}. Press Enter for the next job.`);
            if (onMissionDone) onMissionDone();
          }
        } else {
          missions.setBanner(`Next: ${missions.target.text}`);
        }
      }
    },
  };
  return missions;
}
