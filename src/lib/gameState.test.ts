import test from "node:test";
import assert from "node:assert/strict";

import { getBoardEntry } from "../data/boards/registry";
import type { Hex } from "../data/boards/types";
import { RESOURCE_BY_HEX } from "../data/boards/types";
import { buildBoard } from "./boardFactory";
import {
  BARBARIAN_TRACK_LENGTH,
  barbarianPosition,
  activateKnight,
  barbarianOutlook,
  barbariansAttacked,
  buildSpending,
  currentPlayer,
  cycleBuilding,
  endTurn,
  expectedProduction,
  facedownRemaining,
  hasRolled,
  knightStrength,
  knightsPlayed,
  moveKnight,
  moveRobber,
  networkCorners,
  newGame,
  pairedPlayer,
  pendingPillage,
  pillageCity,
  placeSetupPiece,
  playKnight,
  playRoadBuilding,
  promoteKnight,
  recruitKnight,
  resolveBarbarians,
  payoutForRoll,
  playerPoints,
  productionTotals,
  recordRoll,
  revealHex,
  roadLengths,
  setLastEvent,
  setupTurn,
  startingCards,
  toggleRoad,
  type GameState,
} from "./gameState";
import { boardStats } from "./boardStats";
import {
  buyDevelopmentCard,
  changeWalls,
  improvementLevel,
  lowerImprovement,
  movePirate,
  raiseImprovement,
} from "./expansionTracking";
import { parseGame } from "./gameCodec";
import { summarize } from "./gameHistory";
import { hexPips } from "./shuffle";
import { boardGeometry } from "./vertices";

const board = buildBoard(getBoardEntry("catan-3-4")!.template);
const hexes = board.recommendedLayout;
const { vertices, edges } = boardGeometry(board);

function startedGame(): GameState {
  return {
    ...newGame("catan-3-4", hexes, 0),
    players: [
      { name: "Asha", color: "red", extraPoints: 0 },
      { name: "Ben", color: "blue", extraPoints: 0 },
    ],
  };
}

const hexIndex = (type: Hex["type"]) => hexes.findIndex((hex) => hex.type === type);
/** A corner touching `index` and no other hex showing the same number. */
function cornerOf(index: number) {
  const number = hexes[index].number;
  const vertex = vertices.find(
    (v) => v.hexes.includes(index) && v.hexes.every((i) => i === index || hexes[i].number !== number)
  );
  assert.ok(vertex);
  return vertex;
}

test("the base board has its 54 settlement corners", () => {
  const land = vertices.filter((v) => v.hexes.some((i) => hexes[i].type !== "sea"));
  assert.equal(land.length, 54);
  assert.ok(vertices.every((v) => v.hexes.length <= 3));
  assert.ok(vertices.every((v) => v.x >= 0 && v.x <= 1 && v.y >= 0 && v.y <= 1));
});

test("the base board has its 72 road edges, each joining two corners", () => {
  const land = edges.filter((edge) => edge.hexes.some((i) => hexes[i].type !== "sea"));
  assert.equal(land.length, 72);
  assert.ok(edges.every((edge) => edge.hexes.length <= 2 && edge.ends[0] !== edge.ends[1]));
});

test("a new game starts the robber on the desert", () => {
  assert.equal(newGame("catan-3-4", hexes).robber, hexIndex("desert"));
});

test("a settlement collects one card and a city two", () => {
  const forest = hexIndex("forest");
  const corner = cornerOf(forest);
  const number = hexes[forest].number as number;

  const settled = cycleBuilding(startedGame(), edges, corner.id, 1);
  assert.deepEqual(payoutForRoll(settled, vertices, number), [{}, { wood: 1 }]);

  const city = cycleBuilding(settled, edges, corner.id, 1);
  assert.deepEqual(payoutForRoll(city, vertices, number), [{}, { wood: 2 }]);

  assert.deepEqual(cycleBuilding(city, edges, corner.id, 1).buildings, {});
});

