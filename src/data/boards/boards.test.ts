import test from "node:test";
import assert from "node:assert/strict";

import { BOARD_REGISTRY, getBoardEntry } from "./registry";
import { MANUAL_COUNTS, NOT_YET_TRANSCRIBED } from "./manualCounts";
import { RESOURCE_BY_HEX } from "./types";
import type { Hex } from "./types";
import { buildBoard } from "../../lib/boardFactory";
import { generateBoard, UnsatisfiableConstraintsError, UNCONSTRAINED } from "../../lib/shuffle";

const NO_CONSTRAINTS = UNCONSTRAINED;

function tally<K extends string | number>(values: K[]): Record<K, number> {
  return values.reduce(
    (acc, value) => ({ ...acc, [value]: (acc[value] ?? 0) + 1 }),
    {} as Record<K, number>
  );
}

const terrainCounts = (hexes: Hex[]) =>
  tally(hexes.filter((h) => h.type !== "sea").map((h) => h.type));

// a cloth village carries two discs, so both count toward the rule book's total
const chitCounts = (hexes: Hex[]) =>
  tally(
    hexes.flatMap((h) => [
      ...(h.number === undefined ? [] : [h.number]),
      ...(h.secondNumber === undefined ? [] : [h.secondNumber]),
    ])
  );

const portCounts = (hexes: Hex[]) =>
  tally(hexes.flatMap((h) => (h.port ? [h.port.type] : [])));

