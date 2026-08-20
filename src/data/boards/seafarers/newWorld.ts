import type { BoardTemplate } from "../types";
import { buildHexagonGrid, harbor, sea, type HexagonSpec } from "../../../lib/hexGrid";

// Counts verified against Rules/Catan Seafarers 3_4.pdf, p.20. New World is the manual's own
// "build your own" scenario - an open frame with no fixed islands, using neither desert nor
// gold fields, and explicitly inviting players to "freely change the number and type of hexes
// used." One shuffle group (everything), matching "randomly place hexes... swap adjacent red
// discs so none touch."
const spec: HexagonSpec = {
  landRows: [
    [{ type: "hills", number: 2 }, { type: "hills", number: 3 }, { type: "hills", number: 3 }],
    [
      { type: "hills", number: 3 },
      { type: "forest", number: 4 },
      { type: "forest", number: 4 },
      { type: "forest", number: 4 },
    ],
    [
      { type: "forest", number: 5 },
      { type: "forest", number: 5 },
      { type: "pasture", number: 5 },
      { type: "pasture", number: 6 },
      { type: "pasture", number: 6 },
    ],
    [
      { type: "pasture", number: 8 },
      { type: "pasture", number: 8 },
      { type: "fields", number: 9 },
      { type: "fields", number: 9 },
      { type: "fields", number: 9 },
      { type: "fields", number: 10 },
    ],
    [
      { type: "fields", number: 10 },
      { type: "mountains", number: 10 },
      { type: "mountains", number: 11 },
      { type: "mountains", number: 11 },
      { type: "mountains", number: 12 },
    ],
  ],
  leftBorder: [harbor("brick"), sea(), harbor("3:1"), sea(), harbor("ore")],
  rightBorder: [sea(), harbor("3:1"), sea(), harbor("wool"), sea()],
  topCap: [harbor("wheat"), sea(), sea(), sea()],
  bottomCap: [sea(), harbor("3:1"), sea(), harbor("3:1"), sea(), sea()],
};

export const newWorld: BoardTemplate = {
  name: "Seafarers: New World",
  grid: buildHexagonGrid(spec),
  constraints: { no6and8Adjacent: true },
};