test("a Cities & Knights city splits forest into wood and paper but doubles brick", () => {
  const forest = hexIndex("forest");
  const hills = hexIndex("hills");
  let state: GameState = { ...startedGame(), citiesKnights: true };
  for (const index of [forest, hills]) {
    const corner = cornerOf(index);
    state = cycleBuilding(cycleBuilding(state, edges, corner.id, 0), edges, corner.id, 0);
  }

  assert.deepEqual(payoutForRoll(state, vertices, hexes[forest].number as number)[0], {
    wood: 1,
    paper: 1,
  });
  assert.equal(payoutForRoll(state, vertices, hexes[hills].number as number)[0].brick, 2);
});

test("the robber blocks its hex", () => {
  const fields = hexIndex("fields");
  const state = { ...cycleBuilding(startedGame(), edges, cornerOf(fields).id, 0), robber: fields };
  assert.deepEqual(payoutForRoll(state, vertices, hexes[fields].number as number), [{}, {}]);
});

test("expected production is the pips of the adjoining hexes over 36", () => {
  const corner = vertices.find((v) => v.hexes.filter((i) => hexes[i].type in RESOURCE_BY_HEX).length === 3);
  assert.ok(corner);
  const pips = corner.hexes.reduce((sum, i) => sum + hexPips(hexes[i]), 0);

  const state = cycleBuilding(startedGame(), edges, corner.id, 0);
  assert.deepEqual(expectedProduction(state, vertices), [pips / 36, 0]);
});

test("a turn is one roll, and passes on only when it is ended", () => {
  const forest = hexIndex("forest");
  const number = hexes[forest].number as number;
  let state = cycleBuilding(startedGame(), edges, cornerOf(forest).id, 0);
  assert.equal(currentPlayer(state), 0);
  assert.equal(endTurn(state), state);

  state = recordRoll(state, vertices, number, undefined, 1);
  assert.equal(hasRolled(state), true);
  assert.equal(currentPlayer(state), 0);
  assert.deepEqual(state.rolls[0].payouts, [{ wood: 1 }, {}]);
  assert.equal(recordRoll(state, vertices, number), state);

  // upgrading afterwards must not rewrite what that roll paid
  state = cycleBuilding(state, edges, cornerOf(forest).id, 0);
  assert.equal(productionTotals(state).received[0], 1);

  state = endTurn(state, 9);
  assert.equal(currentPlayer(state), 1);
  assert.equal(hasRolled(state), false);
  assert.equal(state.turnStartedAt, 9);
});

test("the barbarians attack on the seventh ship and start over", () => {
  let state: GameState = { ...startedGame(), citiesKnights: true };
  for (let ship = 1; ship < BARBARIAN_TRACK_LENGTH; ship++) {
    state = setLastEvent(recordRoll(state, vertices, 7), "ship");
    assert.equal(barbarianPosition(state), ship);
    assert.equal(barbariansAttacked(state), false);
    state = endTurn(state);
  }

  state = recordRoll(state, vertices, 7, "ship");
  assert.equal(barbarianPosition(state), 0);
  assert.equal(barbariansAttacked(state), true);

  state = recordRoll(endTurn(state), vertices, 7, "yellow");
  assert.equal(barbariansAttacked(state), false);
});

test("points count buildings, holders and extras", () => {
  let state = startedGame();
  const first = vertices[0];
  const second = vertices.find((v) => !edges.some((e) => e.ends.includes(first.id) && e.ends.includes(v.id)) && v !== first)!;
  state = cycleBuilding(state, edges, first.id, 0);
  state = cycleBuilding(cycleBuilding(state, edges, second.id, 1), edges, second.id, 1);
  state = {
    ...state,
    longestRoad: 0,
    largestArmy: 1,
    players: state.players.map((player, i) => ({ ...player, extraPoints: i })),
  };

  assert.deepEqual(playerPoints(state), [3, 5]);
});