/** Connected landmass sizes, largest first, counting deserts as water. */
function landmassSizes(board: ReturnType<typeof buildBoard>): number[] {
  const hexes = board.recommendedLayout;
  const isLand = (i: number) => hexes[i].type !== "sea" && hexes[i].type !== "desert";
  const seen = new Set<number>();
  const sizes: number[] = [];

  hexes.forEach((_, start) => {
    if (seen.has(start) || !isLand(start)) return;
    let size = 0;
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const current = stack.pop() as number;
      size++;
      for (const neighbor of Object.values(board.neighbors[current])) {
        if (!seen.has(neighbor) && isLand(neighbor)) {
          seen.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
    sizes.push(size);
  });

  return sizes.sort((a, b) => b - a);
}

for (const entry of BOARD_REGISTRY) {
  const expected = MANUAL_COUNTS[entry.id];

  test(`${entry.id} builds and generates`, () => {
    const board = buildBoard(entry.template);
    assert.ok(board.recommendedLayout.length > 0, "board has no hexes");
    assert.equal(board.maxPipsOnChits.length, board.recommendedLayout.length);
    assert.equal(board.cssGridAreas.length, board.recommendedLayout.length);

    // neighbour links must be symmetric, or the adjacency constraints silently under-check
    board.neighbors.forEach((links, index) => {
      for (const neighbor of Object.values(links)) {
        assert.ok(
          Object.values(board.neighbors[neighbor]).includes(index),
          `hex ${index} <-> ${neighbor} link is one-way`
        );
      }
    });

    const { hexes } = generateBoard(board, NO_CONSTRAINTS, 20260902);
    assert.equal(hexes.length, board.recommendedLayout.length);
  });

  test(`${entry.id} keeps its component pool when generated`, () => {
    const board = buildBoard(entry.template);
    const before = {
      terrain: terrainCounts(board.recommendedLayout),
      chits: chitCounts(board.recommendedLayout),
      ports: portCounts(board.recommendedLayout),
    };

    for (const seed of [1, 2, 12345, 999999]) {
      const { hexes } = generateBoard(board, NO_CONSTRAINTS, seed);
      assert.deepEqual(terrainCounts(hexes), before.terrain, `seed ${seed} terrain`);
      assert.deepEqual(chitCounts(hexes), before.chits, `seed ${seed} chits`);
      assert.deepEqual(portCounts(hexes), before.ports, `seed ${seed} ports`);

      // the desert produces nothing, so it must never come out holding a number disc
      for (const hex of hexes) {
        // cloth villages carry discs too; nothing else non-producing may
        if (hex.number !== undefined && hex.type !== "village") {
          assert.ok(hex.type in RESOURCE_BY_HEX, `${hex.type} got a number disc`);
        }
      }

      // a fixed hex keeps its terrain and chit. Its port may change only where the board
      // says ports move: New World has players place the tokens themselves, so one can
      // legitimately end up on a frame hex that started bare.
      board.recommendedLayout.forEach((original, i) => {
        if (!original.fixed) return;
        const { port: originalPort, ...originalTerrain } = original;
        const { port: shuffledPort, ...shuffledTerrain } = hexes[i];
        assert.deepEqual(shuffledTerrain, originalTerrain, `fixed hex ${i} moved`);
        // a printed harbor never changes edge. Its type does where the book's setup
        // shuffles the port tokens among the locations shown on the map.
        if (originalPort && !originalPort.moveable) {
          assert.ok(shuffledPort, `fixed port ${i} vanished`);
          assert.equal(shuffledPort?.orientation, originalPort.orientation, `port ${i} turned`);
          if (!board.shufflePortTypes) {
            assert.equal(shuffledPort?.type, originalPort.type, `fixed port ${i} changed type`);
          }
        }
      });
    }
  });

  test(`${entry.id} honours its per-position pip caps`, () => {
    const board = buildBoard(entry.template);
    for (const seed of [7, 77, 777]) {
      const { hexes } = generateBoard(board, NO_CONSTRAINTS, seed);
      hexes.forEach((hex, i) => {
        if (hex.number === undefined || hex.fixed) return;
        const pips = 6 - Math.abs(7 - hex.number);
        assert.ok(pips <= board.maxPipsOnChits[i], `position ${i} exceeds its pip cap`);
      });
    }
  });

  if (expected) {
    test(`${entry.id} matches ${expected.source}`, () => {
      const board = buildBoard(entry.template);
      const { recommendedLayout } = board;
      assert.deepEqual(terrainCounts(recommendedLayout), expected.terrain, "terrain hexes");
      assert.deepEqual(chitCounts(recommendedLayout), expected.chits, "number discs");
      assert.deepEqual(portCounts(recommendedLayout), expected.ports, "harbors");
      if (expected.islands) {
        assert.deepEqual(landmassSizes(board), expected.islands, "landmasses");
      }
    });
  } else {
    test(`${entry.id} is a known gap`, () => {
      assert.ok(
        NOT_YET_TRANSCRIBED.has(entry.id),
        `${entry.id} has no MANUAL_COUNTS row and is not listed as unverified`
      );
    });
  }
}

test("every port sits on a fixed sea hex and names an edge", () => {
  for (const entry of BOARD_REGISTRY) {
    for (const hex of buildBoard(entry.template).recommendedLayout) {
      if (!hex.port) continue;
      assert.equal(hex.type, "sea", `${entry.id}: port on a ${hex.type} hex`);
      assert.ok(hex.fixed || hex.port.moveable, `${entry.id}: port on a shuffling hex`);
      assert.ok(
        [0, 60, 120, 180, 240, 300].includes(hex.port.orientation),
        `${entry.id}: port orientation ${hex.port.orientation} is not a hex edge`
      );
    }
  }
});

test("groups listed in fixNumbersInGroups keep each disc on its own tile", () => {
  // The Pirate Islands fixes every chit; The Wonders of Catan fixes all but the main island.
  // Terrain still shuffles, and a disc travels with the hex it was printed on, so what must
  // hold is that no disc is ever dealt to a different tile.
  for (const entry of BOARD_REGISTRY) {
    const board = buildBoard(entry.template);
    if (!board.fixNumbersInGroups?.length) continue;

    const pairs = (hexes: Hex[]) =>
      tally(
        hexes
          .filter((h) => board.fixNumbersInGroups?.includes(h.group) && h.number !== undefined)
          .map((h) => `${h.type}:${h.number}`)
      );
    const before = pairs(board.recommendedLayout);

    for (const seed of [3, 33, 333]) {
      const { hexes } = generateBoard(board, NO_CONSTRAINTS, seed);
      assert.deepEqual(pairs(hexes), before, `${entry.id}: a disc changed tiles (seed ${seed})`);
    }
  }
});

test("moveable ports end up somewhere they can actually trade", () => {
  const DIRECTIONS = ["w", "nw", "ne", "e", "se", "sw"] as const;
  const ORIENTATIONS = [0, 60, 120, 180, 240, 300];

  for (const entry of BOARD_REGISTRY) {
    const board = buildBoard(entry.template);
    if (!board.recommendedLayout.some((hex) => hex.port?.moveable)) continue;

    for (const seed of [11, 222, 3333]) {
      const { hexes } = generateBoard(board, NO_CONSTRAINTS, seed);
      const placed = hexes.filter((hex) => hex.port).length;
      assert.equal(
        placed,
        board.recommendedLayout.filter((hex) => hex.port).length,
        `${entry.id}: lost a port`
      );

      hexes.forEach((hex, i) => {
        if (!hex.port) return;
        assert.equal(hex.type, "sea", `${entry.id}: port ended up on ${hex.type}`);
        const heading = DIRECTIONS[ORIENTATIONS.indexOf(hex.port.orientation)];
        const facing = board.neighbors[i][heading];
        assert.ok(facing !== undefined, `${entry.id}: port ${i} faces off the board`);
        assert.ok(
          hexes[facing as number].type !== "sea" && hexes[facing as number].type !== "fog",
          `${entry.id}: port ${i} docks point at open water`
        );
      });
    }
  }
});

// Rules/Catan Seafarers 3_4.pdf p.12 and 5_6.pdf p.8: victory point tokens and face-down
// development cards on the indicated edges
for (const [id, vp, cards] of [
  ["sf-forgotten-tribe", 8, 4],
  ["sf56-forgotten-tribe", 10, 6],
] as const) {
  test(`${id} lays out its edge rewards`, () => {
  const board = buildBoard(getBoardEntry(id)!.template);
  const items = board.recommendedLayout.flatMap((hex) => hex.edgeItems ?? []);
  assert.equal(items.filter((i) => i.kind === "victoryPoint").length, vp, "VP tokens");
  assert.equal(items.filter((i) => i.kind === "developmentCard").length, cards, "cards");

  // every token has to be reachable by ship, so it must sit on an edge facing water
  board.recommendedLayout.forEach((hex, i) => {
    for (const item of hex.edgeItems ?? []) {
      const heading = (["w", "nw", "ne", "e", "se", "sw"] as const)[
        [0, 60, 120, 180, 240, 300].indexOf(item.orientation)
      ];
      const facing = board.neighbors[i][heading];
      assert.ok(facing !== undefined, `hex ${i} edge token faces off the board`);
      assert.equal(
        board.recommendedLayout[facing as number].type,
        "sea",
        `hex ${i} edge token is landlocked`
      );
    }
  });
  });
}

test("cloth villages never move and never change their discs", () => {
  // The villages are printed setup, not shuffled pieces: their positions and their paired
  // discs are constant, and only the terrain around them is redealt.
  for (const id of ["sf-cloth-for-catan", "sf56-cloth-for-catan"]) {
    const board = buildBoard(getBoardEntry(id)!.template);
    const villages = board.recommendedLayout
      .map((hex, i) => [hex, i] as const)
      .filter(([hex]) => hex.type === "village");
    assert.ok(villages.length > 0, `${id}: no villages`);

    for (const [village] of villages) {
      assert.ok(village.fixed, `${id}: a village is shufflable`);
      assert.ok(village.secondNumber !== undefined, `${id}: a village has only one disc`);
    }

    for (const seed of [1, 42, 4242, 999983]) {
      const { hexes } = generateBoard(board, NO_CONSTRAINTS, seed);
      for (const [village, i] of villages) {
        assert.deepEqual(hexes[i], village, `${id}: village at ${i} changed (seed ${seed})`);
      }
    }
  }
});

test("a facedown stack exactly fills its board's unknown hexes", () => {
  for (const entry of BOARD_REGISTRY) {
    const board = buildBoard(entry.template);
    const unknown = board.recommendedLayout.filter((hex) => hex.type === "fog");
    if (!board.facedownStack) {
      assert.equal(unknown.length, 0, `${entry.id}: unknown hexes with no stack to fill them`);
      continue;
    }

    const { terrain, chits } = board.facedownStack;
    const sum = (counts: Record<string, number | undefined>) =>
      Object.values(counts).reduce((a: number, n) => a + (n ?? 0), 0);

    assert.equal(sum(terrain), unknown.length, `${entry.id}: stack does not fill the fog`);
    // every hex in the stack that produces gets a disc; sea and desert do not
    const producing = sum(terrain) - (terrain.sea ?? 0) - (terrain.desert ?? 0);
    assert.equal(sum(chits), producing, `${entry.id}: stack discs do not match its land`);
    // the host lays these out, so nothing on the board may pre-empt them
    for (const hex of unknown) {
      assert.ok(hex.fixed, `${entry.id}: an unknown hex is shufflable`);
      assert.equal(hex.number, undefined, `${entry.id}: an unknown hex already has a disc`);
    }
  }
});

// Each optional fairness rule must actually hold in the boards it produces. None of these are
// official; they are the knobs players reach for.
test("the fairness constraints hold in the boards they produce", () => {
  const board = buildBoard(getBoardEntry("catan-3-4")!.template);
  const CORNERS = [
    ["w", "nw"], ["nw", "ne"], ["ne", "e"], ["e", "se"], ["se", "sw"], ["sw", "w"],
  ] as const;
  const pips = (h: Hex) =>
    (h.number === undefined ? 0 : 6 - Math.abs(7 - h.number)) +
    (h.secondNumber === undefined ? 0 : 6 - Math.abs(7 - h.secondNumber));

  for (const seed of [4, 44, 444]) {
    const near = (hexes: Hex[], i: number) =>
      Object.values(board.neighbors[i]).map((n) => hexes[n]);

    const sixEight = generateBoard(board, { ...UNCONSTRAINED, noAdjacentSixEight: true }, seed);
    sixEight.hexes.forEach((hex, i) => {
      if (hex.number === undefined || ![6, 8].includes(hex.number)) return;
      for (const n of near(sixEight.hexes, i)) {
        assert.ok(n.number === undefined || ![6, 8].includes(n.number), "6/8 touch");
      }
    });

    const twoTwelve = generateBoard(board, { ...UNCONSTRAINED, noAdjacentTwoTwelve: true }, seed);
    twoTwelve.hexes.forEach((hex, i) => {
      if (hex.number === undefined || ![2, 12].includes(hex.number)) return;
      for (const n of near(twoTwelve.hexes, i)) {
        assert.ok(n.number === undefined || ![2, 12].includes(n.number), "2/12 touch");
      }
    });

    const pairs = generateBoard(board, { ...UNCONSTRAINED, noAdjacentPairs: true }, seed);
    pairs.hexes.forEach((hex, i) => {
      if (hex.number === undefined) return;
      for (const n of near(pairs.hexes, i)) assert.notEqual(n.number, hex.number, "pair touch");
    });

    const terrain = generateBoard(
      board,
      { ...UNCONSTRAINED, maxConnectedLikeTerrain: 2 },
      seed
    );
    const seen = new Set<number>();
    terrain.hexes.forEach((hex, start) => {
      if (seen.has(start) || hex.type === "sea") return;
      let size = 0;
      const stack = [start];
      seen.add(start);
      while (stack.length > 0) {
        const current = stack.pop() as number;
        size++;
        for (const n of Object.values(board.neighbors[current])) {
          if (!seen.has(n) && terrain.hexes[n].type === terrain.hexes[current].type) {
            seen.add(n);
            stack.push(n);
          }
        }
      }
      assert.ok(size <= 2, `terrain run of ${size} exceeds 2`);
    });

    const corners = generateBoard(
      board,
      { ...UNCONSTRAINED, maxIntersectionPipCount: 11 },
      seed
    );
    corners.hexes.forEach((hex, i) => {
      for (const [a, b] of CORNERS) {
        const first = board.neighbors[i][a];
        const second = board.neighbors[i][b];
        if (first === undefined || second === undefined) continue;
        const total = pips(hex) + pips(corners.hexes[first]) + pips(corners.hexes[second]);
        assert.ok(total <= 11, `corner pip total ${total} exceeds 11`);
      }
    });
  }
});

/**
 * Gold fields belong to the islands. The rule books never say so outright, but the variable
 * setups split the hexes into a main-island pool and an unexplored-regions pool, and gold is
 * printed in the latter in every scenario. New World is the exception by its own rules: it has
 * one area and everything is placed freely within the frame.
 */
test("gold fields stay off the main island", () => {
  for (const entry of BOARD_REGISTRY) {
    if (entry.id === "sf56-new-world" || entry.id === "sf-new-world") continue;
    const board = buildBoard(entry.template);
    if (!board.recommendedLayout.some((hex) => hex.type === "gold")) continue;

    // deserts count as water here: that is what splits Through the Desert's island
    const isLand = (hexes: Hex[], i: number) =>
      hexes[i].type !== "sea" && hexes[i].type !== "desert";

    const goldOnMainIsland = (hexes: Hex[]) => {
      const seen = new Set<number>();
      const island = new Map<number, number>();
      const sizes: number[] = [];
      hexes.forEach((_, start) => {
        if (seen.has(start) || !isLand(hexes, start)) return;
        let size = 0;
        const stack = [start];
        seen.add(start);
        while (stack.length > 0) {
          const current = stack.pop() as number;
          size++;
          island.set(current, sizes.length);
          for (const n of Object.values(board.neighbors[current])) {
            if (!seen.has(n) && isLand(hexes, n)) {
              seen.add(n);
              stack.push(n);
            }
          }
        }
        sizes.push(size);
      });
      const mainIsland = sizes.indexOf(Math.max(...sizes));
      return hexes.filter((h, i) => h.type === "gold" && island.get(i) === mainIsland).length;
    };

    assert.equal(goldOnMainIsland(board.recommendedLayout), 0, `${entry.id}: printed layout`);
    for (const seed of [1, 2, 3, 99, 12345]) {
      const { hexes } = generateBoard(board, UNCONSTRAINED, seed);
      assert.equal(goldOnMainIsland(hexes), 0, `${entry.id}: seed ${seed}`);
    }
  }
});

test("mandatory layout does not count against the terrain limit", () => {
  // Through the Desert prints three deserts as a strip that splits the island. They are fixed,
  // so a cap below three must not make the board unsatisfiable.
  for (const id of ["sf-through-desert-3p", "sf-through-desert-4p", "sf56-through-desert"]) {
    const board = buildBoard(getBoardEntry(id)!.template);
    const deserts = board.recommendedLayout.filter((hex) => hex.type === "desert");
    assert.ok(deserts.length >= 3, `${id}: expected a desert strip`);
    for (const hex of deserts) assert.ok(hex.fixed, `${id}: a desert strip hex is shufflable`);

    // caps of 2 and 3 used to be impossible on these boards purely because the fixed strip
    // counted as a run of 3
    for (const cap of [1, 2, 3]) {
      assert.doesNotThrow(
        () => generateBoard(board, { ...UNCONSTRAINED, maxConnectedLikeTerrain: cap }, 11),
        `${id}: cap ${cap} broke the board`
      );
    }
  }
});

/**
 * Where a rule book splits the setup into pools - "gather the main island land hexes… gather
 * the unexplored regions' hexes" - the pools never exchange hexes. Whatever terrain a pool
 * starts with, it keeps.
 *
 * Stated on the shuffle groups rather than on landmasses, because deserts move on some boards
 * and deserts are what split an island, so which hexes form "the main island" legitimately
 * differs between draws.
 */
test("shuffle pools never exchange hexes", () => {
  for (const entry of BOARD_REGISTRY) {
    const board = buildBoard(entry.template);

    const poolTerrain = (hexes: Hex[]) => {
      const pools = new Map<string, string[]>();
      hexes.forEach((hex) => {
        if (hex.type === "sea") return;
        const key = String(hex.group ?? "main");
        const members = pools.get(key) ?? [];
        members.push(hex.type);
        pools.set(key, members);
      });
      return [...pools]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, types]) => [key, tally(types)] as const);
    };

    const printed = poolTerrain(board.recommendedLayout);
    for (const seed of [1, 2, 3, 99, 12345]) {
      const { hexes } = generateBoard(board, UNCONSTRAINED, seed);
      assert.deepEqual(poolTerrain(hexes), printed, `${entry.id}: pools mixed (seed ${seed})`);
    }
  }
});

