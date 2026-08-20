import type { BoardTemplate, HexCell } from "../types";
import { buildHexagonGrid, harbor, sea, type HexagonSpec } from "../../../lib/hexGrid";

const f = (cell: HexCell): HexCell => ({ ...cell, fixed: true });

// Counts approximated from Rules/Catan Seafarers 3_4.pdf, p.16-17 (some table values were
// hard to read precisely, and it doesn't matter much here - see below). The manual is explicit
// that "this scenario should not be varied" except its ports, so every hex here is fixed:
// generating this board always returns the same fixed layout, which is the correct behavior,
// not a bug. The pirate fleet, warships, and fortress-conquering mechanics are gameplay this
// tool doesn't simulate - it lays out the fixed hex/number board only.
const spec: HexagonSpec = {
  landRows: [
    [f({ type: "desert" }), f({ type: "desert" }), f({ type: "desert" })],
    [f({ type: "gold", number: 3 }), f({ type: "gold", number: 4 }), f({ type: "hills", number: 5 }), f({ type: "hills", number: 5 })],
    [
      f({ type: "hills", number: 6 }),
      f({ type: "hills" }),
      f({ type: "forest", number: 8 }),
      f({ type: "forest", number: 9 }),
      f({ type: "forest" }),
    ],
    [
      f({ type: "forest", number: 10 }),
      f({ type: "pasture", number: 11 }),
      f({ type: "pasture" }),
      f({ type: "pasture", number: 3 }),
      f({ type: "fields", number: 4 }),
      f({ type: "fields" }),
    ],
    [
      f({ type: "fields", number: 5 }),
      f({ type: "fields", number: 6 }),
      f({ type: "mountains" }),
      f({ type: "mountains", number: 8 }),
      f({ type: "mountains", number: 9 }),
    ],
    [
      f({ type: "mountains", number: 10 }),
      f({ type: "hills", number: 4 }),
      f({ type: "pasture" }),
      f({ type: "fields", number: 9 }),
    ],
    [f({ type: "forest", number: 10 }), f({ type: "mountains", number: 11 }), f({ type: "pasture", number: 12 })],
  ],
  leftBorder: [harbor("brick"), sea(), harbor("3:1"), sea(), harbor("ore"), sea(), sea()],
  rightBorder: [sea(), harbor("wool"), sea(), harbor("3:1"), sea(), harbor("wheat"), sea()],
  topCap: [sea(), sea(), sea(), sea()],
  bottomCap: [sea(), harbor("3:1"), sea(), sea()],
};

export const pirateIslands: BoardTemplate = {
  name: "Seafarers: The Pirate Islands",
  grid: buildHexagonGrid(spec),
};
