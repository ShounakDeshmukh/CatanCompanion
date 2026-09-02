import type {
  CatanBoard,
  CatanBoardTemplate,
  FixNumbersInGroupStrict,
  Hex,
  MaxPipsOnChit,
  Neighbors,
  NeighborDirection,
} from "../data/boards/types";

/**
 * Hexes are drawn pointy-top, so splitting one into a top triangle, a middle rectangle and a
 * bottom triangle gives a triangle altitude of half the side length. Expressing that as CSS
 * `fr` units is what keeps the hexes regular at any board size: a hex spans two columns and
 * three row tracks laid out `0.5fr 1fr 0.5fr`, and consecutive rows deliberately share the
 * triangle track between them, which is how the honeycomb interlocks.
 */
const SIDE_LENGTH = 1;
const TRIANGLE_ALTITUDE = SIDE_LENGTH / 2;
const HEX_WIDTH = Math.sqrt(3) * SIDE_LENGTH;
const TRIANGLE_TO_SIDE_RATIO = TRIANGLE_ALTITUDE / SIDE_LENGTH;

export class BoardSpecError extends Error {}

const NEIGHBOR_OFFSETS: Record<NeighborDirection, [number, number]> = {
  nw: [-1, -1],
  ne: [-1, 1],
  // a hex occupies two column slots that both hold its index, so its east neighbour starts
  // two slots along while its west neighbour's second slot is one slot back
  e: [0, 2],
  se: [1, 1],
  sw: [1, -1],
  w: [0, -1],
};

export function buildBoard(template: CatanBoardTemplate): CatanBoard {
  const flat = template.board.flat().filter((hex) => hex.type !== "empty");

  validate(flat);

  // maxPipsOnChit describes a board *position*, not the hex sitting on it, so lift it out
  // before the hexes are ever shuffled
  const maxPipsOnChits: MaxPipsOnChit[] = flat.map((hex) => hex.maxPipsOnChit ?? 5);
  const recommendedLayout = flat.map(({ maxPipsOnChit, ...hex }) => hex) as Hex[];

  const { boardIndices, cssGridAreas, maxColumn } = layOut(template);

  const cssGridTemplateRows = `${TRIANGLE_TO_SIDE_RATIO}fr 1fr `
    .repeat(template.board.length)
    .concat(`${TRIANGLE_TO_SIDE_RATIO}fr`);

  // the grid is drawn inside a square, so whichever axis is shorter gets a percentage
  const width = (HEX_WIDTH * maxColumn) / 2;
  const height = TRIANGLE_ALTITUDE + (SIDE_LENGTH + TRIANGLE_ALTITUDE) * template.board.length;
  const boardWidthPercentage = height > width ? `${(width / height) * 100}%` : undefined;
  const boardHeightPercentage = width > height ? `${(height / width) * 100}%` : undefined;

  return {
    recommendedLayout,
    neighbors: findNeighbors(boardIndices),
    cssGridTemplateColumns: `repeat(${maxColumn}, 1fr)`,
    cssGridTemplateRows,
    cssGridAreas,
    boardWidthPercentage,
    boardHeightPercentage,
    horizontal: template.horizontal,
    minPipsOnHexTypes: template.minPipsOnHexTypes,
    maxPipsOnHexTypes: template.maxPipsOnHexTypes,
    maxPipsOnChits,
    fixNumbersInGroups: resolveFixedGroups(template, flat),
    shufflePortTypes: template.shufflePortTypes,
    facedownStack: template.facedownStack,
  };
}

function validate(flat: { type: string; [key: string]: unknown }[]): void {
  for (const hex of flat) {
    const port = hex.port as { fixed?: boolean; moveable?: boolean } | undefined;
    if (hex.fixed) continue;
    if (port?.fixed) {
      throw new BoardSpecError("A fixed port cannot sit on a hex that shuffles");
    }
    if (port && !port.moveable) {
      throw new BoardSpecError("A port on a shuffling hex must be marked moveable");
    }
  }

  const grouped = flat.some((hex) => hex.group !== undefined);
  const numberGrouped = flat.some((hex) => hex.numberGroup !== undefined);
  if (grouped && numberGrouped) {
    throw new BoardSpecError("A board may use group or numberGroup, not both");
  }
  if (numberGrouped && flat.some((hex) => hex.number === undefined && !hex.fixed)) {
    throw new BoardSpecError(
      "With numberGroup, every hex without a number must be fixed, or the groups end up " +
        "with mismatched numbers of places to put chits"
    );
  }
}

/**
 * Walks the template, assigning each hex its CSS grid area and recording which board index
 * occupies each half-column slot. A hex covers two slots so that diagonal neighbours, which
 * sit half a hex to the side, land on a slot of their own.
 */
function layOut(template: CatanBoardTemplate) {
  const boardIndices: (number | undefined)[][] = [];
  const cssGridAreas: string[] = [];
  let maxColumn = 0;
  let index = 0;

  for (let row = 0; row < template.board.length; row++) {
    const slots: (number | undefined)[] = [];
    boardIndices.push(slots);
    const cssRow = 1 + row * 2;
    let cssCol = 1;

    for (const hex of template.board[row]) {
      if (hex.type === "empty") {
        cssCol++;
        slots.push(undefined);
        continue;
      }
      cssGridAreas.push(`${cssRow} / ${cssCol} / ${cssRow + 3} / ${cssCol + 2}`);
      cssCol += 2;
      // grid line ends are exclusive
      maxColumn = Math.max(maxColumn, cssCol - 1);
      slots.push(index, index);
      index++;
    }
  }

  return { boardIndices, cssGridAreas, maxColumn };
}

function findNeighbors(boardIndices: (number | undefined)[][]): Neighbors[] {
  const neighbors: Neighbors[] = [];

  for (let row = 0; row < boardIndices.length; row++) {
    for (let col = 0; col < boardIndices[row].length; col++) {
      if (boardIndices[row][col] === undefined) continue;

      const found: Neighbors = {};
      neighbors.push(found);
      for (const [dir, [dRow, dCol]] of Object.entries(NEIGHBOR_OFFSETS) as [
        NeighborDirection,
        [number, number],
      ][]) {
        const neighbor = boardIndices[row + dRow]?.[col + dCol];
        if (neighbor !== undefined) found[dir] = neighbor;
      }

      // the hex covers this slot and the next, so skip its second slot
      col++;
    }
  }

  return neighbors;
}

function resolveFixedGroups(
  template: CatanBoardTemplate,
  flat: { group?: unknown }[]
): FixNumbersInGroupStrict[] | undefined {
  if (!template.fixNumbersInGroups) return undefined;

  if (template.fixNumbersInGroups.includes("all")) {
    return Array.from(new Set(flat.map((hex) => hex.group))) as FixNumbersInGroupStrict[];
  }

  const groups = new Set(flat.map((hex) => hex.group));
  const missing = template.fixNumbersInGroups.filter((group) => !groups.has(group));
  if (missing.length > 0) {
    throw new BoardSpecError(`fixNumbersInGroups names groups no hex belongs to: ${missing}`);
  }
  return template.fixNumbersInGroups as FixNumbersInGroupStrict[];
}
