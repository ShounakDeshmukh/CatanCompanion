import type { BoardTemplate } from "../types";
import { buildHexagonGrid, harbor, sea, type HexagonSpec } from "../../../lib/hexGrid";

// Counts verified against Rules/Catan Seafarers 3_4.pdf, p.18-19. Main island + small islands
// shuffle as one pool here (a simplification - see plan notes on reasonable vs. pixel-exact
// layouts). The wonder tiles, Great Wall/Bridge markers, and small-island VP bonus are
// gameplay mechanics this tool doesn't model (it generates the board, not board-adjacent
// physical pieces) - only the hex/number layout is generated. Official constraint: the 2 land
// hexes next to the desert shouldn't get a 6 or 8 (maxPipsOnChit: 4).
const spec: HexagonSpec = {
  landRows: [
    [{ type: "desert", fixed: true }, { type: "desert", fixed: true }, { type: "desert", fixed: true }],
    [
      { type: "gold", number: 4, maxPipsOnChit: 4 },
      { type: "gold", number: 5, maxPipsOnChit: 4 },
      { type: "hills", number: 3 },
      { type: "hills", number: 3 },
    ],
    [
      { type: "hills", number: 3 },
      { type: "hills", number: 4 },
      { type: "hills", number: 4 },
      { type: "forest", number: 5 },
      { type: "forest", number: 5 },
    ],
    [
      { type: "forest", number: 6 },
      { type: "forest", number: 6 },
      { type: "forest", number: 8 },
      { type: "pasture", number: 8 },
      { type: "pasture", number: 9 },
      { type: "pasture", number: 9 },
    ],
    [
      { type: "pasture", number: 9 },
      { type: "pasture", number: 10 },
      { type: "fields", number: 10 },
      { type: "fields", number: 10 },
      { type: "fields", number: 11 },
    ],
    [
      { type: "fields", number: 11 },
      { type: "fields", number: 12 },
      { type: "mountains", number: 3 },
      { type: "mountains", number: 4 },
    ],
    [{ type: "mountains", number: 5 }, { type: "mountains", number: 6 }, { type: "mountains", number: 8 }],
  ],
  leftBorder: [harbor("brick"), sea(), harbor("3:1"), sea(), harbor("ore"), sea(), sea()],
  rightBorder: [sea(), harbor("wool"), sea(), harbor("3:1"), sea(), harbor("wheat"), sea()],
  topCap: [sea(), sea(), sea(), sea()],
  bottomCap: [sea(), harbor("3:1"), sea(), sea()],
};

export const wondersOfCatan: BoardTemplate = {
  name: "Seafarers: The Wonders of Catan",
  grid: buildHexagonGrid(spec),
};
