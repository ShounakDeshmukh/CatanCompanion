import type { HexType, NumberChitValue, PortType } from "./types";

/**
 * The component tables printed in the rule books, transcribed so the boards can be checked
 * against them automatically. These are the numbers a player counts out of the box, so any
 * board that disagrees is wrong no matter how good it looks.
 *
 * `sea` is deliberately absent: the books count the loose sea hexes you place inside the
 * frame, while a board here also carries the frame itself as sea hexes.
 */
export interface ManualCounts {
  /** Where in Rules/ the numbers come from. */
  source: string;
  terrain: Partial<Record<HexType, number>>;
  chits: Partial<Record<NumberChitValue, number>>;
  ports: Partial<Record<PortType, number>>;
  /**
   * Sizes of the connected landmasses in the setup diagram, largest first, counted with
   * deserts treated as water. That is what separates Through the Desert's main island from
   * its land strip, and it catches a layout that has the right pieces in the wrong places.
   */
  islands?: number[];
}

const ONE_OF_EACH_2_TO_1 = { brick: 1, wood: 1, wool: 1, wheat: 1, ore: 1 } as const;

export const MANUAL_COUNTS: Record<string, ManualCounts> = {
  "catan-3-4": {
    source: "Catan Base 3_4.pdf",
    terrain: { hills: 3, forest: 4, pasture: 4, fields: 4, mountains: 3, desert: 1 },
    chits: { 2: 1, 3: 2, 4: 2, 5: 2, 6: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 1 },
    ports: { "3:1": 4, ...ONE_OF_EACH_2_TO_1 },
  },
  "catan-5-6": {
    source: "Catan Base 5_6.pdf",
    terrain: { hills: 5, forest: 6, pasture: 6, fields: 6, mountains: 5, desert: 2 },
    chits: { 2: 2, 3: 3, 4: 3, 5: 3, 6: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 2 },
    // 11 harbors, and unlike the base game they are not one of each: the extension's frame
    // carries a second wool harbor, verified against the board diagram on p.2
    ports: { "3:1": 5, brick: 1, wood: 1, wool: 2, wheat: 1, ore: 1 },
  },
  "sf-heading-3p": {
    source: "Catan Seafarers 3_4.pdf p.4",
    terrain: { gold: 2, hills: 4, forest: 3, pasture: 5, fields: 4, mountains: 4 },
    chits: { 2: 1, 3: 2, 4: 3, 5: 3, 6: 2, 8: 3, 9: 2, 10: 3, 11: 2, 12: 1 },
    ports: { "3:1": 3, ...ONE_OF_EACH_2_TO_1 },
    islands: [14, 4, 2, 2],
  },
  "sf-heading-4p": {
    source: "Catan Seafarers 3_4.pdf p.5",
    terrain: { gold: 2, hills: 5, forest: 5, pasture: 5, fields: 5, mountains: 5, desert: 1 },
    chits: { 2: 2, 3: 3, 4: 3, 5: 3, 6: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 1 },
    ports: { "3:1": 4, ...ONE_OF_EACH_2_TO_1 },
    islands: [18, 5, 2, 2],
  },
  "sf-four-islands-3p": {
    source: "Catan Seafarers 3_4.pdf p.6",
    terrain: { hills: 4, forest: 4, pasture: 4, fields: 4, mountains: 4 },
    chits: { 2: 1, 3: 2, 4: 2, 5: 3, 6: 2, 8: 2, 9: 3, 10: 2, 11: 2, 12: 1 },
    ports: { "3:1": 4, ...ONE_OF_EACH_2_TO_1 },
    islands: [6, 6, 4, 4],
  },
  "sf-four-islands-4p": {
    source: "Catan Seafarers 3_4.pdf p.7",
    terrain: { hills: 4, forest: 5, pasture: 5, fields: 5, mountains: 4 },
    chits: { 2: 1, 3: 2, 4: 3, 5: 3, 6: 2, 8: 2, 9: 3, 10: 3, 11: 3, 12: 1 },
    ports: { "3:1": 4, ...ONE_OF_EACH_2_TO_1 },
    islands: [8, 7, 4, 4],
  },
  "sf-through-desert-3p": {
    source: "Catan Seafarers 3_4.pdf p.10",
    terrain: { gold: 2, hills: 3, forest: 5, pasture: 4, fields: 4, mountains: 4, desert: 3 },
    chits: { 2: 1, 3: 2, 4: 3, 5: 3, 6: 3, 8: 3, 9: 3, 10: 2, 11: 1, 12: 1 },
    ports: { "3:1": 3, ...ONE_OF_EACH_2_TO_1 },
    islands: [14, 3, 2, 2, 1],
  },
  "sf-through-desert-4p": {
    source: "Catan Seafarers 3_4.pdf p.11",
    terrain: { gold: 2, hills: 5, forest: 5, pasture: 5, fields: 5, mountains: 5, desert: 3 },
    chits: { 2: 1, 3: 3, 4: 3, 5: 3, 6: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 2 },
    ports: { "3:1": 4, ...ONE_OF_EACH_2_TO_1 },
    islands: [17, 3, 3, 2, 2],
  },
};

// Cities & Knights ships no board of its own - it is played on the base Catan map.
MANUAL_COUNTS["ck-3-4"] = MANUAL_COUNTS["catan-3-4"];
MANUAL_COUNTS["ck-5-6"] = MANUAL_COUNTS["catan-5-6"];

