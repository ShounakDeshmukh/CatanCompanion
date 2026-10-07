import type { Hex, HexType, NumberChitValue, PortType } from "../data/boards/types";
import {
  PLAYER_COLORS,
  TRACKS,
  type Building,
  type Card,
  type EventDie,
  type GameState,
  type Knight,
  type KnightAction,
  type LedgerEntry,
  type Payout,
  type Piece,
  type Player,
  type PlayerColor,
  type Roll,
} from "./gameState";

const HEX_TYPES: readonly HexType[] = [
  "hills",
  "forest",
  "pasture",
  "fields",
  "mountains",
  "gold",
  "desert",
  "sea",
  "fog",
  "village",
];
const CHITS: readonly NumberChitValue[] = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
const PORT_TYPES: readonly PortType[] = ["3:1", "brick", "wood", "wool", "wheat", "ore"];
const CARDS: readonly Card[] = [
  "brick",
  "wood",
  "wool",
  "wheat",
  "ore",
  "choice",
  "paper",
  "cloth",
  "coin",
];
const EVENTS: readonly EventDie[] = ["ship", "yellow", "blue", "green"];
const PIECES: readonly Piece[] = ["settlement", "city", "road", "ship"];
const KNIGHT_ACTIONS: readonly KnightAction[] = ["recruit", "promote", "activate", "move", "chase"];
const KNIGHT_LEVELS: readonly Knight["level"][] = [1, 2, 3];
const EDGE_ITEMS = ["victoryPoint", "developmentCard"] as const;

const MAX_PLAYERS = 6;
const MAX_NAME_LENGTH = 16;

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isInteger = (value: unknown): value is number => Number.isInteger(value);
const isCount = (value: unknown): value is number => isInteger(value) && value >= 0;
const isIndex = (value: unknown, below: number): value is number => isCount(value) && value < below;
const isOneOf = <T>(options: readonly T[], value: unknown): value is T =>
  options.includes(value as T);
const isOrientation = (value: unknown): boolean => isCount(value) && value < 360 && value % 60 === 0;
const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/** Maps every item, giving up on the whole list if any one of them is not valid. */
function parseAll<T>(value: unknown, parse: (item: unknown) => T | undefined): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const parsed = value.map(parse);
  return parsed.includes(undefined) ? undefined : (parsed as T[]);
}

function parseRecord<T>(
  value: unknown,
  parse: (item: unknown) => T | undefined
): Record<string, T> | undefined {
  if (!isObject(value)) return undefined;
  const entries = Object.entries(value).map(([key, item]) => [key, parse(item)] as const);
  return entries.some(([, item]) => item === undefined)
    ? undefined
    : (Object.fromEntries(entries) as Record<string, T>);
}

/** Copies only the fields the board draws, so nothing else rides in on a hex. */
function parseHex(raw: unknown): Hex | undefined {
  if (!isObject(raw) || !isOneOf(HEX_TYPES, raw.type)) return undefined;
  const hex: Json = { type: raw.type };

  for (const key of ["number", "secondNumber"]) {
    if (raw[key] === undefined) continue;
    if (!isOneOf(CHITS, raw[key])) return undefined;
    hex[key] = raw[key];
  }
  if (raw.orientation !== undefined) {
    if (!isOrientation(raw.orientation)) return undefined;
    hex.orientation = raw.orientation;
  }
  if (raw.port !== undefined) {
    const port = raw.port;
    if (!isObject(port) || !isOneOf(PORT_TYPES, port.type) || !isOrientation(port.orientation)) {
      return undefined;
    }
    hex.port = { type: port.type, orientation: port.orientation };
  }
  if (raw.edgeItems !== undefined) {
    const items = parseAll(raw.edgeItems, (item) =>
      isObject(item) && isOneOf(EDGE_ITEMS, item.kind) && isOrientation(item.orientation)
        ? { kind: item.kind, orientation: item.orientation }
        : undefined
    );
    if (!items) return undefined;
    hex.edgeItems = items;
  }
  return hex as Hex;
}

function parsePlayer(raw: unknown): Player | undefined {
  if (!isObject(raw) || typeof raw.name !== "string") return undefined;
  if (!isOneOf<PlayerColor>(PLAYER_COLORS, raw.color) || !Number.isInteger(raw.extraPoints)) {
    return undefined;
  }
  return {
    name: raw.name.slice(0, MAX_NAME_LENGTH),
    color: raw.color,
    extraPoints: raw.extraPoints as number,
  };
}

