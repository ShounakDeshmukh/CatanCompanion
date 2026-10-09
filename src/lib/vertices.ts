import type { CatanBoard } from "../data/boards/types";

/** A corner where up to three hexes meet, which is where a settlement or city stands. */
export interface Vertex {
  /** The grid lines the corner sits on, so every hex sharing it derives the same id. */
  id: string;
  hexes: number[];
  /** Position as a fraction of the board grid's width and height. */
  x: number;
  y: number;
}

/** A hex side, which is where a road or ship lies. */
export interface Edge {
  id: string;
  /** The vertex ids at either end. */
  ends: [string, string];
  hexes: number[];
  /** Midpoint, as a fraction of the board grid's width and height. */
  x: number;
  y: number;
  /** Degrees clockwise from horizontal, in the grid's own unrotated frame. */
  angle: number;
}

export interface BoardGeometry {
  vertices: Vertex[];
  edges: Edge[];
  /** The grid's width over its height, before a Seafarers map is turned. */
  aspect: number;
  /** A hex's side length, as a fraction of the grid's height. */
  side: number;
}

/**
 * Column and row line offsets of a pointy-top hex's six corners from the start of its grid
 * area, clockwise from the top. A hex spans two columns and three row tracks.
 */
const CORNER_OFFSETS = [
  [1, 0],
  [2, 1],
  [2, 2],
  [1, 3],
  [0, 2],
  [0, 1],
] as const;

/** A column is half a hex wide, in units of the hex's side length. */
const COLUMN_WIDTH = Math.sqrt(3) / 2;

/** Row tracks alternate 0.5fr and 1fr (see boardFactory.ts), so row lines are unevenly spaced. */
function rowLineOffset(line: number): number {
  const tracksAbove = line - 1;
  return Math.floor(tracksAbove / 2) * 1.5 + (tracksAbove % 2) * 0.5;
}

export function boardGeometry(board: CatanBoard): BoardGeometry {
  const origins = board.cssGridAreas.map((area) => area.split(" / ", 2).map(Number));
  const columns = Math.max(...origins.map(([, col]) => col)) + 1;
  const height = rowLineOffset(board.cssGridTemplateRows.trim().split(" ").length + 1);

  const vertices = new Map<string, Vertex>();
  const edges = new Map<string, Edge>();

  origins.forEach(([row, col], index) => {
    const corners = CORNER_OFFSETS.map(([dCol, dRow]) => {
      const id = `${col + dCol}.${row + dRow}`;
      let vertex = vertices.get(id);
      if (!vertex) {
        vertex = {
          id,
          hexes: [],
          x: (col + dCol - 1) / columns,
          y: rowLineOffset(row + dRow) / height,
        };
        vertices.set(id, vertex);
      }
      vertex.hexes.push(index);
      return vertex;
    });

    corners.forEach((from, i) => {
      const to = corners[(i + 1) % corners.length];
      const ends = [from.id, to.id].sort() as [string, string];
      const id = ends.join("-");
      const edge = edges.get(id);
      if (edge) {
        edge.hexes.push(index);
        return;
      }
      const run = (to.x - from.x) * columns * COLUMN_WIDTH;
      const rise = (to.y - from.y) * height;
      edges.set(id, {
        id,
        ends,
        hexes: [index],
        x: (from.x + to.x) / 2,
        y: (from.y + to.y) / 2,
        angle: (Math.atan2(rise, run) * 180) / Math.PI,
      });
    });
  });

  return {
    vertices: [...vertices.values()],
    edges: [...edges.values()],
    aspect: (columns * COLUMN_WIDTH) / height,
    side: 1 / height,
  };
}