/** A chain of `length` connected edges that never revisits a corner. */
function roadChain(length: number): { path: string[]; corners: string[] } {
  const landEdges = edges.filter((edge) => edge.hexes.some((i) => hexes[i].type !== "sea"));
  const extend = (path: string[], corners: string[]): string[] | undefined => {
    if (path.length === length) return corners;
    const tip = corners.at(-1) as string;
    for (const edge of landEdges) {
      if (!edge.ends.includes(tip)) continue;
      const next = edge.ends[0] === tip ? edge.ends[1] : edge.ends[0];
      if (corners.includes(next)) continue;
      path.push(edge.id);
      const done = extend(path, [...corners, next]);
      if (done) return done;
      path.pop();
    }
    return undefined;
  };
  const path: string[] = [];
  const corners = extend(path, [landEdges[0].ends[0]]);
  assert.ok(corners);
  return { path, corners };
}

test("the distance rule refuses a settlement next to another", () => {
  const edge = edges[0];
  const settled = cycleBuilding(startedGame(), edges, edge.ends[0], 0);
  const refused = cycleBuilding(settled, edges, edge.ends[1], 1);
  assert.equal(refused, settled);

  // the existing settlement itself can still be upgraded
  assert.equal(cycleBuilding(settled, edges, edge.ends[0], 0).buildings[edge.ends[0]].kind, "city");
});

test("longest road goes to the first run of five and survives a tie", () => {
  const { path } = roadChain(11);
  let state = startedGame();

  path.slice(0, 4).forEach((id) => (state = toggleRoad(state, edges, id, 0)));
  assert.deepEqual(roadLengths(state, edges), [4, 0]);
  assert.equal(state.longestRoad, null);

  state = toggleRoad(state, edges, path[4], 0);
  assert.equal(state.longestRoad, 0);

  // a separate run of five for the other player ties, so the award stays put
  path.slice(6, 11).forEach((id) => (state = toggleRoad(state, edges, id, 1)));
  assert.deepEqual(roadLengths(state, edges), [5, 5]);
  assert.equal(state.longestRoad, 0);

  state = toggleRoad(state, edges, path[5], 1);
  assert.equal(state.longestRoad, 1);
});

test("an opponent's settlement cuts a road and can cost the award", () => {
  const { path, corners } = roadChain(5);
  let state = startedGame();
  path.forEach((id) => (state = toggleRoad(state, edges, id, 0)));
  assert.equal(state.longestRoad, 0);

  state = cycleBuilding(state, edges, corners[2], 1);
  assert.deepEqual(roadLengths(state, edges), [3, 0]);
  assert.equal(state.longestRoad, null);

  // the owner's own settlement does not interrupt it
  const own = cycleBuilding(toggleRoad(startedGame(), edges, path[0], 0), edges, corners[1], 0);
  assert.deepEqual(roadLengths(toggleRoad(own, edges, path[1], 0), edges), [2, 0]);
});

test("the paired player is three seats on, and only with five or six", () => {
  const withPlayers = (count: number): GameState => ({
    ...startedGame(),
    players: Array.from({ length: count }, (_, i) => ({
      name: `P${i}`,
      color: "red" as const,
      extraPoints: 0,
    })),
  });
  assert.equal(pairedPlayer(withPlayers(4), 0), null);
  assert.equal(pairedPlayer(withPlayers(5), 3), 1);
  assert.equal(pairedPlayer(withPlayers(6), 4), 1);
});

