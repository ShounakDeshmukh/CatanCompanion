import type {
  FacedownStack,
  Hex,
  Resource,
  ResourceHexType,
} from "../data/boards/types";
import { RESOURCE_BY_HEX } from "../data/boards/types";
import { BUILDING_COSTS, IMPROVEMENT_TRACKS, type Commodity } from "../data/costs";
import { hexPips, isResourceHex } from "./shuffle";
import type { Edge, Vertex } from "./vertices";

/** The base box's four first, then the extension's two, then the colours of other sets. */
export const PLAYER_COLORS = [
  "red",
  "blue",
  "white",
  "orange",
  "green",
  "brown",
  "black",
  "gray",
  "purple",
  "pink",
  "lime",
] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

/** Anything a roll can hand out. "choice" is a gold field's pick of any resource. */
export type Card = Resource | "choice" | Commodity;
export type Payout = Partial<Record<Card, number>>;

export type BuildingKind = "settlement" | "city";
export type Piece = BuildingKind | "road" | "ship";
export type Award = "longestRoad" | "largestArmy";
export type EventDie = "ship" | "yellow" | "blue" | "green";

/** The three Cities & Knights improvement tracks, by the ids the cost data gives them. */
export const TRACKS = ["science", "trade", "politics"] as const;
export type Track = (typeof TRACKS)[number];

export interface Player {
  name: string;
  color: PlayerColor;
  /** Points the board cannot show: victory point cards, metropolises, island bonuses. */
  extraPoints: number;
}

export interface Building {
  player: number;
  kind: BuildingKind;
}

/** A Cities & Knights knight: a piece on a corner, one to three strong, awake or not. */
export interface Knight {
  player: number;
  level: 1 | 2 | 3;
  active: boolean;
}

export type KnightAction = "recruit" | "promote" | "activate" | "move" | "chase";

export interface Roll {
  total: number;
  event?: EventDie;
  /** Indexed by player. Stored rather than recomputed, as buildings change after the roll. */
  payouts: Payout[];
  /** Cards each player could expect from one roll with the buildings they had at the time. */
  expected: number[];
  at: number;
}

/**
 * One line of the game's history, in the order things happened. `turn` counts from zero, and
 * is -1 for the opening placements. A roll's line points at its entry in `rolls`, which is
 * what lets a knight played before the dice sit ahead of them in its turn.
 */
export type LedgerEntry = { turn: number } & (
  | { kind: "roll"; player: number; roll: number }
  | { kind: "knight"; player: number }
  | { kind: "roadBuilding"; player: number }
  | { kind: "build"; player: number; piece: Piece; site: string; free: boolean }
  | { kind: "robber"; player: number; hex: number }
  | { kind: "explore"; player: number; hex: number }
  | { kind: "award"; player: number | null; award: Award }
  | { kind: "troop"; player: number; action: KnightAction }
  // the defenders if Catan held, otherwise whoever has to give up a city
  | { kind: "barbarians"; defended: boolean; players: number[] }
  | { kind: "pillage"; player: number }
  | { kind: "card"; player: number }
  | { kind: "improve"; player: number; track: Track; level: number }
  | { kind: "wall"; player: number }
  | { kind: "metropolis"; player: number | null; track: Track }
  | { kind: "pirate"; player: number; hex: number }
);

/**
 * A game in progress. Holders use null rather than undefined so the state survives JSON.
 */
