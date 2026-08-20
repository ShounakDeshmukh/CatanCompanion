import type { BoardTemplate, HexCell } from "../types";
import { buildHexagonGrid, harbor, plainIsland, sea, stackBlocks, type HexagonSpec } from "../../../lib/hexGrid";

const SMALL_ISLAND_GROUP = 2;

// Counts verified against Rules/Catan Seafarers 3_4.pdf, p.4-5. Main/small islands are
// separate shuffle groups per the manual's "Main Island" / "Small Islands" variable setup
// split. Island shapes/positions are a reasonable approximation, not a pixel match to the
// manual's diagram (see plan notes) - hex/number/harbor counts are what's kept accurate.
// Land rows must always change length by exactly 1 between consecutive rows - that's what
// makes hexagons interlock in this grid encoding (see boardFactory.ts and hexGrid.ts).
const main3p: HexagonSpec = {
  landRows: [
    [
      { type: "gold", number: 2 },
      { type: "hills", number: 3 },
      { type: "hills", number: 3 },
      { type: "hills", number: 4 },
    ],
    [
      { type: "forest", number: 4 },
      { type: "forest", number: 5 },
      { type: "pasture", number: 5 },
      { type: "pasture", number: 5 },
      { type: "pasture", number: 6 },
    ],
    [
      { type: "pasture", number: 8 },
      { type: "fields", number: 8 },
      { type: "fields", number: 8 },
      { type: "fields", number: 9 },
    ],
    [
      { type: "fields", number: 10 },
      { type: "mountains", number: 10 },
      { type: "mountains", number: 10 },
      { type: "mountains", number: 11 },
      { type: "mountains", number: 12 },
    ],
  ],
  leftBorder: [sea(), harbor("ore"), harbor("3:1"), sea()],
  rightBorder: [harbor("wood"), sea(), harbor("3:1"), harbor("wool")],
  topCap: [harbor("brick"), sea(), harbor("3:1"), sea(), sea()],
  bottomCap: [harbor("wheat"), sea(), sea(), sea(), sea(), sea()],
};

const small3p: HexCell[][] = [
  [{ type: "gold", number: 4, group: SMALL_ISLAND_GROUP }],
  [
    { type: "hills", number: 6, group: SMALL_ISLAND_GROUP },
    { type: "forest", number: 9, group: SMALL_ISLAND_GROUP },
  ],
  [{ type: "pasture", number: 11, group: SMALL_ISLAND_GROUP }],
];

export const headingForNewShores3p: BoardTemplate = {
  name: "Heading for New Shores (3 players)",
  grid: stackBlocks([{ grid: buildHexagonGrid(main3p) }, { grid: plainIsland(small3p), padLeft: 2 }]),
  constraints: { no6and8Adjacent: true },
};

const main4p: HexagonSpec = {
  landRows: [
    [
      { type: "gold", number: 2 },
      { type: "gold", number: 2 },
      { type: "hills", number: 3 },
      { type: "hills", number: 3 },
    ],
    [
      { type: "hills", number: 4 },
      { type: "hills", number: 4 },
      { type: "forest", number: 4 },
      { type: "forest", number: 5 },
      { type: "forest", number: 5 },
    ],
    [
      { type: "forest", number: 6 },
      { type: "pasture", number: 6 },
      { type: "pasture", number: 6 },
      { type: "pasture", number: 8 },
    ],
    [
      { type: "pasture", number: 8 },
      { type: "fields", number: 9 },
      { type: "fields", number: 9 },
      { type: "fields", number: 9 },
      { type: "fields", number: 10 },
    ],
    [
      { type: "mountains", number: 10 },
      { type: "mountains", number: 11 },
      { type: "mountains", number: 11 },
      { type: "mountains", number: 11 },
    ],
  ],
  leftBorder: [harbor("ore"), sea(), harbor("3:1"), sea(), harbor("wool")],
  rightBorder: [sea(), harbor("wood"), sea(), harbor("3:1"), sea()],
  topCap: [harbor("brick"), sea(), harbor("3:1"), sea(), sea()],
  bottomCap: [sea(), harbor("wheat"), sea(), harbor("3:1"), sea()],
};

const small4p: HexCell[][] = [
  [
    { type: "hills", number: 3, group: SMALL_ISLAND_GROUP },
    { type: "forest", number: 5, group: SMALL_ISLAND_GROUP },
  ],
  [
    { type: "pasture", number: 8, group: SMALL_ISLAND_GROUP },
    { type: "fields", number: 10, group: SMALL_ISLAND_GROUP },
    { type: "mountains", number: 12, group: SMALL_ISLAND_GROUP },
  ],
];

export const headingForNewShores4p: BoardTemplate = {
  name: "Heading for New Shores (4 players)",
  grid: stackBlocks([{ grid: buildHexagonGrid(main4p) }, { grid: plainIsland(small4p), padLeft: 3 }]),
  constraints: { no6and8Adjacent: true },
};