test("an explored fog hex pays out and leaves the facedown stack", () => {
  const fogBoard = buildBoard(getBoardEntry("sf-fog-islands-4p")!.template);
  const layout = fogBoard.recommendedLayout;
  const geometry = boardGeometry(fogBoard);
  const fog = layout.findIndex((hex) => hex.type === "fog");
  const corner = geometry.vertices.find((v) => v.hexes.includes(fog))!;

  let state: GameState = { ...startedGame(), hexes: layout };
  state = cycleBuilding(state, geometry.edges, corner.id, 0);
  assert.deepEqual(payoutForRoll(state, geometry.vertices, 12)[0], {});

  state = revealHex(state, fog, { type: "gold", number: 12 });
  assert.deepEqual(payoutForRoll(state, geometry.vertices, 12)[0], { choice: 1 });

  const left = facedownRemaining(fogBoard.facedownStack!, layout, state.hexes);
  assert.equal(left.terrain.gold, 1);
  assert.equal(left.chits[12], 0);
  assert.equal(left.chits[11], 2);
});

test("opening placements snake round the table and pay for the second building", () => {
  let state = startedGame();
  const sites = [0, 20, 40, 53].map((n) => {
    const corner = vertices.filter((v) => v.hexes.some((i) => hexes[i].type !== "sea"))[n];
    return { corner: corner.id, side: edges.find((edge) => edge.ends.includes(corner.id))!.id };
  });

  const order: string[] = [];
  for (const { corner, side } of sites) {
    for (const id of [corner, side]) {
      const turn = setupTurn(state)!;
      order.push(`${turn.player}:${turn.piece}`);
      state = placeSetupPiece(state, edges, id);
    }
  }
  assert.deepEqual(order, [
    "0:settlement", "0:road", "1:settlement", "1:road",
    "1:settlement", "1:road", "0:settlement", "0:road",
  ]);
  assert.equal(setupTurn(state), null);
  assert.deepEqual(playerPoints(state), [2, 2]);

  // only the second-round buildings earn cards: one per terrain hex they touch
  const terrainAt = (id: string) =>
    vertices.find((v) => v.id === id)!.hexes.filter((i) => hexes[i].type in RESOURCE_BY_HEX).length;
  const dealt = startingCards(state, vertices).map((payout) =>
    Object.values(payout).reduce((sum, count) => sum + count, 0)
  );
  assert.deepEqual(dealt, [terrainAt(sites[3].corner), terrainAt(sites[2].corner)]);
});

test("Cities & Knights makes the second opening building a city", () => {
  let state: GameState = { ...startedGame(), citiesKnights: true, setup: ["a", "b", "c", "d"] };
  assert.deepEqual(setupTurn(state), { player: 1, piece: "city" });
  state = placeSetupPiece(state, edges, vertices[0].id);
  assert.equal(state.buildings[vertices[0].id].kind, "city");
});

test("a player's network is their buildings plus their open road ends", () => {
  const { path, corners } = roadChain(2);
  let state = cycleBuilding(startedGame(), edges, corners[0], 0);
  state = toggleRoad(toggleRoad(state, edges, path[0], 0), edges, path[1], 0);
  assert.deepEqual([...networkCorners(state, edges, 0)].sort(), [...corners].sort());

  // an opponent on the far end closes it off
  state = cycleBuilding(state, edges, corners[2], 1);
  assert.equal(networkCorners(state, edges, 0).has(corners[2]), false);
  assert.deepEqual([...networkCorners(state, edges, 1)], [corners[2]]);
});

test("the ledger records builds with their cost and forgets ones taken back", () => {
  const { path, corners } = roadChain(2);
  let state = placeSetupPiece(startedGame(), edges, corners[0]);
  // cut the opening short, as if everyone had finished placing
  state = { ...placeSetupPiece(state, edges, path[0]), setup: null };
  assert.deepEqual(buildSpending(state), [0, 0]);

  state = recordRoll(state, vertices, 7);
  state = moveRobber(state, hexIndex("forest"));
  state = toggleRoad(state, edges, path[1], 0);
  state = cycleBuilding(state, edges, corners[0], 0);
  // a road is two cards and a city five; the opening pieces were free
  assert.deepEqual(buildSpending(state), [7, 0]);
  assert.deepEqual(
    state.ledger.map((entry) => `${entry.turn}:${entry.kind}:${"piece" in entry ? entry.piece : ""}`),
["-1:build:settlement", "-1:build:road", "0:roll:", "0:robber:", "0:build:road", "0:build:city"]
  );

  state = toggleRoad(state, edges, path[1], 0);
  assert.deepEqual(buildSpending(state), [5, 0]);
  assert.equal(state.ledger.some((entry) => entry.kind === "build" && entry.site === path[1]), false);
});