export interface GameState {
  boardId: string;
  hexes: Hex[];
  players: Player[];
  buildings: Record<string, Building>;
  /** Cities & Knights only. A knight holds its corner the way a building does. */
  knights: Record<string, Knight>;
  /** Roads and ships alike, keyed by edge id and holding the owning player. */
  roads: Record<string, number>;
  /** Which of `roads` are ships. They cost differently and only join roads at a building. */
  ships: string[];
  /**
   * The corners and sides taken during the opening placements, in order: a building, then
   * its road, for each player in turn. Null in games saved before setup was tracked.
   */
  setup: string[] | null;
  robber: number | null;
  /** Seafarers' second thief, which sits on a sea hex. Null until it is first placed. */
  pirate: number | null;
  /** Cities & Knights improvement levels, keyed `player:track`. Missing means none built. */
  improvements: Record<string, number>;
  /** City walls per player, keyed by seat. */
  walls: Record<string, number>;
  /** Who holds each track's metropolis. */
  metropolis: Partial<Record<Track, number>>;
  /** Turns finished so far. The current turn has been rolled once `rolls` is longer than this. */
  turn: number;
  turnStartedAt: number;
  rolls: Roll[];
  /** Roads or ships still owed to whoever played Road Building this turn. */
  freeRoads: { player: number; left: number } | null;
  longestRoad: number | null;
  largestArmy: number | null;
  citiesKnights: boolean;
  targetPoints: number;
  startedAt: number;
  /** Builds and other events the app saw, oldest first. Rolls live in `rolls`. */
  ledger: LedgerEntry[];
  /** Set while the game is shared with viewers, so a reload hosts the same room again. */
  room: string | null;
}

export const BARBARIAN_TRACK_LENGTH = 7;
export const LONGEST_ROAD_MINIMUM = 5;
export const LARGEST_ARMY_MINIMUM = 3;

/** In Cities & Knights a city on these hexes yields one resource and one commodity. */
const COMMODITY_BY_HEX: Partial<Record<ResourceHexType, Commodity>> = {
  forest: "paper",
  pasture: "cloth",
  mountains: "coin",
};

export function newGame(boardId: string, hexes: Hex[], startedAt: number = Date.now()): GameState {
  const desert = hexes.findIndex((hex) => hex.type === "desert");
  return {
    boardId,
    hexes,
    players: [],
    buildings: {},
    knights: {},
    roads: {},
    ships: [],
    setup: [],
    robber: desert === -1 ? null : desert,
    pirate: null,
    improvements: {},
    walls: {},
    metropolis: {},
    turn: 0,
    turnStartedAt: startedAt,
    rolls: [],
    freeRoads: null,
    longestRoad: null,
    largestArmy: null,
    citiesKnights: false,
    targetPoints: 10,
    startedAt,
    ledger: [],
    room: null,
  };
}

function cardsProduced(hex: Hex, kind: BuildingKind, citiesKnights: boolean): Card[] {
  if (!isResourceHex(hex)) return [];
  const resource = RESOURCE_BY_HEX[hex.type];
  if (kind === "settlement") return [resource];
  const commodity = citiesKnights ? COMMODITY_BY_HEX[hex.type] : undefined;
  return [resource, commodity ?? resource];
}

/** Visits every building-and-hex pairing that can currently produce. */
function eachProduction(
  state: GameState,
  vertices: Vertex[],
  edges: Edge[],
  visit: (player: number, hex: Hex, cards: Card[]) => void
): void {
  // A cloth village pays one cloth to each player whose roads or ships reach it. Reaching
  // is taken as having a piece on one of the village hex's sides.
  const trading = new Set<string>();
  for (const edge of edges) {
    const player = state.roads[edge.id];
    if (player === undefined) continue;
    for (const index of edge.hexes) {
      const hex = state.hexes[index];
      if (hex.type !== "village" || trading.has(`${player}:${index}`)) continue;
      trading.add(`${player}:${index}`);
      visit(player, hex, ["cloth"]);
    }
  }

  for (const vertex of vertices) {
    const building = state.buildings[vertex.id];
    if (!building) continue;
    for (const index of vertex.hexes) {
      if (index === state.robber) continue;
      const hex = state.hexes[index];
      const cards = cardsProduced(hex, building.kind, state.citiesKnights);
      if (cards.length > 0) visit(building.player, hex, cards);
    }
  }
}

export function payoutForRoll(
  state: GameState,
  vertices: Vertex[],
  total: number,
  edges: Edge[] = []
): Payout[] {
  const payouts: Payout[] = state.players.map(() => ({}));
  eachProduction(state, vertices, edges, (player, hex, cards) => {
    if (hex.number !== total && hex.secondNumber !== total) return;
    for (const card of cards) payouts[player][card] = (payouts[player][card] ?? 0) + 1;
  });
  return payouts;
}

