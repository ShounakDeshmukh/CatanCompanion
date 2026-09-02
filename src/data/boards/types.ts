import type { Range, StrictUnion } from "../../lib/typeUtils";

export type ResourceHexType =
  | "hills"
  | "forest"
  | "pasture"
  | "fields"
  | "mountains"
  | "gold";
export type NonResourceHexType = "desert" | "sea" | "fog" | "village";
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

/** Pips on a chit: 6 - |7 - n|, so 6 and 8 carry five and 2 and 12 carry one. */
export function pipsForNumber(value: NumberChitValue): number {
  return 6 - Math.abs(7 - value);
}

/**
 * Degrees clockwise. A hex is drawn pointy-top, so its six edges - and therefore its six
 * neighbours - sit at multiples of 60 degrees.
 */
export type Orientation = 0 | 60 | 120 | 180 | 240 | 300;

export type PortType = "3:1" | Resource;

/**
 * A harbor, drawn as a full-hex overlay on a sea hex and rotated so its docks face one
 * specific edge. `orientation` is measured in degrees from west-facing, which is what makes
 * it possible to reproduce the rule books' harbor placement exactly rather than approximately.
 */
export type Port = {
  type: PortType;
  orientation: Orientation;
} & StrictUnion<
  | {
      /** This harbor never moves. Only valid on a fixed hex. */
      fixed?: boolean;
    }
  | {
      /**
       * This harbor may be re-sited onto any sea hex whose docks would both face land, as
       * New World's setup allows. Only valid on a fixed hex.
       */
      moveable?: boolean;
    }
>;

/**
 * Something the setup places on a hex *edge* rather than on the hex itself. The Forgotten
 * Tribe scatters victory point tokens and face-down development cards along the shipping
 * lanes, to be collected by the first ship to reach them. Like a port, an edge item names
 * the edge it sits on by the direction it faces.
 */
export type EdgeItemKind = "victoryPoint" | "developmentCard";

export interface EdgeItem {
  kind: EdgeItemKind;
  orientation: Orientation;
}

/**
 * Group numbers start at 1 because a lot of grouping logic tests truthiness, and group 0
 * would read as "no group".
 */
export type GroupNumber = Range<1, 20>;

/**
 * A single hex on a board.
 *
 * The union is deliberately strict: only sea hexes may carry a port, only resource hexes may
 * carry a number, and so on. `T` exists so {@link HexTemplate} can widen the resource variant
 * with template-only fields without losing that strictness.
 */
export type Hex<T extends Record<string, unknown> = never> = StrictUnion<
  | T
  | {
      type: ResourceHexType;
      number?: NumberChitValue;
      /**
       * Shuffles chits in their own groups while leaving terrain in one pool. Mutually
       * exclusive with `group`; enforced at board build time.
       */
      numberGroup?: GroupNumber;
    }
  | {
      type: ResourceHexType;
      number: NumberChitValue;
      /**
       * A chit permanently paired with `number`, e.g. the combined 2/12. It follows the
       * first chit around during shuffling and counts toward pip totals.
       */
      secondNumber?: NumberChitValue;
      numberGroup?: GroupNumber;
    }
  | {
      type: "sea";
      port?: Port;
      /** Only needed to say "no port here"; sea hexes allow ports by default. */
      portsAllowed?: true;
    }
  | { type: "sea"; portsAllowed: false }
  | {
      /**
       * A cloth village from Cloth for Catan. It produces cloth rather than a resource, and
       * carries a disc on each of two opposite edges - which is why the rule book counts
       * eight discs across the four village islands.
       */
      type: "village";
      number: NumberChitValue;
      secondNumber: NumberChitValue;
    }
  | { type: Exclude<NonResourceHexType, "sea" | "village"> }
> & {
  /** This hex never moves during shuffling. */
  fixed?: boolean;
  /**
   * Scenarios that shuffle several pools separately - a main island and its small islands,
   * say - label everything outside the main pool with a group number. Note that sea hexes
   * can belong to a group too: that is how an island is allowed to land anywhere inside its
   * region rather than being pinned to one arrangement.
   */
  group?: GroupNumber;
  /** Rotation applied to the hex when drawn, for directional terrain. */
  orientation?: Orientation;
  /** Tokens sitting on this hex's edges. Purely scenario furniture; never shuffled. */
  edgeItems?: EdgeItem[];
};

