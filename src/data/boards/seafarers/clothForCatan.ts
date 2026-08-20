import type { BoardTemplate, HexCell } from "../types";
import { buildHexagonGrid, harbor, plainIsland, sea, stackBlocks, type HexagonSpec } from "../../../lib/hexGrid";

const village = (number: HexCell["number"]): HexCell => ({ type: "village", number, fixed: true });

// Counts approximated from Rules/Catan Seafarers 3_4.pdf, p.14-15 (see plan notes on
// reasonable vs. pixel-exact layouts). The 4 small islands are fixed, non-settleable "villages"
// that produce cloth commodities when their number is rolled and a player has a trade route to
// them - a gameplay mechanic (route-based production, cloth-token bookkeeping) this tool
// doesn't simulate, so villages render as informational markers only. The 2 large islands
// shuffle as one pool.
const islandA: HexagonSpec = {
  landRows: [
    [
      { type: "gold", number: 2 },
      { type: "hills", number: 3 },
      { type: "hills", number: 3 },
      { type: "forest", number: 4 },
    ],
    [{ type: "forest", number: 4 }, { type: "pasture", number: 5 }, { type: "pasture", number: 5 }],
    [
      { type: "fields", number: 6 },
      { type: "fields", number: 6 },
      { type: "mountains", number: 8 },
      { type: "mountains", number: 8 },
    ],
  ],
  leftBorder: [harbor("ore"), sea(), harbor("3:1")],
  rightBorder: [sea(), harbor("wool"), sea()],
  topCap: [sea(), sea(), sea(), sea(), sea()],
  bottomCap: [sea(), sea(), sea(), sea(), sea()],
};

const islandB: HexagonSpec = {
  landRows: [
    [
      { type: "gold", number: 9 },
      { type: "hills", number: 9 },
      { type: "forest", number: 10 },
      { type: "forest", number: 10 },
    ],
    [{ type: "pasture", number: 10 }, { type: "pasture", number: 11 }, { type: "fields", number: 11 }],
    [
      { type: "fields", number: 12 },
      { type: "fields", number: 3 },
      { type: "mountains", number: 4 },
      { type: "mountains", number: 5 },
    ],
  ],
  leftBorder: [harbor("brick"), sea(), harbor("3:1")],
  rightBorder: [sea(), harbor("wheat"), sea()],
  topCap: [sea(), sea(), sea(), sea(), sea()],
  bottomCap: [sea(), sea(), sea(), sea(), sea()],
};

const villages: HexCell[][] = [[village(4), village(10)], [village(5), village(9)], [village(6), village(8)], [village(3), village(11)]];

export const clothForCatan: BoardTemplate = {
  name: "Seafarers: Cloth for Catan",
  grid: stackBlocks([
    { grid: plainIsland([villages[0]]), padLeft: 2 },
    { grid: plainIsland([villages[1]]), padLeft: 6 },
    { grid: buildHexagonGrid(islandA) },
    { grid: buildHexagonGrid(islandB), padLeft: 3 },
    { grid: plainIsland([villages[2]]), padLeft: 2 },
    { grid: plainIsland([villages[3]]), padLeft: 6 },
  ]),
};