/** A chit's pips are the number of ways to roll it out of 36. */
export function expectedProduction(
  state: GameState,
  vertices: Vertex[],
  edges: Edge[] = []
): number[] {
  const expected = state.players.map(() => 0);
  eachProduction(state, vertices, edges, (player, hex, cards) => {
    expected[player] += (hexPips(hex) * cards.length) / 36;
  });
  return expected;
}

/** Whose turn it is, from the moment the last player passed until they pass in turn. */
export function currentPlayer(state: GameState): number {
  return state.turn % state.players.length;
}

export function hasRolled(state: GameState): boolean {
  return state.rolls.length > state.turn;
}

export function recordRoll(
  state: GameState,
  vertices: Vertex[],
  total: number,
  event?: EventDie,
  at: number = Date.now(),
  edges: Edge[] = []
): GameState {
  if (hasRolled(state)) return state;
  const roll: Roll = {
    total,
    event,
    payouts: payoutForRoll(state, vertices, total, edges),
    expected: expectedProduction(state, vertices, edges),
    at,
  };
  return logged(
    { ...state, rolls: [...state.rolls, roll] },
    { kind: "roll", player: currentPlayer(state), roll: state.rolls.length }
  );
}

/** Passes the dice on. A turn cannot end before it has been rolled. */
export function endTurn(state: GameState, at: number = Date.now()): GameState {
  if (!hasRolled(state)) return state;
  return { ...state, turn: state.turn + 1, turnStartedAt: at, freeRoads: null };
}

export function setLastEvent(state: GameState, event: EventDie): GameState {
  const last = state.rolls.at(-1);
  if (!last) return state;
  return { ...state, rolls: [...state.rolls.slice(0, -1), { ...last, event }] };
}

function shipRolls(state: GameState): number {
  return state.rolls.filter((roll) => roll.event === "ship").length;
}

export function barbarianPosition(state: GameState): number {
  return shipRolls(state) % BARBARIAN_TRACK_LENGTH;
}

/** True only on the roll whose ship carried the barbarians onto Catan. */
export function barbariansAttacked(state: GameState): boolean {
  const ships = shipRolls(state);
  return (
    state.rolls.at(-1)?.event === "ship" && ships > 0 && ships % BARBARIAN_TRACK_LENGTH === 0
  );
}

/** Who holds a corner, whether with a building or a knight. */
function occupant(state: GameState, corner: string): number | undefined {
  return state.buildings[corner]?.player ?? state.knights[corner]?.player;
}

/**
 * With five or six at the table, the third player to the left of whoever's turn it is takes
 * a limited turn alongside them: building and trading with the supply, but not with players.
 */
export function pairedPlayer(state: GameState, player: number): number | null {
  const count = state.players.length;
  return count >= 5 ? (player + 3) % count : null;
}

/** The distance rule: a settlement needs every neighbouring corner to be empty. */
export function tooCloseToBuild(state: GameState, edges: Edge[], vertexId: string): boolean {
  return edges.some(
    ({ ends }) =>
      (ends[0] === vertexId && state.buildings[ends[1]] !== undefined) ||
      (ends[1] === vertexId && state.buildings[ends[0]] !== undefined)
  );
}

type NewEntry = LedgerEntry extends infer Entry
  ? Entry extends LedgerEntry
    ? Omit<Entry, "turn">
    : never
  : never;

export function logged(state: GameState, entry: NewEntry): GameState {
  const stamped = { ...entry, turn: setupTurn(state) ? -1 : state.turn } as LedgerEntry;
  return { ...state, ledger: [...state.ledger, stamped] };
}

/** Taking a piece back is a correction, so its builds leave the history rather than adding to it. */
function withoutBuilds(state: GameState, site: string): GameState {
  return {
    ...state,
    ledger: state.ledger.filter((entry) => entry.kind !== "build" || entry.site !== site),
  };
}

