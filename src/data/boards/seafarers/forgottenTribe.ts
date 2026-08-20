import type { BoardTemplate } from "../types";
import { buildHexagonGrid, harbor, sea, type HexagonSpec } from "../../../lib/hexGrid";

// Counts verified against Rules/Catan Seafarers 3_4.pdf, p.12-13. Unlike every other
// scenario, only 18 of this island's 27 non-desert hexes carry a number disc - settlements
// (and the robber) may only go on numbered hexes, so the rest are intentionally numberless
// land, not a data error. The manual's VP tokens, development cards, and ports attached to
// specific *ship-building edges* (not hexes) are a genuinely different data model this tool
// doesn't cover - it generates the hex/number layout only; place those by hand per the
// rulebook. Single shuffle group (one large island).
const spec: HexagonSpec = {
  landRows: [
    [{ type: "desert", fixed: true }, { type: "desert", fixed: true }, { type: "desert", fixed: true }],
    [{ type: "gold", number: 2 }, { type: "gold" }, { type: "hills", number: 3 }, { type: "hills", number: 3 }],
    [
      { type: "hills", number: 4 },
      { type: "forest" },
      { type: "forest", number: 4 },
      { type: "forest", number: 5 },
      { type: "pasture" },
    ],
    [
      { type: "pasture", number: 5 },
      { type: "pasture", number: 6 },
      { type: "fields" },
      { type: "fields", number: 6 },
      { type: "fields", number: 8 },
      { type: "mountains" },
    ],
    [
      { type: "mountains", number: 8 },
      { type: "mountains", number: 9 },
      { type: "mountains" },
      { type: "fields", number: 9 },
      { type: "fields" },
    ],
    [
      { type: "mountains", number: 10 },
      { type: "hills", number: 10 },
      { type: "hills" },
      { type: "forest", number: 11 },
    ],
    [{ type: "forest", number: 11 }, { type: "pasture", number: 12 }, { type: "pasture" }],
  ],
  leftBorder: [harbor("brick"), sea(), harbor("3:1"), sea(), harbor("ore"), sea(), sea()],
  rightBorder: [sea(), harbor("wool"), sea(), harbor("3:1"), sea(), harbor("wheat"), sea()],
  topCap: [sea(), sea(), sea(), sea()],
  bottomCap: [sea(), harbor("3:1"), sea(), sea()],
};

export const forgottenTribe: BoardTemplate = {
  name: "Seafarers: The Forgotten Tribe",
  grid: buildHexagonGrid(spec),
};
