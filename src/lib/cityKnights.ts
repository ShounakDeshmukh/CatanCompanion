import {
  logged,
  occupant,
  withLongestRoad,
  type GameState,
  type Knight,
} from "./gameState";
import type { Edge } from "./vertices";

/**
 * Cities & Knights: the knights that stand on the board, and the barbarian attacks they are
 * there to meet.
 */

/** A player has two knights of each rank: basic, strong and mighty. */
export const KNIGHTS_PER_RANK = 2;

export function knightsOfRank(state: GameState, player: number, level: Knight["level"]): number {
  return Object.values(state.knights).filter(
    (knight) => knight.player === player && knight.level === level
  ).length;
}

/** Whether the player has a knight of this rank left, to recruit or to promote into. */
export function knightAvailable(state: GameState, player: number, level: Knight["level"]): boolean {
  return knightsOfRank(state, player, level) < KNIGHTS_PER_RANK;
}

/** A basic knight goes on an empty corner of the player's own road, asleep. */
export function recruitKnight(
  state: GameState,
  edges: Edge[],
  corner: string,
  player: number
): GameState {
  if (occupant(state, corner) !== undefined || !knightAvailable(state, player, 1)) return state;
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
  // promoting swaps the piece for one of the next rank, which has to be in the box
  if (!knightAvailable(state, knight.player, level)) return state;
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