/**
 * Each player's longest unbroken run of roads and ships. A run may not double back over a
 * piece, stops at a corner holding someone else's building or knight, and can only pass from
 * road to ship at one of the player's own buildings.
 */
export function roadLengths(state: GameState, edges: Edge[]): number[] {
  const endsById = new Map(edges.map((edge) => [edge.id, edge.ends]));
  const ships = new Set(state.ships);
  const networks = state.players.map(
    () => new Map<string, { road: string; to: string; ship: boolean }[]>()
  );

  for (const [road, player] of Object.entries(state.roads)) {
    const ends = endsById.get(road);
    if (!ends) continue;
    for (const [from, to] of [ends, [ends[1], ends[0]]]) {
      const link = { road, to, ship: ships.has(road) };
      const links = networks[player].get(from);
      if (links) links.push(link);
      else networks[player].set(from, [link]);
    }
  }

  return networks.map((network, player) => {
    const walked = new Set<string>();
    const longestFrom = (vertex: string, arrivedByShip?: boolean): number => {
      const owner = state.buildings[vertex]?.player;
      let best = 0;
      for (const { road, to, ship } of network.get(vertex) ?? []) {
        if (walked.has(road)) continue;
        if (arrivedByShip !== undefined && arrivedByShip !== ship && owner !== player) continue;
        walked.add(road);
        const ahead = occupant(state, to);
        const blocked = ahead !== undefined && ahead !== player;
        best = Math.max(best, 1 + (blocked ? 0 : longestFrom(to, ship)));
        walked.delete(road);
      }
      return best;
    };
    return Math.max(0, ...[...network.keys()].map((vertex) => longestFrom(vertex)));
  });
}

/**
 * Who holds an award after the counts change. It needs a minimum to be claimed at all, stays
 * with its holder on a tie, and if the holder falls behind a tied group nobody has it until
 * one of them pulls ahead.
 */
function awardHolder(counts: number[], minimum: number, holder: number | null): number | null {
  const most = Math.max(0, ...counts);
  if (most < minimum) return null;
  const leaders = counts.flatMap((count, player) => (count === most ? [player] : []));
  if (holder !== null && leaders.includes(holder)) return holder;
  return leaders.length === 1 ? leaders[0] : null;
}

function withAward(state: GameState, award: Award, holder: number | null): GameState {
  if (holder === state[award]) return state;
  return logged({ ...state, [award]: holder }, { kind: "award", player: holder, award });
}

function withLongestRoad(state: GameState, edges: Edge[]): GameState {
  const holder = awardHolder(roadLengths(state, edges), LONGEST_ROAD_MINIMUM, state.longestRoad);
  return withAward(state, "longestRoad", holder);
}

export function knightsPlayed(state: GameState): number[] {
  const knights = state.players.map(() => 0);
  for (const entry of state.ledger) {
    if (entry.kind === "knight") knights[entry.player]++;
  }
  return knights;
}

/** The base game allows one development card a turn. Progress cards have no such limit. */
export function cardPlayedThisTurn(state: GameState): boolean {
  return state.ledger.some(
    (entry) =>
      entry.turn === state.turn && (entry.kind === "knight" || entry.kind === "roadBuilding")
  );
}

function mayPlayCard(state: GameState): boolean {
  return state.citiesKnights || !cardPlayedThisTurn(state);
}

/** A knight card: it counts toward Largest Army, and its player then moves the robber. */
export function playKnight(state: GameState, player: number): GameState {
  if (!mayPlayCard(state)) return state;
  const played = logged(state, { kind: "knight", player });
  const holder = awardHolder(knightsPlayed(played), LARGEST_ARMY_MINIMUM, played.largestArmy);
  return withAward(played, "largestArmy", holder);
}

/** Road Building: the player's next two roads or ships this turn cost nothing. */
export function playRoadBuilding(state: GameState, player: number): GameState {
  if (!mayPlayCard(state)) return state;
  return logged({ ...state, freeRoads: { player, left: 2 } }, { kind: "roadBuilding", player });
}

export function moveRobber(
  state: GameState,
  hex: number,
  player: number = currentPlayer(state)
): GameState {
  return logged({ ...state, robber: hex }, { kind: "robber", player, hex });
}