test("a ship costs wood and sheep and only joins a road at the player's own building", () => {
  const { path, corners } = roadChain(4);
  let state = startedGame();
  state = toggleRoad(state, edges, path[0], 0);
  state = toggleRoad(state, edges, path[1], 0);
  state = toggleRoad(state, edges, path[2], 0, { ship: true });
  state = toggleRoad(state, edges, path[3], 0, { ship: true });
  assert.deepEqual(roadLengths(state, edges), [2, 0]);
  assert.equal(buildSpending(state)[0], 8);

  // roads continue from road ends and ships from ship ends, never across
  assert.equal(networkCorners(state, edges, 0, false).has(corners[4]), false);
  assert.equal(networkCorners(state, edges, 0, true).has(corners[4]), true);
  assert.equal(networkCorners(state, edges, 0).has(corners[0]), true);

  state = cycleBuilding(state, edges, corners[2], 0);
  assert.deepEqual(roadLengths(state, edges), [4, 0]);
});

test("a saved game survives a round trip and anything malformed is refused", () => {
  const { path, corners } = roadChain(1);
  let state = placeSetupPiece(startedGame(), edges, corners[0]);
  state = placeSetupPiece(state, edges, path[0]);
  state = recordRoll(state, vertices, 8, "ship", 5);

  const parsed = parseGame(JSON.parse(JSON.stringify(state)));
  assert.ok(parsed);
  assert.deepEqual(parsed.players, state.players);
  assert.equal(parsed.turn, 0);
  assert.deepEqual(parsed.buildings, state.buildings);
  assert.deepEqual(parsed.ledger, state.ledger);
  assert.deepEqual(parsed.rolls[0].payouts, state.rolls[0].payouts);
  assert.deepEqual(
    parsed.hexes.map((hex) => [hex.type, hex.number]),
    state.hexes.map((hex) => [hex.type, hex.number])
  );

  const tampered = (change: (game: any) => void) => {
    const game = JSON.parse(JSON.stringify(state));
    change(game);
    return parseGame(game);
  };
  assert.equal(tampered((game) => (game.players[0].color = 'red)" onclick="x')), undefined);
  assert.equal(tampered((game) => (game.rolls[0].total = "<img src=x>")), undefined);
  assert.equal(tampered((game) => (game.rolls[0].payouts[0] = { "<b>": 1 })), undefined);
  assert.equal(tampered((game) => (game.hexes[3].type = "<script>")), undefined);
  assert.equal(tampered((game) => (game.buildings[corners[0]].player = 9)), undefined);
  assert.equal(tampered((game) => (game.ledger[0].piece = "<i>")), undefined);
  assert.equal(tampered((game) => (game.room = "../x")), undefined);
  assert.equal(parseGame("nonsense"), undefined);

  // games saved before roads, setup and the ledger existed still open
  const legacy = tampered((game) => {
    for (const key of ["roads", "ships", "setup", "ledger", "room", "turn"]) delete game[key];
  });
  assert.deepEqual([legacy?.roads, legacy?.ships, legacy?.setup], [{}, [], null]);
  // a turn used to be just a roll, so one roll means one finished turn and one history line
  assert.equal(legacy?.turn, 1);
  assert.deepEqual(legacy?.ledger, [{ kind: "roll", turn: 0, player: 0, roll: 0 }]);
  assert.equal(tampered((game) => (game.turn = 5)), undefined);
});

