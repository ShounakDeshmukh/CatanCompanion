import type {
  CatanBoard,
  GroupNumber,
  Hex,
  NeighborDirection,
  NumberChitValue,
  Orientation,
  Port,
  ResourceHexType,
} from "../data/boards/types";
import { RESOURCE_BY_HEX, pipsForNumber } from "../data/boards/types";

/**
 * The optional fairness rules the UI offers. None of them are official: the rule books only
 * ever ask that red discs (6 and 8) not touch, and then only in some scenarios.
 *
 * The numeric limits are expressed as "at most", so their maximum value means unconstrained.
 */
export interface ShuffleConstraints {
  /** Red discs may not touch. */
  noAdjacentSixEight: boolean;
  /** The two rarest discs may not touch. */
  noAdjacentTwoTwelve: boolean;
  /** No two hexes showing the same number may touch. */
  noAdjacentPairs: boolean;
  /** Largest run of touching same-terrain hexes. 7 or more is unconstrained. */
  maxConnectedLikeTerrain: number;
  /** Largest pip total across the three hexes meeting at a corner. 15 is unconstrained. */
  maxIntersectionPipCount: number;
  /** Fewest separate landmasses the board must end up with. 1 is unconstrained. */
  minIslandCount: number;
}

export const UNCONSTRAINED: ShuffleConstraints = {
  noAdjacentSixEight: false,
  noAdjacentTwoTwelve: false,
  noAdjacentPairs: false,
  maxConnectedLikeTerrain: 7,
  maxIntersectionPipCount: 15,
  minIslandCount: 1,
};

const MAX_ATTEMPTS = 20_000;

/**
 * Some settings are genuinely impossible together - a tight corner pip cap needs more low
 * chits than the box contains, for instance. Directed placement finds a workable board in
 * milliseconds when one exists, so anything still going after this long is not going to
 * succeed, and the page should say so rather than freeze.
 */
const TIME_BUDGET_MS = 1_500;

export class UnsatisfiableConstraintsError extends Error {}

/** mulberry32: small, fast and seedable, so a board can be rebuilt from a shared link. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

function isResourceHex(hex: Hex): hex is Hex & { type: ResourceHexType } {
  return hex.type in RESOURCE_BY_HEX;
}

function hexPips(hex: Hex): number {
  if (hex.number === undefined) return 0;
  return pipsForNumber(hex.number) + (hex.secondNumber ? pipsForNumber(hex.secondNumber) : 0);
}

/** Groups positions by their shuffle group, keeping only those the caller cares about. */
function groupPositions(
  hexes: Hex[],
  key: (hex: Hex) => GroupNumber | undefined,
  include: (hex: Hex) => boolean
): Map<GroupNumber | undefined, number[]> {
  const groups = new Map<GroupNumber | undefined, number[]>();
  hexes.forEach((hex, index) => {
    if (!include(hex)) return;
    const group = key(hex);
    const positions = groups.get(group);
    if (positions) positions.push(index);
    else groups.set(group, [index]);
  });
  return groups;
}

