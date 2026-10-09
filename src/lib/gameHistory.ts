import { playerPoints, type Award, type GameState, type PlayerColor } from "./gameState";

const AWARDS: Award[] = ["longestRoad", "largestArmy"];

/** What a result card says about a finished game. Nothing of it is kept on the device. */
export interface GameRecord {
  endedAt: number;
  startedAt: number;
  board: string;
  turns: number;
  target: number;
  /** In finishing order, best first. */
  players: { seat: number; name: string; color: PlayerColor; points: number; awards: Award[] }[];
  /** Counts of each total rolled, from 2 at index 0 to 12 at index 10. */
  rolls: number[];
}

export function summarize(state: GameState, board: string, endedAt: number = Date.now()): GameRecord {
  const points = playerPoints(state);
  const rolls = Array.from({ length: 11 }, () => 0);
  for (const roll of state.rolls) rolls[roll.total - 2]++;
  return {
    endedAt,
    startedAt: state.startedAt,
    board,
    turns: state.rolls.length,
    target: state.targetPoints,
    players: state.players
      .map((player, seat) => ({
        seat,
        name: player.name,
        color: player.color,
        points: points[seat],
        awards: AWARDS.filter((award) => state[award] === seat),
      }))
      // a stable sort, so players level on points stay in turn order
      .sort((a, b) => b.points - a.points),
    rolls,
  };
}