/** Rolls and passes, so the next development card falls in a fresh turn. */
const nextTurn = (state: GameState) => endTurn(recordRoll(state, vertices, 8));

test("the third knight takes Largest Army and a tie leaves it where it is", () => {
  const knights = (state: GameState, player: number, count: number) => {
    for (let played = 0; played < count; played++) state = nextTurn(playKnight(state, player));
    return state;
  };
  let state = knights({ ...startedGame(), setup: null }, 0, 2);
  assert.equal(state.largestArmy, null);

  state = knights(state, 0, 1);
  assert.equal(state.largestArmy, 0);
  assert.deepEqual(playerPoints(state), [2, 0]);

  state = knights(state, 1, 3);
  assert.deepEqual(knightsPlayed(state), [3, 3]);
  assert.equal(state.largestArmy, 0);

  state = knights(state, 1, 1);
  assert.equal(state.largestArmy, 1);
  assert.deepEqual(
    state.ledger.filter((entry) => entry.kind === "award").map((entry) => entry.player),
    [0, 1]
  );
});

test("one development card a turn, except in Cities & Knights", () => {
  const base: GameState = { ...startedGame(), setup: null };
  const played = playKnight(base, 0);
  assert.equal(playKnight(played, 0), played);
  assert.equal(playRoadBuilding(played, 0), played);
  assert.deepEqual(knightsPlayed(playKnight(nextTurn(played), 0)), [2, 0]);

  const progress = playRoadBuilding({ ...base, citiesKnights: true }, 0);
  assert.notEqual(playRoadBuilding(progress, 0), progress);
});

test("a knight played before the dice comes first in its turn", () => {
  let state: GameState = { ...startedGame(), setup: null };
  state = moveRobber(playKnight(state, 0), hexIndex("forest"), 0);
  state = recordRoll(state, vertices, 8);
  assert.deepEqual(
    state.ledger.map((entry) => `${entry.turn}:${entry.kind}`),
    ["0:knight", "0:robber", "0:roll"]
  );
});

test("Road Building makes the next two roads free, for that player and that turn only", () => {
  const { path } = roadChain(4);
  let state: GameState = { ...startedGame(), setup: null };
  state = playRoadBuilding(state, 0);

  // somebody else building in between pays as usual and does not use one up
  state = toggleRoad(state, edges, path[3], 1);
  state = toggleRoad(toggleRoad(state, edges, path[0], 0), edges, path[1], 0);
  assert.equal(state.freeRoads, null);
  state = toggleRoad(state, edges, path[2], 0);
  assert.deepEqual(buildSpending(state), [2, 2]);

  const unused = playRoadBuilding(nextTurn(state), 1);
  assert.deepEqual(unused.freeRoads, { player: 1, left: 2 });
  assert.equal(nextTurn(unused).freeRoads, null);
});

test("a Cities & Knights knight holds its corner, costs cards and breaks a road", () => {
  const { path, corners } = roadChain(5);
  let state: GameState = { ...startedGame(), setup: null, citiesKnights: true };
  path.forEach((id) => (state = toggleRoad(state, edges, id, 0)));
  assert.equal(state.longestRoad, 0);

  state = recruitKnight(state, edges, corners[2], 1);
  assert.deepEqual(roadLengths(state, edges), [3, 0]);
  assert.equal(state.longestRoad, null);
  // nothing else can go where a knight stands
  assert.equal(cycleBuilding(state, edges, corners[2], 0), state);
  assert.equal(recruitKnight(state, edges, corners[2], 0), state);

  state = promoteKnight(activateKnight(state, corners[2]), corners[2]);
  assert.deepEqual(state.knights[corners[2]], { player: 1, level: 2, active: true });
  assert.deepEqual(knightStrength(state), { active: [0, 2], total: [0, 2] });
  // recruit and promote are two cards each, activating is one; player 0 paid for five roads
  assert.deepEqual(buildSpending(state), [10, 5]);

  state = moveKnight(state, edges, corners[2], corners[5]);
  assert.equal(state.knights[corners[2]], undefined);
  assert.equal(state.knights[corners[5]].active, false);
  assert.equal(state.longestRoad, 0);
});