function shuffleInPlace<T>(items: T[], rng: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

/**
 * Size of the same-terrain clump `position` would join, counting only hexes already placed.
 * Clumps only grow as placement proceeds, so checking on the way in is enough.
 */
function clumpSizeAt(
  board: CatanBoard,
  hexes: Hex[],
  position: number,
  placed: (index: number) => boolean
): number {
  const type = hexes[position].type;
  const seen = new Set([position]);
  const stack = [position];
  let size = 0;
  while (stack.length > 0) {
    const current = stack.pop() as number;
    size++;
    for (const neighbor of Object.values(board.neighbors[current])) {
      if (seen.has(neighbor) || !placed(neighbor)) continue;
      if (hexes[neighbor].type !== type) continue;
      seen.add(neighbor);
      stack.push(neighbor);
    }
  }
  return size;
}

/**
 * Fills one group's positions with its own hexes, refusing any placement that would build a
 * same-terrain clump larger than `maxClump`.
 *
 * Placing with the limit in mind rather than shuffling blindly and re-rolling matters a lot:
 * on The Six Islands, "no two alike may touch" is satisfied by roughly one random arrangement
 * in fifty thousand, so blind retries mostly just fail. Choosing only from tiles that still
 * fit finds one almost immediately.
 */
function fillGroup(
  board: CatanBoard,
  hexes: Hex[],
  positions: number[],
  rng: () => number,
  maxClump: number
): boolean {
  const pool = positions.map((index) => hexes[index]);

  for (let attempt = 0; attempt < 60; attempt++) {
    const remaining = pool.slice();
    shuffleInPlace(remaining, rng);
    const order = positions.slice();
    shuffleInPlace(order, rng);

    // anything outside this group is already settled and counts as a neighbour
    const pending = new Set(positions);
    const placed = (index: number) => !pending.has(index);

    let stuck = false;
    for (const position of order) {
      let chosen = -1;
      for (let i = 0; i < remaining.length; i++) {
        hexes[position] = remaining[i];
        pending.delete(position);
        const fits =
          remaining[i].type === "sea" ||
          clumpSizeAt(board, hexes, position, placed) <= maxClump;
        pending.add(position);
        if (fits) {
          chosen = i;
          break;
        }
      }
      if (chosen === -1) {
        stuck = true;
        break;
      }
      hexes[position] = remaining[chosen];
      remaining.splice(chosen, 1);
      pending.delete(position);
    }

    if (!stuck) return true;
    // put the group back the way it was before trying again
    positions.forEach((index, i) => (hexes[index] = pool[i]));
  }

  return false;
}

/**
 * Moves whole hexes between the non-fixed positions of each group.
 *
 * Whole hexes rather than just terrain types, because a group can legitimately contain sea:
 * that is how a small island is allowed to sit anywhere within its region instead of being
 * pinned to one arrangement. Numbers ride along with their hex here and are redistributed
 * afterwards, which is what keeps the desert from ever acquiring a chit.
 */
function shuffleTerrain(
  board: CatanBoard,
  hexes: Hex[],
  rng: () => number,
  maxClump: number
): boolean {
  const groups = groupPositions(
    hexes,
    (hex) => hex.group,
    (hex) => !hex.fixed
  );

  for (const positions of groups.values()) {
    if (maxClump >= 7) {
      const moved = positions.map((index) => hexes[index]);
      shuffleInPlace(moved, rng);
      positions.forEach((index, i) => (hexes[index] = moved[i]));
      continue;
    }
    if (!fillGroup(board, hexes, positions, rng, maxClump)) return false;
  }

  return true;
}

/** The six corners of a hex, each named by the two neighbours that meet there. */
const CORNERS: [NeighborDirection, NeighborDirection][] = [
  ["w", "nw"],
  ["nw", "ne"],
  ["ne", "e"],
  ["e", "se"],
  ["se", "sw"],
  ["sw", "w"],
];

/** Whether the chit now sitting on `position` is legal given the chits already placed. */
function chitFits(
  board: CatanBoard,
  hexes: Hex[],
  constraints: ShuffleConstraints,
  position: number,
  settled: (index: number) => boolean
): boolean {
  const hex = hexes[position];
  const pips = hexPips(hex);
  if (pips > board.maxPipsOnChits[position]) return false;

  if (isResourceHex(hex)) {
    const min = board.minPipsOnHexTypes?.[hex.type];
    const max = board.maxPipsOnHexTypes?.[hex.type];
    if (min !== undefined && pips < min) return false;
    if (max !== undefined && pips > max) return false;
  }

  for (const neighborIndex of Object.values(board.neighbors[position])) {
    const neighbor = hexes[neighborIndex];
    if (neighbor.number === undefined || !settled(neighborIndex)) continue;
    if (
      constraints.noAdjacentSixEight &&
      [6, 8].includes(hex.number as number) &&
      [6, 8].includes(neighbor.number)
    ) {
      return false;
    }
    if (
      constraints.noAdjacentTwoTwelve &&
      [2, 12].includes(hex.number as number) &&
      [2, 12].includes(neighbor.number)
    ) {
      return false;
    }
    if (constraints.noAdjacentPairs && hex.number === neighbor.number) return false;
  }

  // a corner can only be judged once all three of its hexes are settled
  if (constraints.maxIntersectionPipCount < 15) {
    for (const [a, b] of CORNERS) {
      const first = board.neighbors[position][a];
      const second = board.neighbors[position][b];
      if (first === undefined || second === undefined) continue;
      if (!settled(first) || !settled(second)) continue;
      const total = pips + hexPips(hexes[first]) + hexPips(hexes[second]);
      if (total > constraints.maxIntersectionPipCount) return false;
    }
  }

  return true;
}

/**
 * Deals one group's chits out position by position, taking only ones that still fit.
 *
 * Same reasoning as fillGroup: with several adjacency rules on at once, a valid arrangement
 * is rare enough that shuffling and re-rolling spends seconds finding what directed placement
 * finds immediately.
 */
function fillChits(
  board: CatanBoard,
  hexes: Hex[],
  constraints: ShuffleConstraints,
  positions: number[],
  chits: { number: NumberChitValue; secondNumber?: NumberChitValue }[],
  rng: () => number
): boolean {
  for (let attempt = 0; attempt < 60; attempt++) {
    const remaining = chits.slice();
    shuffleInPlace(remaining, rng);
    const order = positions.slice();
    shuffleInPlace(order, rng);

    const pending = new Set(positions);
    const settled = (index: number) => !pending.has(index);
    for (const position of positions) hexes[position] = { ...hexes[position], number: undefined } as Hex;

    let stuck = false;
    for (const position of order) {
      let chosen = -1;
      for (let i = 0; i < remaining.length; i++) {
        hexes[position] = { ...hexes[position], ...remaining[i] } as Hex;
        if (chitFits(board, hexes, constraints, position, settled)) {
          chosen = i;
          break;
        }
      }
      if (chosen === -1) {
        stuck = true;
        break;
      }
      hexes[position] = { ...hexes[position], ...remaining[chosen] } as Hex;
      remaining.splice(chosen, 1);
      pending.delete(position);
    }

    if (!stuck) return true;
  }

  return false;
}

function shuffleNumbers(
  board: CatanBoard,
  hexes: Hex[],
  constraints: ShuffleConstraints,
  rng: () => number
): boolean {
  const usesNumberGroups = hexes.some((hex) => hex.numberGroup !== undefined);
  const groups = groupPositions(
    hexes,
    (hex) => (usesNumberGroups ? hex.numberGroup : hex.group),
    // a fixed hex keeps the disc the rule book printed on it - cloth villages, for instance
    (hex) => hex.number !== undefined && !hex.fixed
  );

  const directed =
    constraints.noAdjacentSixEight ||
    constraints.noAdjacentTwoTwelve ||
    constraints.noAdjacentPairs ||
    constraints.maxIntersectionPipCount < 15;

  for (const [group, positions] of groups) {
    if (board.fixNumbersInGroups?.includes(group)) continue;
    const chits = positions.map((index) => ({
      number: hexes[index].number as NumberChitValue,
      secondNumber: hexes[index].secondNumber,
    }));

    if (!directed) {
      shuffleInPlace(chits, rng);
      positions.forEach((index, i) => {
        hexes[index] = { ...hexes[index], ...chits[i] } as Hex;
      });
      continue;
    }
    if (!fillChits(board, hexes, constraints, positions, chits, rng)) return false;
  }

  return true;
}

/**
 * A port's orientation names the neighbour its docks point at, in degrees clockwise from
 * west-facing.
 */
const DIRECTIONS: NeighborDirection[] = ["w", "nw", "ne", "e", "se", "sw"];
const ORIENTATION_BY_DIRECTION: Record<NeighborDirection, Orientation> = {
  w: 0,
  nw: 60,
  ne: 120,
  e: 180,
  se: 240,
  sw: 300,
};

/** Sea, and the things that are not yet known to be land, cannot host a settlement. */
const NOT_LAND = new Set(["sea", "fog"]);

/**
 * Where a port on `index` could point. A port needs land across the edge it faces, and no
 * two ports may aim at the same intersection - which rules out a port on the neighbour to
 * either side pointing back at the edge this one would share with it.
 */
function validPortOrientations(board: CatanBoard, hexes: Hex[], index: number): Orientation[] {
  const hex = hexes[index];
  if (hex.type !== "sea" || hex.port || hex.portsAllowed === false) return [];

  const neighbors = board.neighbors[index];
  const valid: Orientation[] = [];

  DIRECTIONS.forEach((heading, i) => {
    const counter = DIRECTIONS[(i + DIRECTIONS.length - 1) % DIRECTIONS.length];
    const clockwise = DIRECTIONS[(i + 1) % DIRECTIONS.length];

    const facing = neighbors[heading];
    if (facing === undefined || NOT_LAND.has(hexes[facing].type)) return;

    const counterNeighbor = neighbors[counter];
    if (
      counterNeighbor !== undefined &&
      hexes[counterNeighbor].port?.orientation === ORIENTATION_BY_DIRECTION[clockwise]
    ) {
      return;
    }

    const clockwiseNeighbor = neighbors[clockwise];
    if (
      clockwiseNeighbor !== undefined &&
      hexes[clockwiseNeighbor].port?.orientation === ORIENTATION_BY_DIRECTION[counter]
    ) {
      return;
    }

    valid.push(ORIENTATION_BY_DIRECTION[heading]);
  });

  return valid;
}

/**
 * Re-sites the ports that are allowed to move.
 *
 * Only ports marked `moveable` are touched. A printed harbour keeps both its place and its
 * type, which is what the frame in the box does; New World is the scenario where players
 * place the port tokens themselves, and there the docks have to end up somewhere they can
 * actually trade - facing land, and never two docks at one intersection.
 *
 * Moveable ports have to be re-sited rather than left alone because terrain shuffling moves
 * whole hexes, so a harbour would otherwise drift into open water on its sea hex. Returns
 * false if the ports will not all fit, which the caller treats like any other failed attempt.
 */
function shufflePorts(board: CatanBoard, hexes: Hex[], rng: () => number): boolean {
  const loose = board.recommendedLayout
    .filter((hex) => hex.port?.moveable)
    .map((hex) => hex.port as Port);
  if (loose.length === 0) return true;
  shuffleInPlace(loose, rng);

  for (const [i, hex] of hexes.entries()) {
    if (!hex.port?.moveable) continue;
    const { port, ...rest } = hex as Hex & { port?: Port };
    hexes[i] = rest as Hex;
  }

  const candidates = hexes.map((_, i) => i).filter((i) => hexes[i].type === "sea");
  shuffleInPlace(candidates, rng);

  for (const index of candidates) {
    const orientations = validPortOrientations(board, hexes, index);
    if (orientations.length === 0) continue;
    const orientation = orientations[Math.floor(rng() * orientations.length)];
    const next = loose.pop() as Port;
    hexes[index] = {
      ...hexes[index],
      port: { type: next.type, orientation, moveable: true },
    } as Hex;
    if (loose.length === 0) return true;
  }

  return false;
}

/** Hexes reachable from `start` over neighbours the predicate accepts. */
function componentSize(
  board: CatanBoard,
  start: number,
  seen: Set<number>,
  connected: (from: number, to: number) => boolean
): number {
  let size = 0;
  const stack = [start];
  seen.add(start);
  while (stack.length > 0) {
    const current = stack.pop() as number;
    size++;
    for (const neighbor of Object.values(board.neighbors[current])) {
      if (!seen.has(neighbor) && connected(current, neighbor)) {
        seen.add(neighbor);
        stack.push(neighbor);
      }
    }
  }
  return size;
}

function violatesConstraints(
  board: CatanBoard,
  hexes: Hex[],
  constraints: ShuffleConstraints
): boolean {
  for (let i = 0; i < hexes.length; i++) {
    const hex = hexes[i];

    // pip limits govern where the shuffler may put a chit. A fixed hex holds the chit the
    // rule book printed on it - a cloth village's paired discs run to seven pips - so those
    // are exempt.
    if (hex.number !== undefined && !hex.fixed) {
      const pips = hexPips(hex);
      if (pips > board.maxPipsOnChits[i]) return true;

      if (isResourceHex(hex)) {
        const min = board.minPipsOnHexTypes?.[hex.type];
        const max = board.maxPipsOnHexTypes?.[hex.type];
        if (min !== undefined && pips < min) return true;
        if (max !== undefined && pips > max) return true;
      }
    }

    if (hex.number !== undefined) {
      for (const neighborIndex of Object.values(board.neighbors[i])) {
        const neighbor = hexes[neighborIndex];
        if (neighbor.number === undefined) continue;
        if (
          constraints.noAdjacentSixEight &&
          [6, 8].includes(hex.number) &&
          [6, 8].includes(neighbor.number)
        ) {
          return true;
        }
        if (
          constraints.noAdjacentTwoTwelve &&
          [2, 12].includes(hex.number) &&
          [2, 12].includes(neighbor.number)
        ) {
          return true;
        }
        if (constraints.noAdjacentPairs && hex.number === neighbor.number) return true;
      }
    }

    // a settlement sits on a corner and collects from all three hexes touching it
    if (constraints.maxIntersectionPipCount < 15) {
      for (const [a, b] of CORNERS) {
        const first = board.neighbors[i][a];
        const second = board.neighbors[i][b];
        if (first === undefined || second === undefined) continue;
        const total = hexPips(hex) + hexPips(hexes[first]) + hexPips(hexes[second]);
        if (total > constraints.maxIntersectionPipCount) return true;
      }
    }
  }

  /*
   * Only what the shuffler placed is judged here.
   *
   * Sea is skipped because a run of ocean is not a fairness problem, and fixed hexes are
   * skipped because they are mandatory layout: Through the Desert's three deserts are printed
   * as a strip that splits the island, so counting them would make any cap below three
   * unsatisfiable through no fault of the shuffle. Fixed hexes act as walls, the same as sea.
   */
  if (constraints.maxConnectedLikeTerrain < 7) {
    const shufflable = (i: number) => hexes[i].type !== "sea" && !hexes[i].fixed;
    const seen = new Set<number>();
    for (let i = 0; i < hexes.length; i++) {
      if (seen.has(i) || !shufflable(i)) continue;
      const size = componentSize(
        board,
        i,
        seen,
        (from, to) => shufflable(to) && hexes[from].type === hexes[to].type
      );
      if (size > constraints.maxConnectedLikeTerrain) return true;
    }
  }

  if (constraints.minIslandCount > 1) {
    const seen = new Set<number>();
    let islands = 0;
    for (let i = 0; i < hexes.length; i++) {
      if (seen.has(i) || hexes[i].type === "sea") continue;
      componentSize(board, i, seen, (_, to) => hexes[to].type !== "sea");
      islands++;
    }
    if (islands < constraints.minIslandCount) return true;
  }

  return false;
}

export interface GeneratedBoard {
  hexes: Hex[];
  seed: number;
}

export function generateBoard(
  board: CatanBoard,
  constraints: ShuffleConstraints,
  seed: number = randomSeed()
): GeneratedBoard {
  const rng = mulberry32(seed);
  const deadline = Date.now() + TIME_BUDGET_MS;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if ((attempt & 0x3f) === 0x3f && Date.now() > deadline) break;

    const hexes = board.recommendedLayout.map((hex) => ({ ...hex })) as Hex[];
    if (!shuffleTerrain(board, hexes, rng, constraints.maxConnectedLikeTerrain)) continue;
    if (!shuffleNumbers(board, hexes, constraints, rng)) continue;
    if (!shufflePorts(board, hexes, rng)) continue;
    if (!violatesConstraints(board, hexes, constraints)) return { hexes, seed };
  }

  throw new UnsatisfiableConstraintsError(
    "No board satisfies all of these settings. Some combinations are genuinely impossible " +
      "rather than merely rare - a low pip cap per corner needs plenty of low-value discs to " +
      "go round, for instance. Try relaxing the tightest one."
  );
}