test("the tightest terrain setting is reachable on every board", () => {
  // "no two alike may touch" is satisfied by roughly one random arrangement in fifty thousand
  // on The Six Islands, so this only passes because placement is constraint-aware rather than
  // shuffle-and-hope. It is the regression guard for that.
  for (const entry of BOARD_REGISTRY) {
    const board = buildBoard(entry.template);
    const { hexes } = generateBoard(
      board,
      { ...UNCONSTRAINED, maxConnectedLikeTerrain: 1 },
      2343708456
    );
    hexes.forEach((hex, i) => {
      if (hex.type === "sea" || hex.fixed) return;
      for (const n of Object.values(board.neighbors[i])) {
        if (hexes[n].fixed) continue;
        assert.notEqual(hexes[n].type, hex.type, `${entry.id}: ${hex.type} touches itself`);
      }
    });
  }
});

test("every board is still generatable with the adjacency rules all on", () => {
  // directed placement is what makes this feasible; blind retries could not find these
  const ALL_ON = {
    ...UNCONSTRAINED,
    noAdjacentSixEight: true,
    noAdjacentTwoTwelve: true,
    noAdjacentPairs: true,
    maxConnectedLikeTerrain: 1,
  };
  for (const entry of BOARD_REGISTRY) {
    const board = buildBoard(entry.template);
    assert.doesNotThrow(
      () => generateBoard(board, ALL_ON, 424242),
      `${entry.id}: over-constrained by the adjacency rules alone`
    );
  }
});