test("the barbarians are beaten by enough active knights and pillage the weakest otherwise", () => {
  const free = vertices.filter((v) => v.hexes.some((i) => hexes[i].type !== "sea"));
  const spots = [free[0], free[20], free[40], free[53]].map((v) => v.id);
  let state: GameState = { ...startedGame(), setup: null, citiesKnights: true };
  for (const [seat, corner] of [[0, spots[0]], [1, spots[1]]] as const) {
    state = cycleBuilding(cycleBuilding(state, edges, corner, seat), edges, corner, seat);
  }

  // two cities and no knight awake: both players are equally weak and both lose one
  state = recruitKnight(state, edges, spots[2], 0);
  assert.deepEqual(barbarianOutlook(state), {
    cities: 2,
    strength: [0, 0],
    defended: false,
    players: [0, 1],
  });

  // one strong knight matches two cities, and a tie goes to Catan
  const held = promoteKnight(activateKnight(state, spots[2]), spots[2]);
  assert.deepEqual(barbarianOutlook(held).players, [0]);
  const defended = resolveBarbarians(held);
  assert.equal(defended.players[0].extraPoints, 1);
  assert.equal(defended.knights[spots[2]].active, false);
  assert.deepEqual(pendingPillage(defended), []);

  // one basic knight is not enough; only the player without it is pillaged
  const lost = resolveBarbarians(activateKnight(state, spots[2]));
  assert.deepEqual(pendingPillage(lost), [1]);
  assert.equal(pillageCity(lost, spots[0]), lost);
  const pillaged = pillageCity(lost, spots[1]);
  assert.equal(pillaged.buildings[spots[1]].kind, "settlement");
  assert.deepEqual(pendingPillage(pillaged), []);
  assert.ok(parseGame(JSON.parse(JSON.stringify(pillaged))));
});

test("development cards and walls are charged to whoever bought them", () => {
  let state: GameState = { ...startedGame(), setup: null };
  state = buyDevelopmentCard(state, 1);
  state = changeWalls(changeWalls(state, 0, 1), 0, 1);
  // a card is three cards, a wall two bricks
  assert.deepEqual(buildSpending(state), [4, 3]);

  state = changeWalls(state, 0, -1);
  assert.deepEqual(buildSpending(state), [2, 3]);
  assert.equal(changeWalls(changeWalls(changeWalls(state, 0, 1), 0, 1), 0, 1).walls[0], 3);
});

test("the first to the fourth level holds a metropolis until someone reaches the fifth", () => {
  const build = (state: GameState, player: number, levels: number) => {
    for (let level = 0; level < levels; level++) state = raiseImprovement(state, player, "trade");
    return state;
  };
  let state = build({ ...startedGame(), setup: null, citiesKnights: true }, 0, 3);
  assert.equal(state.metropolis.trade, undefined);
  // levels one to three cost 1 + 2 + 3 cloth
  assert.deepEqual(buildSpending(state), [6, 0]);

  state = build(state, 0, 1);
  assert.equal(state.metropolis.trade, 0);
  assert.deepEqual(playerPoints(state), [2, 0]);

  // matching the holder is not enough; passing them is
  state = build(state, 1, 4);
  assert.equal(state.metropolis.trade, 0);
  state = build(state, 1, 1);
  assert.equal(state.metropolis.trade, 1);
  assert.equal(build(state, 0, 1).metropolis.trade, 1);

  // taking a level back as a correction hands it back
  state = lowerImprovement(state, 1, "trade");
  assert.equal(improvementLevel(state, 1, "trade"), 4);
  assert.equal(state.metropolis.trade, 1);
  assert.equal(lowerImprovement(lowerImprovement(state, 1, "trade"), 0, "trade").metropolis.trade, undefined);
  assert.ok(parseGame(JSON.parse(JSON.stringify(state))));
});

