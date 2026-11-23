// The story of Neon Bay and its five missions. Each mission is a small state
// machine: a list of stages, each with an objective line, a place (or a thing to
// do) and what completes it. The world drives the stages; this file only says
// what the job is, where it happens and what it pays.
//
// Story: Rex Marlowe, a wheelman down on his luck, takes jobs from Mara Voss,
// the fixer who runs the Neon Bay crew out of her garage downtown. The Vipers,
// a rival crew, want the same streets. One job leads to the next until the big
// score at the Casino Royale on the strip.

import {
  SPOT_BANK, SPOT_CASINO, SPOT_CLUB, SPOT_DOCKS, SPOT_GARAGE, SPOT_MARINA, SPOT_SAFEHOUSE, SPOT_WAREHOUSE,
} from './city.js';

export const MISSION_COUNT = 5;

export const STAGE_GOTO = 'goto';
export const STAGE_STEAL_CAR = 'steal_car';
export const STAGE_PICKUP = 'pickup';
export const STAGE_DELIVER = 'deliver';
export const STAGE_ELIMINATE = 'eliminate';
export const STAGE_HOLD = 'hold';
export const STAGE_ESCAPE = 'escape';
export const STAGE_WAIT = 'wait';

export const MISSIONS = [
  {
    id: 'first-wheels',
    name: 'First Wheels',
    briefing: 'Mara Voss: "Rex. You need wheels before you need work. Jack any car on the street and bring it to my garage downtown."',
    reward: 150,
    stages: [
      { type: STAGE_STEAL_CAR, text: 'Steal a car (walk up and press F on a moving car, or E to take a parked one)', spot: null },
      { type: STAGE_GOTO, text: 'Drive the car to Mara\'s garage downtown', spot: SPOT_GARAGE },
    ],
  },
  {
    id: 'the-courier',
    name: 'The Courier',
    briefing: 'Mara Voss: "A package is waiting at the docks. Pick it up and take it to Club Neon on the strip. Two minutes, no questions, no cops."',
    reward: 300,
    stages: [
      { type: STAGE_PICKUP, text: 'Pick up the package at the docks (walk into the marker)', spot: SPOT_DOCKS },
      { type: STAGE_DELIVER, text: 'Deliver the package to Club Neon — 120 seconds', spot: SPOT_CLUB, time: 120 },
    ],
  },
  {
    id: 'getaway',
    name: 'Getaway',
    briefing: 'Mara Voss: "Dante and Luz just hit the bank on Harbor St. Pick them up and lose the heat — get everyone to the safehouse in Palm Heights."',
    reward: 500,
    stages: [
      { type: STAGE_PICKUP, text: 'Pick up Dante and Luz at the bank', spot: SPOT_BANK },
      { type: STAGE_ESCAPE, text: 'Escape to the safehouse — the cops are already coming', spot: SPOT_SAFEHOUSE, wanted: 3 },
    ],
  },
  {
    id: 'turf-war',
    name: 'Turf War',
    briefing: 'Mara Voss: "The Vipers are moving on our warehouse on Tide Rd. Go on foot, clear them out, and come back in one piece."',
    reward: 700,
    stages: [
      { type: STAGE_GOTO, text: 'Get to the warehouse on Tide Rd', spot: SPOT_WAREHOUSE },
      { type: STAGE_ELIMINATE, text: 'Take out the Vipers (0/4)', spot: SPOT_WAREHOUSE, count: 4 },
      { type: STAGE_GOTO, text: 'Head back to the garage', spot: SPOT_GARAGE },
    ],
  },
  {
    id: 'the-big-score',
    name: 'The Big Score',
    briefing: 'Mara Voss: "The casino vault on the strip. Grab the cash, hold on through the heat, and get to the boat at the marina. This is the one, Rex."',
    reward: 1500,
    stages: [
      { type: STAGE_GOTO, text: 'Get to the Casino Royale on the strip', spot: SPOT_CASINO },
      { type: STAGE_HOLD, text: 'Hold E at the vault to grab the cash', spot: SPOT_CASINO, hold: 5 },
      { type: STAGE_ESCAPE, text: 'Escape to the boat at the marina — every cop in the city is coming', spot: SPOT_MARINA, wanted: 5 },
    ],
  },
];

/** The mission after `index`, or null when the story is finished. */
export function missionAt(index) {
  return index >= 0 && index < MISSIONS.length ? MISSIONS[index] : null;
}

/** One line for the title screen: where the story stands. */
export function storyLine(missionIndex) {
  if (missionIndex >= MISSIONS.length) return 'The big score is done. Neon Bay is yours, Rex.';
  return `Next job: ${MISSIONS[missionIndex].name} — $${MISSIONS[missionIndex].reward}`;
}
