import type { BoardTemplate, HexCell } from "../types";
import { buildHexagonGrid, harbor, sea, type HexagonSpec } from "../../../lib/hexGrid";

const FOG = 2;
const hidden = (cell: HexCell): HexCell => ({ ...cell, hidden: true, group: FOG });

// Counts verified against Rules/Catan Seafarers 3_4.pdf, p.8-9. The manual's facedown stack
// (progressively revealed as ships/roads are built next to it) is modeled as ordinary hexes
// with hidden: true - a real, seed-determined tile that hexBoard.ts renders as "?" instead of
// its true terrain/number, so a shared link still shows every player the same board while
// keeping the "unexplored" feel. Faceup and facedown hexes are separate shuffle groups, per
// the manual (each drawn from its own pool). No official constraint restricts 6/8 adjacency
// here - the manual explicitly allows it for this scenario. Land rows always change length by
// exactly 1 between consecutive rows (required for hexagons to interlock - see hexGrid.ts).
const spec3p: HexagonSpec = {
  landRows: [
    [{ type: "hills", number: 3 }, { type: "hills", number: 4 }, { type: "forest", number: 5 }],
    [
      { type: "forest", number: 5 },
      { type: "forest", number: 6 },
      { type: "forest", number: 6 },
      { type: "pasture", number: 8 },
    ],
    [{ type: "pasture", number: 8 }, { type: "pasture", number: 9 }, { type: "pasture", number: 9 }],
    [
      { type: "fields", number: 10 },
      { type: "fields", number: 11 },
      { type: "mountains", number: 11 },
      { type: "mountains", number: 12 },
    ],
    [hidden({ type: "gold", number: 3 }), hidden({ type: "gold", number: 3 }), hidden({ type: "hills", number: 4 })],
    [
      hidden({ type: "hills", number: 5 }),
      hidden({ type: "forest", number: 6 }),
      hidden({ type: "pasture", number: 8 }),
      hidden({ type: "fields", number: 9 }),
    ],
    [hidden({ type: "fields", number: 10 }), hidden({ type: "mountains", number: 11 }), hidden({ type: "mountains", number: 12 })],
  ],
  leftBorder: [harbor("wool"), sea(), harbor("3:1"), sea(), sea(), sea(), sea()],
  rightBorder: [sea(), harbor("ore"), sea(), harbor("3:1"), sea(), sea(), sea()],
  topCap: [harbor("brick"), sea(), sea(), sea()],
  bottomCap: [sea(), sea(), harbor("wheat"), sea()],
};

export const fogIslands3p: BoardTemplate = {
  name: "The Fog Islands (3 players)",
  grid: buildHexagonGrid(spec3p),
};

const spec4p: HexagonSpec = {
  landRows: [
    [{ type: "hills", number: 2 }, { type: "hills", number: 3 }, { type: "hills", number: 3 }],
    [
      { type: "forest", number: 4 },
      { type: "forest", number: 4 },
      { type: "forest", number: 4 },
      { type: "forest", number: 5 },
    ],
    [{ type: "pasture", number: 5 }, { type: "pasture", number: 5 }, { type: "pasture", number: 6 }],
    [
      { type: "pasture", number: 6 },
      { type: "fields", number: 6 },
      { type: "fields", number: 8 },
      { type: "fields", number: 8 },
    ],
    [{ type: "mountains", number: 8 }, { type: "mountains", number: 9 }, { type: "mountains", number: 9 }],
    [
      hidden({ type: "gold", number: 3 }),
      hidden({ type: "gold", number: 4 }),
      hidden({ type: "hills", number: 5 }),
      hidden({ type: "hills", number: 6 }),
    ],
    [hidden({ type: "forest", number: 8 }), hidden({ type: "pasture", number: 9 }), hidden({ type: "fields", number: 10 })],
    [hidden({ type: "fields", number: 11 }), hidden({ type: "mountains", number: 11 })],
    [hidden({ type: "mountains", number: 12 })],
  ],
  leftBorder: [harbor("brick"), sea(), harbor("3:1"), sea(), sea(), sea(), sea(), sea(), sea()],
  rightBorder: [sea(), harbor("wool"), sea(), harbor("3:1"), sea(), sea(), sea(), sea(), sea()],
  topCap: [sea(), harbor("ore"), sea(), sea()],
  bottomCap: [sea(), sea()],
};

export const fogIslands4p: BoardTemplate = {
  name: "The Fog Islands (4 players)",
  grid: buildHexagonGrid(spec4p),
};
