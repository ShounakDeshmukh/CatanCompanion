export type ResourceHexType = "hills" | "forest" | "pasture" | "fields" | "mountains" | "gold";
export type NonResourceHexType = "desert" | "sea" | "fog";
export type HexType = ResourceHexType | NonResourceHexType;

export type Resource = "brick" | "wood" | "wool" | "wheat" | "ore";

export const RESOURCE_BY_HEX: Record<ResourceHexType, Resource | "choice"> = {
  hills: "brick",
  forest: "wood",
  pasture: "wool",
  fields: "wheat",
  mountains: "ore",
  gold: "choice",
};

export type NumberChitValue = 2 | 3 | 4 | 5 | 6 | 8 | 9 | 10 | 11 | 12;

export const PIPS_BY_NUMBER: Record<NumberChitValue, number> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
};

export type PortType = "3:1" | Resource;

/**
 * A harbor on a sea/border hex. Which edge(s) its dock faces isn't tracked explicitly —
 * hexBoard.ts derives that at render time from which neighboring cells are land, since we
 * aren't modeling exact settlement intersections in this tool.
 */
export interface Port {
  type: PortType;
  /** If true, this port never moves during shuffling (true of every port in Base/C&K/most Seafarers scenarios). */
  fixed?: boolean;
}

/** A single position on the board template's grid. */
export interface HexCell {
  type: HexType;
  number?: NumberChitValue;
  /** A second chit paired to this hex, e.g. Cloth for Catan's east/west village numbers. */
  secondNumber?: NumberChitValue;
  port?: Port;
  /** If true, this hex's terrain (and number, if any) never moves during shuffling. */
  fixed?: boolean;
  /** Hexes shuffle only among others sharing the same group (e.g. main island vs. foreign island). Omitted = the default group. */
  group?: number;
  /** Per-scenario cap on how favorable a number this hex may receive after shuffling. */
  maxPipsOnChit?: 1 | 2 | 3 | 4 | 5;
}

export type TemplateCell = HexCell | { type: "empty" };

export interface BoardConstraints {
  /** Minimum pip count required on chits assigned to these hex types. */
  minPipsOnHexTypes?: Partial<Record<ResourceHexType, number>>;
  /** Maximum pip count allowed on chits assigned to these hex types. */
  maxPipsOnHexTypes?: Partial<Record<ResourceHexType, number>>;
  /** Common "fair board" house rule, off by default since it isn't in the official rules. */
  no6and8Adjacent?: boolean;
  /** Common "fair board" house rule, off by default since it isn't in the official rules. */
  noSameNumberAdjacent?: boolean;
}

export interface BoardTemplate {
  name: string;
  /** Row-major grid; each hex conceptually spans 2 columns x 3 rows (see boardFactory). */
  grid: TemplateCell[][];
  constraints?: BoardConstraints;
}

export type NeighborDir = "nw" | "ne" | "e" | "se" | "sw" | "w";
export type Neighbors = Partial<Record<NeighborDir, number>>;

/** A template resolved into flat, renderable form. */
export interface CatanBoard {
  cells: HexCell[];
  neighbors: Neighbors[];
  cssGridTemplateColumns: string;
  cssGridTemplateRows: string;
  cssGridAreas: string[];
  /** width / height the grid container must use for its hexes to render regular, not stretched. */
  aspectRatio: number;
  constraints?: BoardConstraints;
}
