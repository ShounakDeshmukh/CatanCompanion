import type { BoardTemplate, HexCell, PortType } from "./types";
import { buildHexagonGrid, type HexagonSpec } from "../../lib/hexGrid";

const sea = (): HexCell => ({ type: "sea", fixed: true });
const harbor = (type: PortType): HexCell => ({
  type: "sea",
  fixed: true,
  port: { type, fixed: true },
});

// Base game (3-4 players): 19 land hexes in rows of 3-4-5-4-3, surrounded by an 18-hex sea
// ring carrying 9 harbors (4x 3:1, one each of the 5 resources). Counts and building costs
// verified against Rules/Catan Base 3_4.pdf. Terrain/number placement below is just one valid
// arrangement — generateBoard() always shuffles it, since the official "Variable Setup" rules
// are themselves a full random assignment (place hexes randomly, then lay shuffled number
// discs in order skipping the desert), with no adjacency constraints. Harbor positions are
// fixed, matching the manual (only hexes and numbers are randomized, never the coastline).
const catanSpec: HexagonSpec = {
  landRows: [
    [
      { type: "forest", number: 2 },
      { type: "forest", number: 3 },
      { type: "pasture", number: 4 },
    ],
    [
      { type: "fields", number: 5 },
      { type: "fields", number: 6 },
      { type: "hills", number: 8 },
      { type: "mountains", number: 9 },
    ],
    [
      { type: "pasture", number: 10 },
      { type: "pasture", number: 11 },
      { type: "desert" },
      { type: "hills", number: 12 },
      { type: "mountains", number: 3 },
    ],
    [
      { type: "fields", number: 4 },
      { type: "fields", number: 5 },
      { type: "forest", number: 6 },
      { type: "mountains", number: 8 },
    ],
    [
      { type: "forest", number: 9 },
      { type: "pasture", number: 10 },
      { type: "hills", number: 11 },
    ],
  ],
  leftBorder: [sea(), harbor("3:1"), harbor("ore"), sea(), sea()],
  rightBorder: [harbor("wood"), sea(), harbor("3:1"), sea(), harbor("wool")],
  topCap: [harbor("brick"), sea(), harbor("3:1"), sea()],
  bottomCap: [harbor("wheat"), sea(), harbor("3:1"), sea()],
};

export const catanBoard3to4: BoardTemplate = {
  name: "Catan",
  grid: buildHexagonGrid(catanSpec),
};

// 5-6 Player Extension: 30 land hexes in rows of 3-4-5-6-5-4-3, 22-hex sea ring, 11 harbors
// (6x 3:1, one each of the 5 resources). Counts, number-disc distribution, and building costs
// verified against Rules/Catan Base 5_6.pdf; exact harbor positions on the extended coastline
// are a reasonable approximation (evenly spaced) rather than a pixel match to the manual's
// diagram, consistent with this app's discrete-hex border (see plan notes).
const catan56Spec: HexagonSpec = {
  landRows: [
    [
      { type: "forest", number: 2 },
      { type: "pasture", number: 2 },
      { type: "fields", number: 3 },
    ],
    [
      { type: "fields", number: 3 },
      { type: "hills", number: 3 },
      { type: "mountains", number: 4 },
      { type: "forest", number: 4 },
    ],
    [
      { type: "pasture", number: 4 },
      { type: "forest", number: 5 },
      { type: "hills", number: 5 },
      { type: "mountains", number: 5 },
      { type: "fields", number: 6 },
    ],
    [
      { type: "pasture", number: 6 },
      { type: "fields", number: 6 },
      { type: "desert" },
      { type: "desert" },
      { type: "mountains", number: 8 },
      { type: "hills", number: 8 },
    ],
    [
      { type: "forest", number: 8 },
      { type: "pasture", number: 9 },
      { type: "fields", number: 9 },
      { type: "hills", number: 9 },
      { type: "mountains", number: 10 },
    ],
    [
      { type: "forest", number: 10 },
      { type: "pasture", number: 10 },
      { type: "hills", number: 11 },
      { type: "mountains", number: 11 },
    ],
    [
      { type: "forest", number: 11 },
      { type: "pasture", number: 12 },
      { type: "fields", number: 12 },
    ],
  ],
  leftBorder: [sea(), harbor("3:1"), sea(), harbor("ore"), sea(), harbor("3:1"), sea()],
  rightBorder: [
    harbor("3:1"),
    sea(),
    harbor("wood"),
    sea(),
    harbor("3:1"),
    sea(),
    harbor("wool"),
  ],
  topCap: [sea(), harbor("3:1"), sea(), harbor("brick")],
  bottomCap: [harbor("wheat"), sea(), harbor("3:1"), sea()],
};

export const catanBoard5to6: BoardTemplate = {
  name: "Catan: 5-6 Player Extension",
  grid: buildHexagonGrid(catan56Spec),
};