test("an impossible combination gives up promptly", () => {
  // a corner cap of 10 alongside everything else needs more low chits than the box holds.
  // What matters is that the page is told quickly rather than freezing.
  const board = buildBoard(getBoardEntry("sf-through-desert-3p")!.template);
  const started = Date.now();
  assert.throws(
    () =>
      generateBoard(
        board,
        {
          noAdjacentSixEight: true,
          noAdjacentTwoTwelve: true,
          noAdjacentPairs: true,
          maxConnectedLikeTerrain: 1,
          maxIntersectionPipCount: 10,
          minIslandCount: 1,
        },
        424242
      ),
    UnsatisfiableConstraintsError
  );
  assert.ok(Date.now() - started < 4000, "took too long to give up");
});

test("every registry id is unique", () => {
  const ids = BOARD_REGISTRY.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Cities & Knights 5-6 reuses the base 5-6 board", () => {
  // C&K changes the rules, not the map
  assert.equal(getBoardEntry("catan-5-6")?.template, getBoardEntry("ck-5-6")?.template);
});

test("the per-terrain disc rules the rule books print are obeyed", () => {
  for (const entry of BOARD_REGISTRY) {
    const board = buildBoard(entry.template);
    if (!board.minPipsOnHexTypes && !board.maxPipsOnHexTypes) continue;
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const hex of generateBoard(board, NO_CONSTRAINTS, seed).hexes) {
        if (hex.number === undefined || hex.fixed) continue;
        if (!(hex.type in RESOURCE_BY_HEX)) continue;
        const type = hex.type as keyof typeof RESOURCE_BY_HEX;
        const pips = 6 - Math.abs(7 - hex.number);
        const min = board.minPipsOnHexTypes?.[type];
        const max = board.maxPipsOnHexTypes?.[type];
        if (min !== undefined) {
          assert.ok(pips >= min, `${entry.id}: ${hex.number} on a ${hex.type} is too low`);
        }
        if (max !== undefined) {
          assert.ok(pips <= max, `${entry.id}: ${hex.number} on a ${hex.type} is too high`);
        }
      }
    }
  }
});

test("shuffled harbors keep their edges and their set of port types", () => {
  for (const entry of BOARD_REGISTRY) {
    const board = buildBoard(entry.template);
    if (!board.shufflePortTypes) continue;
    const printed = board.recommendedLayout;
    let moved = 0;

    for (const seed of [1, 2, 3, 4, 5]) {
      const { hexes } = generateBoard(board, NO_CONSTRAINTS, seed);
      assert.deepEqual(portCounts(hexes), portCounts(printed), `${entry.id}: port pool changed`);
      printed.forEach((original, i) => {
        if (!original.port) return;
        assert.ok(hexes[i].port, `${entry.id}: harbor ${i} left its location`);
        if (hexes[i].port?.type !== original.port.type) moved++;
      });
    }

    assert.ok(moved > 0, `${entry.id}: shufflePortTypes is set but nothing ever moves`);
  }
});