/**
 * One tap steps a corner through empty, settlement, city and back to empty. Returns the same
 * state untouched when a new settlement would break the distance rule.
 */
export function cycleBuilding(
  state: GameState,
  edges: Edge[],
  vertexId: string,
  player: number
): GameState {
  const { [vertexId]: existing, ...others } = state.buildings;
  let next: GameState;
  if (!existing) {
    if (state.knights[vertexId] || tooCloseToBuild(state, edges, vertexId)) return state;
    next = logged(
      { ...state, buildings: { ...others, [vertexId]: { player, kind: "settlement" } } },
      { kind: "build", player, piece: "settlement", site: vertexId, free: false }
    );
  } else if (existing.kind === "settlement") {
    next = logged(
      { ...state, buildings: { ...others, [vertexId]: { ...existing, kind: "city" } } },
      { kind: "build", player: existing.player, piece: "city", site: vertexId, free: false }
    );
  } else {
    next = withoutBuilds({ ...state, buildings: others }, vertexId);
  }
  // a new settlement can cut somebody's road in two
  return withLongestRoad(next, edges);
}

/** Lays a road or ship on an empty side, or takes back whatever is there. */
export function toggleRoad(
  state: GameState,
  edges: Edge[],
  edgeId: string,
  player: number,
  options: { ship?: boolean; free?: boolean } = {}
): GameState {
  const { [edgeId]: existing, ...others } = state.roads;
  const ships = state.ships.filter((id) => id !== edgeId);
  if (existing !== undefined) {
    return withLongestRoad(withoutBuilds({ ...state, roads: others, ships }, edgeId), edges);
  }
  const { ship = false } = options;
  const owed = state.freeRoads?.player === player ? state.freeRoads : null;
  const freeRoads = owed ? (owed.left > 1 ? { ...owed, left: owed.left - 1 } : null) : state.freeRoads;
  const laid = logged(
    {
      ...state,
      freeRoads,
      roads: { ...others, [edgeId]: player },
      ships: ship ? [...ships, edgeId] : ships,
    },
    {
      kind: "build",
      player,
      piece: ship ? "ship" : "road",
      site: edgeId,
      free: options.free === true || owed !== null,
    }
  );
  return withLongestRoad(laid, edges);
}

/**
 * Where a player may build from: their own buildings, and the ends of their roads or ships
 * that nobody else holds. Pass `ship` to count only one kind, since a new road cannot
 * continue from a ship or the other way about; leave it out when placing a settlement.
 */
export function networkCorners(
  state: GameState,
  edges: Edge[],
  player: number,
  ship?: boolean
): Set<string> {
  const corners = new Set<string>();
  for (const [corner, building] of Object.entries(state.buildings)) {
    if (building.player === player) corners.add(corner);
  }
  const ships = new Set(state.ships);
  for (const edge of edges) {
    if (state.roads[edge.id] !== player) continue;
    if (ship !== undefined && ships.has(edge.id) !== ship) continue;
    for (const end of edge.ends) {
      const holder = occupant(state, end);
      if (holder === undefined || holder === player) corners.add(end);
    }
  }
  return corners;
}

/** A basic knight goes on an empty corner of the player's own road, asleep. */
export function recruitKnight(
  state: GameState,
  edges: Edge[],
  corner: string,
  player: number
): GameState {
  if (occupant(state, corner) !== undefined) return state;
  const knights = { ...state.knights, [corner]: { player, level: 1, active: false } as Knight };
  const recruited = logged({ ...state, knights }, { kind: "troop", player, action: "recruit" });
  // a knight breaks an opponent's road just as a settlement does
  return withLongestRoad(recruited, edges);
}

function withKnight(state: GameState, corner: string, knight: Knight): GameState {
  return { ...state, knights: { ...state.knights, [corner]: knight } };
}

