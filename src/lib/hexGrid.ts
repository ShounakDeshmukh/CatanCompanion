import type { HexCell, PortType, TemplateCell } from "../data/boards/types";

export const sea = (): HexCell => ({ type: "sea", fixed: true });
export const harbor = (type: PortType): HexCell => ({
  type: "sea",
  fixed: true,
  port: { type, fixed: true },
});

/**
 * Describes a board whose land forms a symmetric blob (each land row flanked by exactly one
 * sea hex on either side, capped by an all-sea row above and below) — true of every board in
 * this app so far. Authoring a board means supplying these natural row groupings instead of a
 * raw padded grid; buildHexagonGrid derives the full row-major template (with the correct
 * "empty" left-padding for the CSS grid hex trick — see boardFactory.ts) from them.
 */
export interface HexagonSpec {
  landRows: HexCell[][];
  /** One sea hex per land row, left side, top to bottom. */
  leftBorder: HexCell[];
  /** One sea hex per land row, right side, top to bottom. */
  rightBorder: HexCell[];
  /** All-sea row above the land, length = landRows[0].length + 1. */
  topCap: HexCell[];
  /** All-sea row below the land, length = landRows.at(-1).length + 1. */
  bottomCap: HexCell[];
}

export function buildHexagonGrid(spec: HexagonSpec): TemplateCell[][] {
  const fullRows: HexCell[][] = [
    spec.topCap,
    ...spec.landRows.map((land, i) => [spec.leftBorder[i], ...land, spec.rightBorder[i]]),
    spec.bottomCap,
  ];
  const maxLen = Math.max(...fullRows.map((row) => row.length));
  return fullRows.map((row) => [
    ...Array.from({ length: maxLen - row.length }, (): TemplateCell => ({ type: "empty" })),
    ...row,
  ]);
}

const emptyCells = (n: number): TemplateCell[] =>
  Array.from({ length: n }, () => ({ type: "empty" }));

/**
 * Stacks multiple independently-built blocks (e.g. a main island and one or more small
 * islands, each its own buildHexagonGrid output) into a single grid, one on top of the next,
 * separated by a blank row. padLeft shifts a block right by that many extra empty columns,
 * letting islands be staggered rather than all sharing the same centerline. Used for every
 * multi-island Seafarers scenario, where an exact match to the manual's specific scattered
 * layout isn't the goal - a reasonable, correctly-composed arrangement is (row widths don't
 * need to line up across blocks; the CSS grid sizes itself off the widest row automatically).
 *
 * The separator row matters, not just cosmetically: two hex rows immediately adjacent in the
 * grid are treated as neighboring (see boardFactory's row±1 offsets), so without a gap, the
 * last row of one block and the first row of the next could spuriously "touch."
 */
export function stackBlocks(blocks: { grid: TemplateCell[][]; padLeft?: number }[]): TemplateCell[][] {
  return blocks.flatMap(({ grid, padLeft = 0 }, i) => [
    ...(i > 0 ? [emptyCells(1)] : []),
    ...grid.map((row) => (padLeft > 0 ? [...emptyCells(padLeft), ...row] : row)),
  ]);
}

/** A small island with a plain one-hex-thick sea border and no harbors - the common case. */
export function plainIsland(landRows: HexCell[][]): TemplateCell[][] {
  return buildHexagonGrid({
    landRows,
    leftBorder: landRows.map(sea),
    rightBorder: landRows.map(sea),
    topCap: Array.from({ length: landRows[0].length + 1 }, sea),
    bottomCap: Array.from({ length: landRows.at(-1)!.length + 1 }, sea),
  });
}
