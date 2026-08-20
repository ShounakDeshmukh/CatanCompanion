import type { BoardTemplate, HexCell } from "../types";
import { buildHexagonGrid, harbor, plainIsland, sea, stackBlocks, type HexagonSpec } from "../../../lib/hexGrid";

// Counts verified against Rules/Catan Seafarers 3_4.pdf, p.6-7. All four islands shuffle as
// one pool (the manual doesn't separate them into groups, unlike Heading for New Shores).
// "Forests and pastures shouldn't get low-value discs (2, 3, 11, 12)" is an explicit official
// constraint - pip count 2 or less, hence minPipsOnHexTypes: 3. Island shapes/positions are a
// reasonable approximation, not a pixel match (see plan notes).
const islandA3p: HexagonSpec = {
  landRows: [
    [{ type: "hills", number: 2 }, { type: "hills", number: 3 }],
    [{ type: "hills", number: 3 }, { type: "hills", number: 4 }, { type: "forest", number: 4 }],
  ],
  leftBorder: [harbor("ore"), sea()],
  rightBorder: [sea(), harbor("3:1")],
  topCap: [sea(), sea(), sea()],
  bottomCap: [sea(), sea(), sea(), sea()],
};

const islandB3p: HexCell[][] = [
  [{ type: "forest", number: 5 }, { type: "forest", number: 5 }],
  [{ type: "forest", number: 5 }, { type: "pasture", number: 6 }, { type: "pasture", number: 6 }],
];

const islandC3p: HexagonSpec = {
  landRows: [
    [{ type: "pasture", number: 8 }, { type: "pasture", number: 8 }],
    [{ type: "fields", number: 9 }, { type: "fields", number: 9 }, { type: "fields", number: 9 }],
  ],
  leftBorder: [sea(), harbor("wool")],
  rightBorder: [harbor("3:1"), sea()],
  topCap: [sea(), sea(), sea()],
  bottomCap: [sea(), sea(), sea(), sea()],
};

const islandD3p: HexCell[][] = [
  [{ type: "fields", number: 10 }, { type: "mountains", number: 10 }],
  [{ type: "mountains", number: 11 }, { type: "mountains", number: 11 }, { type: "mountains", number: 12 }],
];

export const fourIslands3p: BoardTemplate = {
  name: "The Four Islands (3 players)",
  grid: stackBlocks([
    { grid: buildHexagonGrid(islandA3p), padLeft: 1 },
    { grid: plainIsland(islandB3p), padLeft: 6 },
    { grid: buildHexagonGrid(islandC3p) },
    { grid: plainIsland(islandD3p), padLeft: 5 },
  ]),
  constraints: { minPipsOnHexTypes: { forest: 3, pasture: 3 } },
};

const islandA4p: HexagonSpec = {
  landRows: [
    [{ type: "hills", number: 2 }, { type: "hills", number: 3 }],
    [{ type: "hills", number: 3 }, { type: "hills", number: 4 }, { type: "forest", number: 4 }],
  ],
  leftBorder: [harbor("ore"), sea()],
  rightBorder: [sea(), harbor("3:1")],
  topCap: [sea(), sea(), sea()],
  bottomCap: [sea(), sea(), sea(), sea()],
};

const islandB4p: HexCell[][] = [
  [{ type: "forest", number: 4 }],
  [{ type: "forest", number: 5 }, { type: "pasture", number: 5 }],
  [{ type: "pasture", number: 5 }, { type: "fields", number: 6 }, { type: "fields", number: 6 }],
];

const islandC4p: HexCell[][] = [
  [{ type: "pasture", number: 8 }],
  [{ type: "pasture", number: 8 }, { type: "pasture", number: 9 }],
  [{ type: "fields", number: 9 }, { type: "fields", number: 9 }, { type: "mountains", number: 10 }],
];

const islandD4p: HexCell[][] = [
  [{ type: "fields", number: 10 }],
  [{ type: "mountains", number: 10 }, { type: "mountains", number: 11 }],
  [{ type: "mountains", number: 11 }, { type: "forest", number: 11 }, { type: "forest", number: 12 }],
];

export const fourIslands4p: BoardTemplate = {
  name: "The Four Islands (4 players)",
  grid: stackBlocks([
    { grid: buildHexagonGrid(islandA4p), padLeft: 1 },
    { grid: plainIsland(islandB4p), padLeft: 7 },
    { grid: plainIsland(islandC4p) },
    { grid: plainIsland(islandD4p), padLeft: 6 },
  ]),
  constraints: { minPipsOnHexTypes: { forest: 3, pasture: 3 } },
};
