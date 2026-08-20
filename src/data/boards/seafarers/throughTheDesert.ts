import type { BoardTemplate } from "../types";
import { buildHexagonGrid, harbor, sea, stackBlocks, type HexagonSpec } from "../../../lib/hexGrid";

const UNEXPLORED = 2;

// Counts verified against Rules/Catan Seafarers 3_4.pdf, p.10-11. The desert-split main
// island (starting island) is the default group; the small land strip and islands beyond it
// ("unexplored regions") are a separate shuffle group. Official constraints: no 6/8 touching,
// and gold fields never get a 6 or 8 (maxPipsOnHexTypes gold: 4, since 6/8 are pip 5).
// Land rows always change length by exactly 1 between consecutive rows (see hexGrid.ts).
const main3p: HexagonSpec = {
  landRows: [
    [{ type: "desert", fixed: true }, { type: "desert", fixed: true }, { type: "desert", fixed: true }],
    [
      { type: "hills", number: 2 },
      { type: "hills", number: 3 },
      { type: "forest", number: 3 },
      { type: "forest", number: 4 },
    ],
    [{ type: "forest", number: 4 }, { type: "pasture", number: 4 }, { type: "pasture", number: 5 }],
    [
      { type: "fields", number: 5 },
      { type: "fields", number: 5 },
      { type: "mountains", number: 6 },
      { type: "mountains", number: 6 },
    ],
  ],
  leftBorder: [harbor("brick"), sea(), sea(), sea()],
  rightBorder: [sea(), harbor("3:1"), sea(), sea()],
  topCap: [sea(), sea(), sea(), sea()],
  bottomCap: [sea(), sea(), sea(), sea(), sea()],
};

const unexplored3p: HexagonSpec = {
  landRows: [
    [
      { type: "gold", number: 6, group: UNEXPLORED, maxPipsOnChit: 4 },
      { type: "gold", number: 8, group: UNEXPLORED, maxPipsOnChit: 4 },
      { type: "hills", number: 8, group: UNEXPLORED },
      { type: "forest", number: 8, group: UNEXPLORED },
    ],
    [
      { type: "forest", number: 9, group: UNEXPLORED },
      { type: "pasture", number: 9, group: UNEXPLORED },
      { type: "pasture", number: 9, group: UNEXPLORED },
    ],
    [
      { type: "fields", number: 10, group: UNEXPLORED },
      { type: "fields", number: 10, group: UNEXPLORED },
      { type: "mountains", number: 11, group: UNEXPLORED },
      { type: "mountains", number: 12, group: UNEXPLORED },
    ],
  ],
  leftBorder: [sea(), harbor("wool"), sea()],
  rightBorder: [harbor("3:1"), sea(), harbor("ore")],
  topCap: [sea(), sea(), sea(), sea(), sea()],
  bottomCap: [sea(), sea(), sea(), sea(), sea()],
};

export const throughTheDesert3p: BoardTemplate = {
  name: "Through the Desert (3 players)",
  grid: stackBlocks([{ grid: buildHexagonGrid(main3p) }, { grid: buildHexagonGrid(unexplored3p), padLeft: 3 }]),
  constraints: { no6and8Adjacent: true, maxPipsOnHexTypes: { gold: 4 } },
};

const main4p: HexagonSpec = {
  landRows: [
    [{ type: "desert", fixed: true }, { type: "desert", fixed: true }, { type: "desert", fixed: true }, { type: "hills", number: 2 }],
    [
      { type: "hills", number: 3 },
      { type: "hills", number: 3 },
      { type: "forest", number: 3 },
      { type: "forest", number: 4 },
      { type: "forest", number: 4 },
    ],
    [
      { type: "pasture", number: 4 },
      { type: "pasture", number: 5 },
      { type: "pasture", number: 5 },
      { type: "fields", number: 5 },
    ],
    [
      { type: "fields", number: 6 },
      { type: "fields", number: 6 },
      { type: "mountains", number: 6 },
      { type: "mountains", number: 8 },
      { type: "mountains", number: 8 },
    ],
  ],
  leftBorder: [harbor("brick"), sea(), sea(), sea()],
  rightBorder: [sea(), harbor("3:1"), sea(), harbor("wheat")],
  topCap: [sea(), sea(), sea(), sea(), sea()],
  bottomCap: [sea(), sea(), sea(), sea(), sea(), sea()],
};

const unexplored4p: HexagonSpec = {
  landRows: [
    [
      { type: "gold", number: 8, group: UNEXPLORED, maxPipsOnChit: 4 },
      { type: "gold", number: 9, group: UNEXPLORED, maxPipsOnChit: 4 },
      { type: "hills", number: 9, group: UNEXPLORED },
    ],
    [
      { type: "hills", number: 9, group: UNEXPLORED },
      { type: "forest", number: 10, group: UNEXPLORED },
      { type: "forest", number: 10, group: UNEXPLORED },
      { type: "pasture", number: 10, group: UNEXPLORED },
    ],
    [
      { type: "pasture", number: 11, group: UNEXPLORED },
      { type: "fields", number: 11, group: UNEXPLORED },
      { type: "fields", number: 11, group: UNEXPLORED },
      { type: "mountains", number: 12, group: UNEXPLORED },
      { type: "mountains", number: 12, group: UNEXPLORED },
    ],
  ],
  leftBorder: [sea(), harbor("wool"), sea()],
  rightBorder: [harbor("3:1"), sea(), harbor("ore")],
  topCap: [sea(), sea(), sea(), sea()],
  bottomCap: [sea(), sea(), sea(), sea(), sea(), sea()],
};

export const throughTheDesert4p: BoardTemplate = {
  name: "Through the Desert (4 players)",
  grid: stackBlocks([{ grid: buildHexagonGrid(main4p) }, { grid: buildHexagonGrid(unexplored4p), padLeft: 4 }]),
  constraints: { no6and8Adjacent: true, maxPipsOnHexTypes: { gold: 4 } },
};
