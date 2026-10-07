import { getBoardEntry } from "../data/boards/registry";
import { buildBoard } from "./boardFactory";
import { placeSetupPiece } from "./gameSetup";
import {
  currentPlayer,
  cycleBuilding,
  endTurn,
  networkCorners,
  newGame,
  recordRoll,
  setupTurn,
  toggleRoad,
  tooCloseToBuild,
  type GameState,
} from "./gameState";
import { DEFAULT_CONSTRAINTS, generateBoard, hexPips } from "./shuffle";
import { boardGeometry } from "./vertices";

const BOARD = "catan-3-4";
const SEED = 20_240;
const ROLLS = [8, 6, 5, 9, 10, 4, 6, 11, 8];
const TURN_MS = 90_000;

/**
 * A base game a few rounds in, for trying the Play page without setting one up. It is played
 * out through the same moves a table would make, so it is a real game in every respect: the
 * opening placements go to the strongest free corners, then each turn is rolled and built on.
 * The same game comes out every time; only its clock is set from `now`.
 */
export function sampleGame(now: number = Date.now()): GameState {
  const entry = getBoardEntry(BOARD);
  if (!entry) throw new Error(`The sample game's board, ${BOARD}, is missing`);
  const board = buildBoard(entry.template);
  const { hexes } = generateBoard(board, DEFAULT_CONSTRAINTS, SEED);
  const { vertices, edges } = boardGeometry(board);

  const onLand = (indices: number[]) => indices.some((index) => hexes[index].type !== "sea");
  const pips = (indices: number[]) => indices.reduce((sum, index) => sum + hexPips(hexes[index]), 0);
  const strongestFirst = [...vertices].sort((a, b) => pips(b.hexes) - pips(a.hexes));

  let state: GameState = {
    ...newGame(BOARD, hexes, now - (ROLLS.length + 6) * TURN_MS),
    players: [
      { name: "Asha", color: "red", extraPoints: 0 },
      { name: "Ben", color: "blue", extraPoints: 0 },
      { name: "Chloe", color: "white", extraPoints: 0 },
    ],
  };

  for (let turn = setupTurn(state); turn; turn = setupTurn(state)) {
    const justBuilt = state.setup?.at(-1);
    const site =
      turn.piece === "road"
        ? edges.find(
            (edge) =>
              justBuilt !== undefined &&
              edge.ends.includes(justBuilt) &&
              state.roads[edge.id] === undefined &&
              onLand(edge.hexes)
          )
        : strongestFirst.find(
            (vertex) => !state.buildings[vertex.id] && !tooCloseToBuild(state, edges, vertex.id)
          );
    if (!site) throw new Error("The sample game ran out of places to build");
    state = placeSetupPiece(state, edges, site.id, false, now);
  }

  ROLLS.forEach((total, index) => {
    const rolledAt = now - (ROLLS.length - index) * TURN_MS;
    state = recordRoll(state, vertices, total, undefined, rolledAt, edges);
    const player = currentPlayer(state);

    if (index % 2 === 0) {
      const reach = networkCorners(state, edges, player, false);
      const side = edges.find(
        (edge) =>
          state.roads[edge.id] === undefined &&
          onLand(edge.hexes) &&
          edge.ends.some((corner) => reach.has(corner))
      );
      if (side) state = toggleRoad(state, edges, side.id, player);
    }
    if (index === 4 || index === 7) {
      const settlement = Object.entries(state.buildings).find(
        ([, building]) => building.player === player && building.kind === "settlement"
      );
      if (settlement) state = cycleBuilding(state, edges, settlement[0], player);
    }
    state = endTurn(state, rolledAt + TURN_MS);
  });

  return state;
}