/**
 * The most favorable chit a given board *position* may hold, where 5 means unrestricted.
 * Used for instructions like "these three hexes should not receive 5, 6, 8 or 9". This is
 * pinned to the position and does not travel with the hex that happens to sit there, which
 * is why the factory lifts it out into a parallel array.
 */
export type MaxPipsOnChit = 1 | 2 | 3 | 4 | 5;

export type HexTemplate = StrictUnion<
  | Hex<{
      type: ResourceHexType;
      number: NumberChitValue;
      maxPipsOnChit: MaxPipsOnChit;
    }>
  | { type: "empty" }
>;

/**
 * What goes in the facedown stack for The Fog Islands. Those board positions are drawn as
 * unknown and are not shuffled here: the host lays the stack out at the table, revealing a
 * hex as each is explored. This is the pile they draw from.
 */
export interface FacedownStack {
  terrain: Partial<Record<HexType, number>>;
  chits: Partial<Record<NumberChitValue, number>>;
}

export type MinPipsOnHexTypes = { [type in ResourceHexType]?: 2 | 3 | 4 | 5 };
export type MaxPipsOnHexTypes = { [type in ResourceHexType]?: 1 | 2 | 3 | 4 };

/**
 * Leave the chits in these groups where they are. `undefined` names the default (ungrouped)
 * pool; `"all"` names every group on the board.
 */
export type FixNumbersInGroup = GroupNumber | undefined | "all";
export type FixNumbersInGroupStrict = Exclude<FixNumbersInGroup, "all">;

/**
 * A board as it is written down.
 *
 * `board` is row-major and each hex spans two grid columns, so a single `{ type: "empty" }`
 * is a half-hex of indent - that is what produces the honeycomb stagger. Written out, a board
 * looks like the shape it renders as:
 *
 * ```
 *    s s s s          e e e s s s s
 *   s t t t s         e e s t t t s
 *  s t t t t s   ->   e s t t t t s
 * s t t t t t s       s t t t t t s
 *  s t t t t s        e s t t t t s
 *   s t t t s         e e s t t t s
 *    s s s s          e e e s s s s
 * ```
 */
export interface CatanBoardTemplate {
  board: HexTemplate[][];
  /**
   * Seafarers boards are printed rotated relative to this grid. When set, the board is
   * written top-to-bottom (columns) right-to-left (rows) and rotated 90 degrees when drawn,
   * with the number chits counter-rotated so they stay upright.
   */
  horizontal?: boolean;
  minPipsOnHexTypes?: MinPipsOnHexTypes;
  maxPipsOnHexTypes?: MaxPipsOnHexTypes;
  fixNumbersInGroups?: FixNumbersInGroup[];
  /** See {@link FacedownStack}. Only the Fog Islands scenarios have one. */
  facedownStack?: FacedownStack;
}

export type NeighborDirection = "nw" | "ne" | "e" | "se" | "sw" | "w";
/** Directions are relative to the written (vertical) board, not the drawn one. */
export type Neighbors = Partial<Record<NeighborDirection, number>>;

/** A template resolved into flat, renderable form. Hexes run left to right, top to bottom. */
export interface CatanBoard {
  /** The layout the rule book recommends, and the pool every shuffle draws from. */
  recommendedLayout: Hex[];
  neighbors: Neighbors[];
  cssGridTemplateColumns: string;
  cssGridTemplateRows: string;
  cssGridAreas: string[];
  /** Set on non-square boards to hold the hexes at their true proportions. */
  boardWidthPercentage?: string;
  boardHeightPercentage?: string;
  horizontal?: boolean;
  minPipsOnHexTypes?: MinPipsOnHexTypes;
  maxPipsOnHexTypes?: MaxPipsOnHexTypes;
  /** Indexed by hex position, never by hex. See {@link MaxPipsOnChit}. */
  maxPipsOnChits: MaxPipsOnChit[];
  fixNumbersInGroups?: FixNumbersInGroupStrict[];
  facedownStack?: FacedownStack;
}
