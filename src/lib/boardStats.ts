import type { Hex, Resource } from "../data/boards/types";
import { RESOURCE_BY_HEX } from "../data/boards/types";
import { hexPips, isResourceHex } from "./shuffle";
import type { Vertex } from "./vertices";

export type Yield = Resource | "choice";

export interface CornerStat {
  id: string;
  pips: number;
  /** The producing hexes at this corner, strongest first. */
  hexes: number[];
}

export interface BoardStats {
  /** Total pips on each resource's hexes: how often the board as a whole pays it out. */
  pips: Partial<Record<Yield, number>>;
  hexes: Partial<Record<Yield, number>>;
  /** The best settlement spots, by the pips of the hexes meeting there. */
  corners: CornerStat[];
}

/**
 * How a dealt board is balanced. Fog hexes are unknown at this point and count for nothing.
 * Corners level on pips are ranked by how many different hexes feed them, as a spot drawing
 * on three hexes is worth more than one drawing the same pips from two.
 */
export function boardStats(hexes: Hex[], vertices: Vertex[], top: number = 5): BoardStats {
  const pips: BoardStats["pips"] = {};
  const count: BoardStats["hexes"] = {};
  for (const hex of hexes) {
    if (!isResourceHex(hex)) continue;
    const resource = RESOURCE_BY_HEX[hex.type];
    pips[resource] = (pips[resource] ?? 0) + hexPips(hex);
    count[resource] = (count[resource] ?? 0) + 1;
  }

  const corners = vertices
    .map((vertex) => {
      const producing = vertex.hexes
        .filter((index) => hexPips(hexes[index]) > 0)
        .sort((a, b) => hexPips(hexes[b]) - hexPips(hexes[a]));
      return {
        id: vertex.id,
        pips: producing.reduce((sum, index) => sum + hexPips(hexes[index]), 0),
        hexes: producing,
      };
    })
    .sort((a, b) => b.pips - a.pips || b.hexes.length - a.hexes.length)
    .slice(0, top);

  return { pips, hexes: count, corners };
}
