import type { Hex } from "../data/boards/types";
import type { GameState, Knight, LedgerEntry } from "./gameState";

/** What a picture of the board needs: the hexes and every piece standing on them. */
export type BoardView = Pick<
  GameState,
  "hexes" | "players" | "buildings" | "knights" | "roads" | "ships" | "robber" | "pirate"
>;

/** The game as it stood at one point, and the corner, side or hex that had just changed. */
export interface Moment {
  state: GameState;
  changed?: string | number;
}

function withKnight(now: GameState, corner: string, change: Partial<Knight>): GameState {
  const knight = now.knights[corner];
  return knight ? { ...now, knights: { ...now.knights, [corner]: { ...knight, ...change } } } : now;
}

function afterTroop(now: GameState, entry: LedgerEntry & { kind: "troop" }, site: string): GameState {
  switch (entry.action) {
    case "recruit": {
      const knight: Knight = { player: entry.player, level: 1, active: false };
      return { ...now, knights: { ...now.knights, [site]: knight } };
    }
    case "promote": {
      const level = Math.min(3, (now.knights[site]?.level ?? 0) + 1) as Knight["level"];
      return withKnight(now, site, { level });
    }
    case "activate":
      return withKnight(now, site, { active: true });
    case "chase":
    case "rest":
      return withKnight(now, site, { active: false });
    case "remove": {
      const { [site]: removed, ...knights } = now.knights;
      return { ...now, knights };
    }
    case "move": {
      const { [entry.from ?? ""]: moved, ...knights } = now.knights;
      return moved ? { ...now, knights: { ...knights, [site]: { ...moved, active: false } } } : now;
    }
  }
}

/**
 * The game after one line of its history. `shown` says whether that is a moment worth a
 * picture: a roll or a change on the board is, where an award only moves the score along.
 */
function after(now: GameState, entry: LedgerEntry, state: GameState): Moment & { shown: boolean } {
  switch (entry.kind) {
    case "build": {
      const { site, player, piece } = entry;
      const next =
        piece === "settlement" || piece === "city"
          ? { ...now, buildings: { ...now.buildings, [site]: { player, kind: piece } } }
          : {
              ...now,
              roads: { ...now.roads, [site]: player },
              ships: piece === "ship" ? [...now.ships, site] : now.ships,
            };
      return { state: next, changed: site, shown: true };
    }
    case "robber":
      return { state: { ...now, robber: entry.hex }, changed: entry.hex, shown: true };
    case "pirate":
      return { state: { ...now, pirate: entry.hex }, changed: entry.hex, shown: true };
    case "explore": {
      const hexes = now.hexes.map((hex, index) => (index === entry.hex ? state.hexes[index] : hex));
      return { state: { ...now, hexes }, changed: entry.hex, shown: true };
    }
    case "troop": {
      const { site } = entry;
      if (site === undefined) return { state: now, shown: false };
      return { state: afterTroop(now, entry, site), changed: site, shown: true };
    }
    case "pillage": {
      const city = entry.site === undefined ? undefined : now.buildings[entry.site];
      if (entry.site === undefined || !city) return { state: now, shown: false };
      const buildings = { ...now.buildings, [entry.site]: { ...city, kind: "settlement" as const } };
      return { state: { ...now, buildings }, changed: entry.site, shown: true };
    }
    case "barbarians": {
      // every knight goes back to sleep, and a lone defender has earned a point
      const defender = entry.defended && entry.players.length === 1 ? entry.players[0] : undefined;
      const knights = Object.fromEntries(
        Object.entries(now.knights).map(([corner, knight]) => [corner, { ...knight, active: false }])
      );
      const players = now.players.map((player, seat) =>
        seat === defender ? { ...player, extraPoints: player.extraPoints + 1 } : player
      );
      const shown = Object.values(now.knights).some((knight) => knight.active);
      return { state: { ...now, knights, players }, shown };
    }
    case "roll":
      return { state: { ...now, rolls: state.rolls.slice(0, entry.roll + 1) }, shown: true };
    case "points": {
      const players = now.players.map((player, seat) =>
        seat === entry.player ? { ...player, extraPoints: player.extraPoints + entry.change } : player
      );
      return { state: { ...now, players }, shown: false };
    }
    case "award":
      return { state: { ...now, [entry.award]: entry.player }, shown: false };
    case "metropolis": {
      const { [entry.track]: held, ...others } = now.metropolis;
      const metropolis = entry.player === null ? others : { ...others, [entry.track]: entry.player };
      return { state: { ...now, metropolis }, shown: false };
    }
    case "knight":
    case "roadBuilding":
    case "card":
    case "improve":
    case "wall":
      return { state: now, shown: false };
  }
}

/**
 * The game at each roll and each change to its board, from the empty board to the game as it
 * ended. It is rebuilt from the ledger, so a game can be played back without a copy of every
 * step having been kept. The last moment is the game itself, which also covers anything an
 * older saved game's ledger did not record.
 */
export function replay(state: GameState): Moment[] {
  const explored = new Set(
    state.ledger.flatMap((entry) => (entry.kind === "explore" ? [entry.hex] : []))
  );
  const hexes = state.hexes.map((hex, index) => (explored.has(index) ? ({ type: "fog" } as Hex) : hex));
  const desert = hexes.findIndex((hex) => hex.type === "desert");
  let now: GameState = {
    ...state,
    hexes,
    players: state.players.map((player) => ({ ...player, extraPoints: 0 })),
    buildings: {},
    knights: {},
    roads: {},
    ships: [],
    robber: desert === -1 ? null : desert,
    pirate: null,
    metropolis: {},
    rolls: [],
    longestRoad: null,
    largestArmy: null,
    ledger: [],
  };

  const moments: Moment[] = [{ state: now }];
  state.ledger.forEach((entry, index) => {
    const { shown, ...moment } = after(now, entry, state);
    now = { ...moment.state, ledger: state.ledger.slice(0, index + 1) };
    if (shown) moments.push({ ...moment, state: now });
  });
  moments[moments.length - 1] = { state };
  return moments;
}