export function promoteKnight(state: GameState, corner: string): GameState {
  const knight = state.knights[corner];
  if (!knight || knight.level === 3) return state;
  const level = (knight.level + 1) as Knight["level"];
  return logged(withKnight(state, corner, { ...knight, level }), {
    kind: "troop",
    player: knight.player,
    action: "promote",
  });
}

export function activateKnight(state: GameState, corner: string): GameState {
  const knight = state.knights[corner];
  if (!knight || knight.active) return state;
  return logged(withKnight(state, corner, { ...knight, active: true }), {
    kind: "troop",
    player: knight.player,
    action: "activate",
  });
}

/** Puts a knight back to sleep. Chasing the robber is the one use that gets its own line. */
export function standDownKnight(state: GameState, corner: string, chasing = false): GameState {
  const knight = state.knights[corner];
  if (!knight || !knight.active) return state;
  const asleep = withKnight(state, corner, { ...knight, active: false });
  return chasing ? logged(asleep, { kind: "troop", player: knight.player, action: "chase" }) : asleep;
}

function withoutKnight(state: GameState, corner: string): GameState {
  const { [corner]: removed, ...knights } = state.knights;
  return { ...state, knights };
}

/** Moving uses the knight up, so it arrives asleep. */
export function moveKnight(state: GameState, edges: Edge[], from: string, to: string): GameState {
  const knight = state.knights[from];
  if (!knight || occupant(state, to) !== undefined) return state;
  const moved = withKnight(withoutKnight(state, from), to, { ...knight, active: false });
  return withLongestRoad(
    logged(moved, { kind: "troop", player: knight.player, action: "move" }),
    edges
  );
}

export function removeKnight(state: GameState, edges: Edge[], corner: string): GameState {
  return withLongestRoad(withoutKnight(state, corner), edges);
}

export interface KnightStrength {
  /** Levels of the knights that are awake, which is all the barbarians have to face. */
  active: number[];
  total: number[];
}

export function knightStrength(state: GameState): KnightStrength {
  const active = state.players.map(() => 0);
  const total = state.players.map(() => 0);
  for (const knight of Object.values(state.knights)) {
    total[knight.player] += knight.level;
    if (knight.active) active[knight.player] += knight.level;
  }
  return { active, total };
}

export interface BarbarianOutlook {
  /** The barbarians are as strong as there are cities on the island. */
  cities: number;
  strength: number[];
  defended: boolean;
  /** The strongest defenders if Catan holds, otherwise whoever must give up a city. */
  players: number[];
}

/**
 * How an attack would go right now. Catan holds on a tie. If it holds, the strongest player
 * defends it; if it falls, the weakest among those who have a city at all lose one.
 */
export function barbarianOutlook(state: GameState): BarbarianOutlook {
  const strength = knightStrength(state).active;
  const cityCounts = state.players.map(() => 0);
  for (const building of Object.values(state.buildings)) {
    if (building.kind === "city") cityCounts[building.player]++;
  }
  const cities = cityCounts.reduce((sum, count) => sum + count, 0);
  const defended = strength.reduce((sum, level) => sum + level, 0) >= cities;

  // a metropolis cannot be pillaged, so a player whose cities are all metropolises is safe
  const metropolises = state.players.map(() => 0);
  for (const holder of Object.values(state.metropolis)) metropolises[holder]++;
  const seats = state.players.map((_, player) => player);
  const contenders = defended
    ? seats
    : seats.filter((player) => cityCounts[player] > metropolises[player]);
  const levels = contenders.map((player) => strength[player]);
  const mark = defended ? Math.max(0, ...levels) : Math.min(Infinity, ...levels);
  // nobody defends Catan with no knights awake
  const players = defended && mark === 0 ? [] : contenders.filter((player) => strength[player] === mark);
  return { cities, strength, defended, players };
}

export function barbariansResolved(state: GameState): boolean {
  return state.ledger.some((entry) => entry.kind === "barbarians" && entry.turn === state.turn);
}

/**
 * Settles the attack: a lone defender earns the Defender of Catan point, and every knight
 * goes back to sleep whichever way it went. Lost cities are picked afterwards.
 */