function parsePayout(raw: unknown): Payout | undefined {
  if (!isObject(raw)) return undefined;
  const valid = Object.entries(raw).every(([card, count]) => isOneOf(CARDS, card) && isCount(count));
  return valid ? (raw as Payout) : undefined;
}

/**
 * Checks a game that came from outside this page - a viewer's connection or old saved data -
 * and rebuilds it from only the fields and values the app knows. The page writes parts of
 * the state straight into its markup, so anything unexpected has to stop here.
 */
export function parseGame(raw: unknown): GameState | undefined {
  if (!isObject(raw) || typeof raw.boardId !== "string") return undefined;

  const hexes = parseAll(raw.hexes, parseHex);
  const players = parseAll(raw.players, parsePlayer);
  if (!hexes || !players || players.length > MAX_PLAYERS) return undefined;
  const isSeat = (value: unknown): value is number => isIndex(value, players.length);
  const isHolder = (value: unknown): value is number | null => value === null || isSeat(value);

  const buildings = parseRecord<Building>(raw.buildings, (item) =>
    isObject(item) && isSeat(item.player) && (item.kind === "settlement" || item.kind === "city")
      ? { player: item.player, kind: item.kind }
      : undefined
  );
  const knights = parseRecord<Knight>(raw.knights ?? {}, (item) =>
    isObject(item) && isSeat(item.player) && isOneOf(KNIGHT_LEVELS, item.level)
      ? { player: item.player, level: item.level, active: item.active === true }
      : undefined
  );
  // roads, ships, setup, the ledger and the room all arrived after the first saved games
  const roads = parseRecord(raw.roads ?? {}, (item) => (isSeat(item) ? item : undefined));
  const ships = raw.ships ?? [];
  const setup = raw.setup ?? null;
  const room = raw.room ?? null;

  const rolls = parseAll<Roll>(raw.rolls, (item) => {
    if (!isObject(item) || !isCount(item.total) || item.total < 2 || item.total > 12) {
      return undefined;
    }
    const payouts = parseAll(item.payouts, parsePayout);
    const expected = parseAll(item.expected, (amount) =>
      typeof amount === "number" && Number.isFinite(amount) ? amount : undefined
    );
    if (!payouts || !expected || typeof item.at !== "number") return undefined;
    if (item.event !== undefined && !isOneOf(EVENTS, item.event)) return undefined;
    return { total: item.total, event: item.event, payouts, expected, at: item.at };
  });

  const parsedLedger = parseAll<LedgerEntry>(raw.ledger ?? [], (item) => {
    // the opening placements are turn -1
    if (!isObject(item) || !isInteger(item.turn) || item.turn < -1) return undefined;
    const { turn, player } = item;
    if (item.kind === "barbarians") {
      const seats = parseAll(item.players, (seat) => (isSeat(seat) ? seat : undefined));
      return seats && { kind: "barbarians", turn, defended: item.defended === true, players: seats };
    }
    if (item.kind === "award") {
      if (!isHolder(player)) return undefined;
      if (item.award !== "longestRoad" && item.award !== "largestArmy") return undefined;
      return { kind: "award", turn, player, award: item.award };
    }
    if (!isSeat(player)) return undefined;
    if (item.kind === "troop") {
      return isOneOf(KNIGHT_ACTIONS, item.action)
        ? { kind: "troop", turn, player, action: item.action }
        : undefined;
    }
    if (item.kind === "metropolis") {
      if (!isHolder(player) || !isOneOf(TRACKS, item.track)) return undefined;
      return { kind: "metropolis", turn, player, track: item.track };
    }
    if (!isSeat(player)) return undefined;
    if (item.kind === "improve") {
      if (!isOneOf(TRACKS, item.track) || !isCount(item.level)) return undefined;
      return { kind: "improve", turn, player, track: item.track, level: item.level };
    }
    if (item.kind === "pirate") {
      return isIndex(item.hex, hexes.length) ? { kind: "pirate", turn, player, hex: item.hex } : undefined;
    }
    if (
      item.kind === "knight" ||
      item.kind === "roadBuilding" ||
      item.kind === "pillage" ||
      item.kind === "card" ||
      item.kind === "wall"
    ) {
      return { kind: item.kind, turn, player };
    }
    if (item.kind === "roll") {
      return isCount(item.roll) ? { kind: "roll", turn, player, roll: item.roll } : undefined;
    }
    if (item.kind === "build") {
      if (!isOneOf(PIECES, item.piece) || typeof item.site !== "string") return undefined;
      return { kind: "build", turn, player, piece: item.piece, site: item.site, free: item.free === true };
    }
    if ((item.kind === "robber" || item.kind === "explore") && isIndex(item.hex, hexes.length)) {
      return { kind: item.kind, turn, player, hex: item.hex };
    }
    return undefined;
  });

  if (!buildings || !knights || !roads || !rolls || !parsedLedger) return undefined;

  // Before turns were ended by hand a turn was simply a roll: the ledger carried no roll
  // lines, and stamped each entry with the number of rolls made so far.
  const legacy = raw.turn === undefined;
  const turn = legacy ? rolls.length : raw.turn;
  if (!isCount(turn) || rolls.length < turn || rolls.length > turn + 1) return undefined;
  let ledger = parsedLedger;
  if (legacy) {
    const stampedAt = (rollsMade: number, as: number) =>
      parsedLedger.flatMap((entry) => (entry.turn === rollsMade ? [{ ...entry, turn: as }] : []));
    ledger = stampedAt(0, setup === null ? 0 : -1);
    rolls.forEach((_, roll) => {
      ledger.push({ kind: "roll", turn: roll, player: roll % players.length, roll });
      ledger.push(...stampedAt(roll + 1, roll));
    });
  }
  if (ledger.some((entry) => entry.kind === "roll" && entry.roll >= rolls.length)) return undefined;

  const counts = (value: unknown) =>
    parseRecord(value ?? {}, (count) => (isCount(count) ? count : undefined));
  const improvements = counts(raw.improvements);
  const walls = counts(raw.walls);
  const metropolis = parseRecord(raw.metropolis ?? {}, (seat) => (isSeat(seat) ? seat : undefined));
  const pirate = raw.pirate ?? null;
  if (!improvements || !walls || !metropolis) return undefined;
  if (!Object.keys(metropolis).every((track) => isOneOf(TRACKS, track))) return undefined;
  if (!(pirate === null || isIndex(pirate, hexes.length))) return undefined;

  const owed = raw.freeRoads ?? null;
  const freeRoads =
    isObject(owed) && isSeat(owed.player) && isCount(owed.left)
      ? { player: owed.player, left: owed.left }
      : null;
  if (!isStrings(ships) || !(setup === null || isStrings(setup))) return undefined;
  if (!(raw.robber === null || isIndex(raw.robber, hexes.length))) return undefined;
  if (!isHolder(raw.longestRoad) || !isHolder(raw.largestArmy)) return undefined;
  if (!(room === null || (typeof room === "string" && /^[a-z0-9]{6,32}$/.test(room)))) {
    return undefined;
  }
  if (!isCount(raw.targetPoints) || typeof raw.startedAt !== "number") return undefined;

  return {
    boardId: raw.boardId,
    hexes,
    players,
    buildings,
    knights,
    roads,
    ships,
    setup,
    robber: raw.robber,
    pirate,
    improvements,
    walls,
    metropolis,
    turn,
    turnStartedAt: typeof raw.turnStartedAt === "number" ? raw.turnStartedAt : raw.startedAt,
    rolls,
    freeRoads,
    longestRoad: raw.longestRoad,
    largestArmy: raw.largestArmy,
    citiesKnights: raw.citiesKnights === true,
    targetPoints: raw.targetPoints,
    startedAt: raw.startedAt,
    ledger,
    room,
  };
}

const STORAGE_KEY = "catan-comp-game";

export function loadGame(): GameState | undefined {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return undefined;
  try {
    return parseGame(JSON.parse(stored));
  } catch {
    return undefined;
  }
}

export function saveGame(state: GameState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearGame(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(UNDO_KEY);
}

const UNDO_KEY = "catan-comp-undo";
const UNDO_DEPTH = 12;

/**
 * Earlier states of `current`, oldest first, for Undo. Kept in storage because phones reload
 * a page they have had in the background, which is exactly when a mis-tap gets noticed.
 */
export function loadUndo(current: GameState): GameState[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(UNDO_KEY) ?? "[]");
    const states = parseAll(stored, parseGame) ?? [];
    return states.every((state) => state.startedAt === current.startedAt) ? states : [];
  } catch {
    return [];
  }
}

export function saveUndo(states: GameState[]): void {
  states.splice(0, states.length - UNDO_DEPTH);
  localStorage.setItem(UNDO_KEY, JSON.stringify(states));
}
