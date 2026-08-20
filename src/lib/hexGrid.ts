import type { HexCell, TemplateCell } from "../data/boards/types";

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
