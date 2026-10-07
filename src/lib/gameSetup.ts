import type { FacedownStack, Hex } from "../data/boards/types";
import { RESOURCE_BY_HEX } from "../data/boards/types";
import {
  currentPlayer,
  logged,
  setupTurn,
  toggleRoad,
  type GameState,
  type Payout,
} from "./gameState";
import { isResourceHex } from "./shuffle";
import type { Edge, Vertex } from "./vertices";

/** The opening placements, and the fog hexes that are only dealt once explored. */

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
