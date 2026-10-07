import {
  PLAYER_COLORS,
  playerPoints,
  productionTotals,
  type GameState,
  type PlayerColor,
} from "./gameState";

/** What is kept of a finished game: enough for a results table, not enough to replay it. */
export interface GameRecord {
  endedAt: number;
  startedAt: number;
  board: string;
  turns: number;
  target: number;
  /** In finishing order, best first. */
  players: { name: string; color: PlayerColor; points: number; cards: number; luck: number }[];
  /** Counts of each total rolled, from 2 at index 0 to 12 at index 10. */
  rolls: number[];
}

export function summarize(state: GameState, board: string, endedAt: number = Date.now()): GameRecord {
  const points = playerPoints(state);
  const { received, expected } = productionTotals(state);
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
        name: player.name,
        color: player.color,
        points: points[seat],
        cards: received[seat],
        luck: Math.round((received[seat] - expected[seat]) * 10) / 10,
      }))
      // a stable sort, so players level on points stay in turn order
      .sort((a, b) => b.points - a.points),
    rolls,
  };
}

const STORAGE_KEY = "catan-comp-history";
const KEPT = 30;

function parseRecord(raw: unknown): GameRecord | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const record = raw as Record<string, unknown>;
  const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
  const players = Array.isArray(record.players) ? record.players : [];
  const valid =
    typeof record.board === "string" &&
    [record.endedAt, record.startedAt, record.turns, record.target].every(isNumber) &&
    Array.isArray(record.rolls) &&
    record.rolls.length === 11 &&
    record.rolls.every(isNumber) &&
    players.length > 0 &&
    players.every(
      (player) =>
        typeof player === "object" &&
        player !== null &&
        typeof player.name === "string" &&
        PLAYER_COLORS.includes(player.color) &&
        [player.points, player.cards, player.luck].every(isNumber)
    );
  return valid ? (record as unknown as GameRecord) : undefined;
}

/** Finished games on this device, newest first. */
export function loadRecords(): GameRecord[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.flatMap((raw) => parseRecord(raw) ?? []) : [];
  } catch {
    return [];
  }
}

export function saveRecord(record: GameRecord): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...loadRecords()].slice(0, KEPT)));
}

export function clearRecords(): void {
  localStorage.removeItem(STORAGE_KEY);
}