test("a player whose only city is a metropolis is safe from the barbarians", () => {
  const free = vertices.filter((v) => v.hexes.some((i) => hexes[i].type !== "sea"));
  let state: GameState = { ...startedGame(), setup: null, citiesKnights: true };
  for (const [seat, corner] of [[0, free[0].id], [1, free[30].id]] as const) {
    state = cycleBuilding(cycleBuilding(state, edges, corner, seat), edges, corner, seat);
  }
  assert.deepEqual(barbarianOutlook(state).players, [0, 1]);
  for (let level = 0; level < 4; level++) state = raiseImprovement(state, 0, "science");
  assert.deepEqual(barbarianOutlook(state).players, [1]);
});

test("a cloth village pays whoever has a ship on it, and two cloth make a point", () => {
  const cloth = buildBoard(getBoardEntry("sf-cloth-for-catan")!.template);
  const layout = cloth.recommendedLayout;
  const geometry = boardGeometry(cloth);
  const village = layout.findIndex((hex) => hex.type === "village");
  const side = geometry.edges.find((edge) => edge.hexes.includes(village))!;
  const number = layout[village].number as number;

  let state: GameState = { ...startedGame(), setup: null, hexes: layout };
  state = toggleRoad(state, geometry.edges, side.id, 1, { ship: true });
  assert.deepEqual(payoutForRoll(state, geometry.vertices, number, geometry.edges)[1], { cloth: 1 });
  // without the map's sides the village cannot be reached, which is how old callers behave
  assert.deepEqual(payoutForRoll(state, geometry.vertices, number)[1], {});

  for (let roll = 0; roll < 3; roll++) {
    state = endTurn(recordRoll(state, geometry.vertices, number, undefined, 0, geometry.edges));
  }
  assert.deepEqual(playerPoints(state), [0, 1]);
});

test("the pirate is tracked and written into the history", () => {
  const sea = hexes.findIndex((hex) => hex.type === "sea");
  const state = movePirate({ ...startedGame(), setup: null }, sea, 1);
  assert.equal(state.pirate, sea);
  assert.deepEqual(state.ledger.at(-1), { kind: "pirate", turn: 0, player: 1, hex: sea });
  assert.equal(parseGame(JSON.parse(JSON.stringify(state)))?.pirate, sea);
});

test("a finished game is summed up best player first", () => {
  let state: GameState = { ...startedGame(), setup: null };
  state = cycleBuilding(state, edges, cornerOf(hexIndex("forest")).id, 1);
  state = recordRoll(state, vertices, hexes[hexIndex("forest")].number as number);
  const record = summarize(state, "Catan (3-4 players)", 99);
  assert.deepEqual(record.players.map((player) => [player.name, player.points, player.cards]), [
    ["Ben", 1, 1],
    ["Asha", 0, 0],
  ]);
  assert.equal(record.rolls.reduce((sum, count) => sum + count, 0), 1);
  assert.equal(record.turns, 1);
});

test("board statistics total the pips and rank the best corners", () => {
  const stats = boardStats(hexes, vertices, 3);
  // the base game's eighteen discs carry 58 pips between them
  assert.equal(Object.values(stats.pips).reduce((sum, pips) => sum + pips, 0), 58);
  assert.deepEqual(stats.hexes, { wood: 4, wool: 4, wheat: 4, brick: 3, ore: 3 });
  assert.equal(stats.corners.length, 3);
  assert.ok(stats.corners[0].pips >= stats.corners[2].pips);
  for (const corner of stats.corners) {
    assert.equal(corner.pips, corner.hexes.reduce((sum, i) => sum + hexPips(hexes[i]), 0));
  }
});
