import type {
  BoardConstraints,
  CatanBoard,
  HexCell,
  NumberChitValue,
  ResourceHexType,
} from "../data/boards/types";
import { PIPS_BY_NUMBER, RESOURCE_BY_HEX } from "../data/boards/types";

function isResourceHexType(type: HexCell["type"]): type is ResourceHexType {
  return type in RESOURCE_BY_HEX;
}

const MAX_ATTEMPTS = 20_000;

export class UnsatisfiableConstraintsError extends Error {}

/** A small, fast, seedable PRNG (mulberry32) so a board can be reproduced from a shared seed. */
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

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function groupIndices(cells: HexCell[], predicate: (cell: HexCell) => boolean): Map<number, number[]> {
  const groups = new Map<number, number[]>();
  cells.forEach((cell, index) => {
    if (!predicate(cell)) return;
    const key = cell.group ?? 0;
    const list = groups.get(key) ?? [];
    list.push(index);
    groups.set(key, list);
  });
  return groups;
}

function shuffleWithinGroups<V>(
  cells: HexCell[],
  groups: Map<number, number[]>,
  rng: () => number,
  read: (cell: HexCell) => V,
  write: (cell: HexCell, value: V) => void
): void {
  for (const indices of groups.values()) {
    const values = shuffle(
      indices.map((i) => read(cells[i])),
      rng
    );
    indices.forEach((cellIndex, i) => write(cells[cellIndex], values[i]));
  }
}

function violatesConstraints(board: CatanBoard, constraints: BoardConstraints | undefined): boolean {
  if (!constraints) return false;
  const { cells, neighbors } = board;

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell.number === undefined) continue;

    // only resource hexes ever carry a number, so this cast is safe
    const resourceType = cell.type as ResourceHexType;
    const min = constraints.minPipsOnHexTypes?.[resourceType];
    const max = constraints.maxPipsOnHexTypes?.[resourceType];
    const pips = PIPS_BY_NUMBER[cell.number];
    if (min !== undefined && pips < min) return true;
    if (max !== undefined && pips > max) return true;
    if (cell.maxPipsOnChit !== undefined && pips > cell.maxPipsOnChit) return true;

    for (const neighborIndex of Object.values(neighbors[i])) {
      const neighbor = cells[neighborIndex];
      if (neighbor.number === undefined) continue;
      if (constraints.no6and8Adjacent) {
        const both68 = [6, 8].includes(cell.number) && [6, 8].includes(neighbor.number);
        if (both68) return true;
      }
      if (constraints.noSameNumberAdjacent && cell.number === neighbor.number) return true;
    }
  }
  return false;
}

export interface GeneratedBoard {
  board: CatanBoard;
  seed: number;
}

export function generateBoard(base: CatanBoard, seed: number = randomSeed()): GeneratedBoard {
  const rng = mulberry32(seed);
  const terrainGroups = groupIndices(base.cells, (c) => !c.fixed && c.type !== "sea");

  // The pool of chit values to place per group, captured once from the template. Which
  // *positions* within a group get a chit is decided fresh each attempt, after terrain is
  // shuffled - a hex only gets a number if it actually ended up resource-producing (the
  // desert moves around like any other tile, so "has no number" must follow it, not stay
  // pinned to whatever position happened to be the desert in the template).
  const numberPoolByGroup = new Map<number, NumberChitValue[]>();
  for (const [group, indices] of groupIndices(base.cells, (c) => !c.fixed && c.number !== undefined)) {
    numberPoolByGroup.set(
      group,
      indices.map((i) => base.cells[i].number as NumberChitValue)
    );
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const cells = base.cells.map((cell) => ({
      ...cell,
      number: cell.fixed ? cell.number : undefined,
    }));
    const board: CatanBoard = { ...base, cells };

    shuffleWithinGroups(
      cells,
      terrainGroups,
      rng,
      (c) => c.type,
      (c, v) => (c.type = v)
    );

    for (const [group, pool] of numberPoolByGroup) {
      // Shuffled too: some scenarios (The Forgotten Tribe) have more resource hexes than chits,
      // so a few end up numberless - which ones should vary by seed, not always be the same
      // fixed leftovers from the template's array order.
      const destinations = shuffle(
        (terrainGroups.get(group) ?? []).filter((i) => isResourceHexType(cells[i].type)),
        rng
      );
      const values = shuffle(pool, rng);
      destinations.forEach((cellIndex, i) => (cells[cellIndex].number = values[i]));
    }

    if (!violatesConstraints(board, base.constraints)) {
      return { board, seed };
    }
  }

  throw new UnsatisfiableConstraintsError(
    `Could not generate a board satisfying constraints after ${MAX_ATTEMPTS} attempts. Try relaxing them.`
  );
}
