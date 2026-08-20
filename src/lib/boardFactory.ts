import type {
  BoardTemplate,
  CatanBoard,
  HexCell,
  NeighborDir,
  Neighbors,
} from "../data/boards/types";

/**
 * Each hex is laid out on a CSS grid spanning 2 columns x 3 rows: a top and bottom
 * triangle row plus a middle rectangle row, matching a regular hexagon's proportions
 * (triangle height = side/2, rectangle height = side). A single-column "empty" cell
 * lets a row be offset by half a hex-width to produce the honeycomb stagger.
 */
const TRIANGLE_TO_RECTANGLE_RATIO = 0.5;

export class BoardTemplateError extends Error {}

export function buildBoard(template: BoardTemplate): CatanBoard {
  const cells: HexCell[] = [];
  const boardIndices: (number | undefined)[][] = [];
  const cssGridAreas: string[] = [];
  let maxColumn = 0;

  for (let row = 0; row < template.grid.length; row++) {
    boardIndices.push([]);
    const cssRow = 1 + row * 2;
    let cssCol = 1;

    for (const templateCell of template.grid[row]) {
      if (templateCell.type === "empty") {
        cssCol++;
        boardIndices[row].push(undefined);
        continue;
      }

      const index = cells.length;
      cells.push(templateCell);
      cssGridAreas.push(`${cssRow} / ${cssCol} / ${cssRow + 3} / ${cssCol + 2}`);
      boardIndices[row].push(index, index);

      cssCol += 2;
      maxColumn = Math.max(maxColumn, cssCol - 1);
    }
  }

  const neighbors: Neighbors[] = cells.map(() => ({}));
  const offsets: Record<NeighborDir, [number, number]> = {
    nw: [-1, -1],
    ne: [-1, 1],
    e: [0, 2],
    se: [1, 1],
    sw: [1, -1],
    w: [0, -1],
  };
  for (let row = 0; row < boardIndices.length; row++) {
    for (let col = 0; col < boardIndices[row].length; col++) {
      const index = boardIndices[row][col];
      // each hex occupies two consecutive column slots holding the same index; only
      // compute its neighbors once, from the first (left) slot
      if (index === undefined || boardIndices[row][col - 1] === index) continue;
      for (const [dir, [dRow, dCol]] of Object.entries(offsets) as [
        NeighborDir,
        [number, number],
      ][]) {
        const neighborRow = row + dRow;
        const neighborCol = col + dCol;
        const neighborIndex = boardIndices[neighborRow]?.[neighborCol];
        if (neighborIndex !== undefined) neighbors[index][dir] = neighborIndex;
      }
    }
  }

  // A hex's width (flat-to-flat, spanning 2 grid columns) is side*sqrt(3); its height
  // (point-to-point, spanning 2T+1 grid-row units) is 2*side. So a column-fr-unit is
  // side*sqrt(3)/2 real pixels while a row-fr-unit is side pixels - different physical
  // sizes despite both being "1fr" - and the container needs this aspect-ratio for its
  // hexes to come out regular rather than stretched.
  const totalRowUnits = template.grid.length * (TRIANGLE_TO_RECTANGLE_RATIO + 1) + TRIANGLE_TO_RECTANGLE_RATIO;
  const aspectRatio = (maxColumn * (Math.sqrt(3) / 2)) / totalRowUnits;

  return {
    cells,
    neighbors,
    cssGridTemplateColumns: `repeat(${maxColumn}, 1fr)`,
    cssGridTemplateRows: `${`${TRIANGLE_TO_RECTANGLE_RATIO}fr 1fr `.repeat(template.grid.length)}${TRIANGLE_TO_RECTANGLE_RATIO}fr`,
    cssGridAreas,
    aspectRatio,
    constraints: template.constraints,
  };
}