// ---------------------------------------------------------------------------
// 5-6 players, from Rules/Catan Seafarers 5_6.pdf. Note this edition replaces
// The Four Islands with The Six Islands.
// ---------------------------------------------------------------------------

const SEAFARERS_5_6_PORTS = { "3:1": 5, brick: 1, wood: 1, wool: 2, wheat: 1, ore: 1 } as const;
const SEAFARERS_5_6_DISCS = { 2: 3, 3: 4, 4: 4, 5: 4, 6: 4, 8: 4, 9: 4, 10: 4, 11: 4, 12: 3 } as const;

MANUAL_COUNTS["sf56-heading"] = {
  source: "Catan Seafarers 5_6.pdf p.4",
  terrain: { gold: 3, hills: 7, forest: 7, pasture: 7, fields: 7, mountains: 7, desert: 2 },
  chits: { ...SEAFARERS_5_6_DISCS },
  ports: { ...SEAFARERS_5_6_PORTS },
};

MANUAL_COUNTS["sf56-six-islands"] = {
  source: "Catan Seafarers 5_6.pdf p.5",
  terrain: { hills: 6, forest: 7, pasture: 7, fields: 6, mountains: 6 },
  chits: { 2: 2, 3: 3, 4: 4, 5: 4, 6: 4, 8: 3, 9: 4, 10: 4, 11: 2, 12: 2 },
  ports: { ...SEAFARERS_5_6_PORTS },
  islands: [6, 6, 5, 5, 5, 5],
};

MANUAL_COUNTS["sf56-fog-islands"] = {
  source: "Catan Seafarers 5_6.pdf p.6",
  // faceup only; the other 18 hexes are the facedown stack the host lays out
  terrain: { hills: 5, forest: 5, pasture: 5, fields: 5, mountains: 4, fog: 18 },
  chits: { 2: 1, 3: 2, 4: 3, 5: 2, 6: 3, 8: 3, 9: 3, 10: 3, 11: 2, 12: 2 },
  ports: { ...SEAFARERS_5_6_PORTS },
};

MANUAL_COUNTS["sf56-through-desert"] = {
  source: "Catan Seafarers 5_6.pdf p.7",
  terrain: { gold: 3, hills: 7, forest: 7, pasture: 7, fields: 7, mountains: 7, desert: 5 },
  chits: { ...SEAFARERS_5_6_DISCS },
  ports: { ...SEAFARERS_5_6_PORTS },
};

MANUAL_COUNTS["sf56-forgotten-tribe"] = {
  source: "Catan Seafarers 5_6.pdf p.8",
  terrain: { gold: 3, hills: 7, forest: 7, pasture: 7, fields: 7, mountains: 6, desert: 4 },
  chits: { 2: 1, 3: 4, 4: 4, 5: 4, 6: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 1 },
  ports: { "3:1": 3, brick: 1, wood: 1, wool: 1, wheat: 1, ore: 1 },
};

MANUAL_COUNTS["sf56-cloth-for-catan"] = {
  source: "Catan Seafarers 5_6.pdf p.9",
  // the 4 deserts and 2 gold fields of the component table are the six cloth villages
  terrain: { village: 6, hills: 4, forest: 6, pasture: 5, fields: 6, mountains: 5 },
  chits: { ...SEAFARERS_5_6_DISCS },
  ports: { ...SEAFARERS_5_6_PORTS },
};

MANUAL_COUNTS["sf56-pirate-islands"] = {
  source: "Catan Seafarers 5_6.pdf p.10",
  terrain: { gold: 4, hills: 4, forest: 6, pasture: 6, fields: 5, mountains: 7, desert: 5 },
  chits: { 2: 1, 3: 4, 4: 4, 5: 4, 6: 4, 8: 4, 9: 3, 10: 3, 11: 4, 12: 1 },
  ports: { "3:1": 4, brick: 1, wood: 1, wool: 1, wheat: 1, ore: 1 },
};

MANUAL_COUNTS["sf56-wonders-of-catan"] = {
  source: "Catan Seafarers 5_6.pdf p.11",
  terrain: { gold: 3, hills: 6, forest: 7, pasture: 7, fields: 6, mountains: 6, desert: 4 },
  chits: { 2: 2, 3: 3, 4: 4, 5: 4, 6: 4, 8: 4, 9: 4, 10: 4, 11: 4, 12: 2 },
  ports: { ...SEAFARERS_5_6_PORTS },
};

MANUAL_COUNTS["sf56-new-world"] = {
  source: "Catan Seafarers 5_6.pdf p.12",
  terrain: { gold: 4, hills: 7, forest: 7, pasture: 7, fields: 7, mountains: 7, desert: 3 },
  chits: { 2: 2, 3: 3, 4: 4, 5: 5, 6: 5, 8: 5, 9: 5, 10: 4, 11: 4, 12: 2 },
  ports: { ...SEAFARERS_5_6_PORTS },
};

/**
 * Boards whose rule-book component table has not been transcribed yet. Their layouts are
 * fine - they come from the same ported source as the rest - but nothing here cross-checks
 * them, so they are verified for internal consistency only. Move an entry out by adding its
 * MANUAL_COUNTS row.
 */
export const NOT_YET_TRANSCRIBED = new Set([
  "sf-fog-islands-3p",
  "sf-fog-islands-4p",
  "sf-forgotten-tribe",
  "sf-cloth-for-catan",
  "sf-pirate-islands",
  "sf-wonders-of-catan",
  "sf-new-world",
]);
