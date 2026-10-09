import type { GameState } from "./gameState";

/** Longer than this between two rolls and the table had stepped away, not been thinking. */
const BREAK_MS = 15 * 60_000;

export interface Pace {
  /** Each player's average turn in milliseconds, or null before they have finished one. */
  players: (number | null)[];
  overall: number | null;
}

const average = (times: number[]) =>
  times.length === 0 ? null : times.reduce((sum, time) => sum + time, 0) / times.length;

/**
 * How long turns have been taking. A turn is timed from its roll to the next player's, which
 * is the only clock the game keeps, so the turn in progress is not counted.
 */
export function turnPace(state: GameState): Pace {
  const turns: number[][] = state.players.map(() => []);
  state.rolls.slice(1).forEach((next, turn) => {
    const length = next.at - state.rolls[turn].at;
    if (length > 0 && length <= BREAK_MS) turns[turn % state.players.length].push(length);
  });
  return { players: turns.map(average), overall: average(turns.flat()) };
}