export function resolveBarbarians(state: GameState): GameState {
  const { defended, players } = barbarianOutlook(state);
  const defender = defended && players.length === 1 ? players[0] : undefined;
  const knights = Object.fromEntries(
    Object.entries(state.knights).map(([corner, knight]) => [corner, { ...knight, active: false }])
  );
  const settled: GameState = {
    ...state,
    knights,
    players: state.players.map((player, seat) =>
      seat === defender ? { ...player, extraPoints: player.extraPoints + 1 } : player
    ),
  };
  return logged(settled, { kind: "barbarians", defended, players });
}

/** Players who still owe the barbarians a city from the last attack. */
export function pendingPillage(state: GameState): number[] {
  const last = state.ledger.map((entry) => entry.kind).lastIndexOf("barbarians");
  const attack = state.ledger[last];
  if (attack?.kind !== "barbarians" || attack.defended) return [];
  const paid = state.ledger
    .slice(last)
    .flatMap((entry) => (entry.kind === "pillage" ? [entry.player] : []));
  return attack.players.filter((player) => !paid.includes(player));
}

export function pillageCity(state: GameState, corner: string): GameState {
  const building = state.buildings[corner];
  if (building?.kind !== "city" || !pendingPillage(state).includes(building.player)) return state;
  const buildings = { ...state.buildings, [corner]: { ...building, kind: "settlement" as const } };
  return logged({ ...state, buildings }, { kind: "pillage", player: building.player });
}

export interface SetupTurn {
  player: number;
  piece: BuildingKind | "road";
}

/**
 * Whose opening placement is next, or null once everyone has two buildings and two roads.
 * The order runs forwards and then back, so whoever places first also places last. Cities &
 * Knights makes the second building a city.
 */
export function setupTurn(state: GameState): SetupTurn | null {
  const count = state.players.length;
  if (!state.setup || state.setup.length >= count * 4) return null;

  const placement = Math.floor(state.setup.length / 2);
  const secondRound = placement >= count;
  const player = secondRound ? 2 * count - 1 - placement : placement;
  if (state.setup.length % 2 === 1) return { player, piece: "road" };
  return { player, piece: secondRound && state.citiesKnights ? "city" : "settlement" };
}

/** Opening pieces come out of the box for nothing, so they are logged as free. */
export function placeSetupPiece(
  state: GameState,
  edges: Edge[],
  id: string,
  ship: boolean = false,
  at: number = Date.now()
): GameState {
  const turn = setupTurn(state);
  if (!turn || !state.setup) return state;
  const { player, piece } = turn;
  const placed =
    piece === "road"
      ? toggleRoad(state, edges, id, player, { ship, free: true })
      : logged(
          { ...state, buildings: { ...state.buildings, [id]: { player, kind: piece } } },
          { kind: "build", player, piece, site: id, free: true }
        );
  // the first turn's clock starts when the last opening piece goes down
  return { ...placed, setup: [...state.setup, id], turnStartedAt: at };
}

/** The cards each player's second building earns: one per terrain hex it touches. */
export function startingCards(state: GameState, vertices: Vertex[]): Payout[] {
  const payouts: Payout[] = state.players.map(() => ({}));
  const firstOfSecondRound = state.players.length * 2;
  const hexesByCorner = new Map(vertices.map((vertex) => [vertex.id, vertex.hexes]));

  (state.setup ?? []).forEach((id, step) => {
    const building = state.buildings[id];
    if (step % 2 === 1 || step < firstOfSecondRound || !building) return;
    for (const index of hexesByCorner.get(id) ?? []) {
      const hex = state.hexes[index];
      if (!isResourceHex(hex)) continue;
      const card = RESOURCE_BY_HEX[hex.type];
      payouts[building.player][card] = (payouts[building.player][card] ?? 0) + 1;
    }
  });
  return payouts;
}

/** Turns an explored fog hex into what was drawn for it, or back into fog. */
export function revealHex(state: GameState, index: number, hex: Hex): GameState {
  const revealed: GameState = {
    ...state,
    hexes: state.hexes.map((current, i) => (i === index ? hex : current)),
    // re-picking a hex replaces its line rather than exploring it twice
    ledger: state.ledger.filter((entry) => entry.kind !== "explore" || entry.hex !== index),
  };
  if (hex.type === "fog") return revealed;
  return logged(revealed, { kind: "explore", player: currentPlayer(state), hex: index });
}

