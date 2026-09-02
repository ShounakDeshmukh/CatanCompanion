import type { ShuffleConstraints } from "./shuffle";
import { UNCONSTRAINED } from "./shuffle";

export interface ShareState {
  boardId: string;
  seed: number;
  constraints: ShuffleConstraints;
}

const FLAGS = [
  ["no68", "noAdjacentSixEight"],
  ["no212", "noAdjacentTwoTwelve"],
  ["nopair", "noAdjacentPairs"],
] as const;

const LIMITS = [
  ["terrain", "maxConnectedLikeTerrain"],
  ["pips", "maxIntersectionPipCount"],
  ["islands", "minIslandCount"],
] as const;

/**
 * The address bar is the share link, so it has to carry everything that affects the board.
 * Constraints included: opening someone's link with different settings would otherwise
 * quietly produce a different map from the one they sent.
 */
export function encodeShareHash(state: ShareState): string {
  const params = new URLSearchParams({ board: state.boardId, seed: String(state.seed) });
  for (const [key, name] of FLAGS) {
    if (state.constraints[name]) params.set(key, "1");
  }
  for (const [key, name] of LIMITS) {
    if (state.constraints[name] !== UNCONSTRAINED[name]) {
      params.set(key, String(state.constraints[name]));
    }
  }
  return `#${params}`;
}

export function decodeShareHash(hash: string): ShareState | undefined {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const boardId = params.get("board");
  const seedParam = params.get("seed");
  if (!boardId || seedParam === null) return undefined;

  const seed = Number(seedParam);
  if (!Number.isFinite(seed)) return undefined;

  const constraints = { ...UNCONSTRAINED };
  for (const [key, name] of FLAGS) {
    constraints[name] = params.get(key) === "1";
  }
  for (const [key, name] of LIMITS) {
    const value = Number(params.get(key));
    if (Number.isFinite(value) && value > 0) constraints[name] = value;
  }

  return { boardId, seed, constraints };
}
