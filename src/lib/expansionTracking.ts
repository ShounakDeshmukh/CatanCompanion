import { logged, type GameState, type Track } from "./gameState";

/**
 * The parts of the expansions the board cannot show by itself: development cards bought, the
 * pirate, and the Cities & Knights city improvements with their walls and metropolises.
 */

export const MAX_IMPROVEMENT = 5;
export const MAX_WALLS = 3;
const METROPOLIS_LEVEL = 4;

export function buyDevelopmentCard(state: GameState, player: number): GameState {
  return logged(state, { kind: "card", player });
}

export function movePirate(state: GameState, hex: number, player: number): GameState {
  return logged({ ...state, pirate: hex }, { kind: "pirate", player, hex });
}

export function improvementLevel(state: GameState, player: number, track: Track): number {
  return state.improvements[`${player}:${track}`] ?? 0;
}

/**
 * Who holds a track's metropolis once levels have changed. The first player to the fourth
 * level takes it. It can only be taken from them by reaching the fifth while they are still
 * on the fourth, and at the fifth it is theirs for good. `actor` is whoever just built, which
 * settles who among equals got there.
 */
function metropolisHolder(state: GameState, track: Track, actor: number): number | undefined {
  const level = (player: number) => improvementLevel(state, player, track);
  const holder = state.metropolis[track];
  const seats = state.players.map((_, player) => player);
  if (holder !== undefined && level(holder) === MAX_IMPROVEMENT) return holder;
  const reached = (target: number) =>
    level(actor) >= target ? actor : seats.find((player) => level(player) >= target);
  const top = reached(MAX_IMPROVEMENT);
  if (top !== undefined) return top;
  if (holder !== undefined && level(holder) >= METROPOLIS_LEVEL) return holder;
  return reached(METROPOLIS_LEVEL);
}

function withMetropolis(state: GameState, track: Track, actor: number): GameState {
  const holder = metropolisHolder(state, track, actor);
  if (holder === state.metropolis[track]) return state;
  const { [track]: previous, ...others } = state.metropolis;
  const metropolis = holder === undefined ? others : { ...others, [track]: holder };
  return logged({ ...state, metropolis }, { kind: "metropolis", player: holder ?? null, track });
}

export function raiseImprovement(state: GameState, player: number, track: Track): GameState {
  const level = improvementLevel(state, player, track) + 1;
  if (level > MAX_IMPROVEMENT) return state;
  const raised = logged(
    { ...state, improvements: { ...state.improvements, [`${player}:${track}`]: level } },
    { kind: "improve", player, track, level }
  );
  return withMetropolis(raised, track, player);
}

/** Takes the latest level back as a correction, along with its line in the history. */
export function lowerImprovement(state: GameState, player: number, track: Track): GameState {
  const level = improvementLevel(state, player, track);
  if (level === 0) return state;
  const lowered: GameState = {
    ...state,
    improvements: { ...state.improvements, [`${player}:${track}`]: level - 1 },
    ledger: state.ledger.filter(
      (entry) =>
        !(entry.kind === "improve" && entry.player === player && entry.track === track && entry.level === level)
    ),
  };
  return withMetropolis(lowered, track, player);
}

export function wallCount(state: GameState, player: number): number {
  return state.walls[player] ?? 0;
}

export function changeWalls(state: GameState, player: number, change: 1 | -1): GameState {
  const count = wallCount(state, player) + change;
  if (count < 0 || count > MAX_WALLS) return state;
  const walls = { ...state.walls, [player]: count };
  if (change === 1) return logged({ ...state, walls }, { kind: "wall", player });
  // a correction: the most recent wall leaves the history with it
  const last = state.ledger.map((entry) => entry.kind === "wall" && entry.player === player).lastIndexOf(true);
  return { ...state, walls, ledger: state.ledger.filter((_, index) => index !== last) };
}