/** What is still in the facedown stack once the hexes explored so far are taken out. */
export function facedownRemaining(
  stack: FacedownStack,
  layout: Hex[],
  hexes: Hex[]
): FacedownStack {
  const terrain = { ...stack.terrain };
  const chits = { ...stack.chits };
  hexes.forEach((hex, index) => {
    if (layout[index].type !== "fog" || hex.type === "fog") return;
    terrain[hex.type] = (terrain[hex.type] ?? 0) - 1;
    if (hex.number !== undefined) chits[hex.number] = (chits[hex.number] ?? 0) - 1;
  });
  return { terrain, chits };
}

export function playerPoints(state: GameState): number[] {
  const points = state.players.map(
    (player, index) =>
      player.extraPoints +
      (state.longestRoad === index ? 2 : 0) +
      (state.largestArmy === index ? 2 : 0)
  );
  for (const building of Object.values(state.buildings)) {
    points[building.player] += building.kind === "city" ? 2 : 1;
  }
  for (const holder of Object.values(state.metropolis)) points[holder] += 2;
  clothCollected(state).forEach((cloth, player) => (points[player] += Math.floor(cloth / 2)));
  return points;
}

/**
 * Cloth tokens taken from villages, two of which are worth a point. Only counted on maps
 * that have villages, since Cities & Knights uses the same word for a commodity.
 */
export function clothCollected(state: GameState): number[] {
  const cloth = state.players.map(() => 0);
  if (!state.hexes.some((hex) => hex.type === "village")) return cloth;
  for (const roll of state.rolls) {
    roll.payouts.forEach((payout, player) => (cloth[player] += payout.cloth ?? 0));
  }
  return cloth;
}

export interface ProductionTotals {
  received: number[];
  expected: number[];
}

/** Cards each player has been dealt against what their buildings should have brought in. */
export function productionTotals(state: GameState): ProductionTotals {
  const received = state.players.map(() => 0);
  const expected = state.players.map(() => 0);
  for (const roll of state.rolls) {
    roll.payouts.forEach((payout, player) => {
      for (const count of Object.values(payout)) received[player] += count;
    });
    roll.expected.forEach((amount, player) => (expected[player] += amount));
  }
  return { received, expected };
}

const COSTS: Record<string, Payout> = Object.fromEntries(
  BUILDING_COSTS.map(({ id, cost }) => [id, cost])
);

export function pieceCost(piece: Piece): Payout {
  return COSTS[piece];
}

/** Moving a knight or chasing the robber with one costs nothing. */
export function knightCost(action: KnightAction): Payout {
  return COSTS[`knight-${action}`] ?? {};
}

const COMMODITY_BY_TRACK = Object.fromEntries(
  IMPROVEMENT_TRACKS.map(({ id, commodity }) => [id, commodity])
) as Record<Track, Commodity>;

/** What a line of the history cost its player, if it cost anything. */
export function entryCost(entry: LedgerEntry): Payout | undefined {
  switch (entry.kind) {
    case "build":
      return entry.free ? undefined : pieceCost(entry.piece);
    case "troop":
      return knightCost(entry.action);
    case "card":
      return COSTS["dev-card"];
    case "wall":
      return COSTS["city-wall"];
    case "improve":
      // each level costs its own number in the track's commodity
      return { [COMMODITY_BY_TRACK[entry.track]]: entry.level };
    default:
      return undefined;
  }
}

/** Cards each player has paid the bank, opening pieces aside. */
export function buildSpending(state: GameState): number[] {
  const spent = state.players.map(() => 0);
  for (const entry of state.ledger) {
    const cost = entryCost(entry);
    if (!cost || !("player" in entry) || entry.player === null) continue;
    for (const count of Object.values(cost)) spent[entry.player] += count;
  }
  return spent;
}
