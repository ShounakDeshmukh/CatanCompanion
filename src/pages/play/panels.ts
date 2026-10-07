import { HEX_LABEL } from "../../lib/hexBoard";
import { knightStrength } from "../../lib/cityKnights";
import { MAX_IMPROVEMENT, improvementLevel, wallCount } from "../../lib/expansionTracking";
import { startingCards } from "../../lib/gameSetup";
import {
  TRACKS,
  buildSpending,
  clothCollected,
  entryCost,
  knightsPlayed,
  playerPoints,
  productionTotals,
  roadLengths,
  type GameState,
  type LedgerEntry,
} from "../../lib/gameState";
import type { Edge, Vertex } from "../../lib/vertices";
import {
  AWARD_LABEL,
  KNIGHT_ACTION_TEXT,
  TOTALS,
  TRACK_LABEL,
  barbarianOutcome,
  elapsed,
  escapeHtml,
  payoutText,
  playerTag,
  takings,
  waysToRoll,
} from "./format";

/** The Play page's read-only panels. Each is drawn from the game alone, as a string. */

export function historyHtml(state: GameState, vertices: Vertex[]): string {
  const players = state.players;
  const byTurn = new Map<number, LedgerEntry[]>();
  for (const entry of state.ledger) {
    const entries = byTurn.get(entry.turn);
    if (entries) entries.push(entry);
    else byTurn.set(entry.turn, [entry]);
  }

  const hexName = (index: number) => {
    const hex = state.hexes[index];
    return `${HEX_LABEL[hex.type]}${hex.number === undefined ? "" : ` ${hex.number}`}`;
  };
  const line = (entry: LedgerEntry): string => {
    if (entry.kind === "award") {
      return entry.player === null
        ? `Nobody holds ${AWARD_LABEL[entry.award]}`
        : `${playerTag(players[entry.player])} takes ${AWARD_LABEL[entry.award]}`;
    }
    if (entry.kind === "barbarians") return barbarianOutcome(state, entry.defended, entry.players);
    if (entry.kind === "metropolis") {
      return entry.player === null
        ? `Nobody holds the ${TRACK_LABEL[entry.track]} metropolis`
        : `${playerTag(players[entry.player])} builds the ${TRACK_LABEL[entry.track]} metropolis`;
    }
    const who = playerTag(players[entry.player]);
    switch (entry.kind) {
      case "roll": {
        const roll = state.rolls[entry.roll];
        const collected = takings(state, roll.payouts, "takes");
        return `${who} rolls <strong>${roll.total}</strong>${collected.length > 0 ? `<ul>${collected.join("")}</ul>` : ""}`;
      }
      case "knight":
        return `${who} plays a Knight`;
      case "roadBuilding":
        return `${who} plays Road Building`;
      case "robber":
        return `${who} moves the robber to ${hexName(entry.hex)}`;
      case "explore":
        return `${who} explores ${hexName(entry.hex)}`;
      case "pillage":
        return `${who} loses a city to the barbarians`;
      case "troop":
        return `${who} ${KNIGHT_ACTION_TEXT[entry.action]}`;
      case "build":
        return entry.free ? `${who} places a ${entry.piece}` : `${who} builds a ${entry.piece}`;
      case "card":
        return `${who} buys a development card`;
      case "wall":
        return `${who} builds a city wall`;
      case "improve":
        return `${who} raises ${TRACK_LABEL[entry.track]} to level ${entry.level}`;
      case "pirate":
        return `${who} moves the pirate`;
    }
  };

  const groups: string[] = [];
  for (let turn = state.turn; turn >= -1; turn--) {
    const lines = (byTurn.get(turn) ?? []).map((entry) => {
      const cost = entryCost(entry);
      const paid = cost && Object.keys(cost).length > 0 ? ` <span class="play-muted">${payoutText(cost)}</span>` : "";
      return `<li>${line(entry)}${paid}</li>`;
    });
    if (turn === -1) {
      lines.push(...takings(state, startingCards(state, vertices), "starts with"));
      if (lines.length === 0) continue;
    }
    const heading =
      turn === -1 ? "Setup" : `Turn ${turn + 1} · ${playerTag(players[turn % players.length])}`;
    groups.push(
      `<h3>${heading}</h3><ul>${lines.join("") || `<li class="play-muted">Nothing yet.</li>`}</ul>`
    );
  }

  return `
    <h2>History <span class="play-muted">newest turn first</span></h2>
    <div class="play-history">${groups.join("")}</div>`;
}

export function scoresHtml(state: GameState, edges: Edge[]): string {
  const points = playerPoints(state);
  const built = state.players.map(() => 0);
  for (const building of Object.values(state.buildings)) {
    built[building.player] += building.kind === "city" ? 2 : 1;
  }
  const roads = roadLengths(state, edges);
  const knights = knightsPlayed(state);
  // Cities & Knights has no Largest Army
  const army = !state.citiesKnights;
  const troops = knightStrength(state);
  const cloth = clothCollected(state);
  const villages = state.hexes.some((hex) => hex.type === "village");
  const winner = points.findIndex((total) => total >= state.targetPoints);

  return `
    <h2>Scores <span class="play-muted">first to ${state.targetPoints}</span></h2>
    ${
      winner === -1
        ? ""
        : `<div class="play-alert">
            <p>${escapeHtml(state.players[winner].name)} has reached ${points[winner]} points.</p>
            <div class="play-actions"><button class="btn btn-secondary" data-action="end">Finish and record the game</button></div>
          </div>`
    }
    <div class="play-table-wrap">
      <table class="play-table play-table--scores">
        <thead>
          <tr><th>Player</th><th>Board</th><th>Road</th><th>${army ? "Army" : "Knights"}</th><th>Other</th><th>Pts</th></tr>
        </thead>
        <tbody>
          ${state.players
            .map(
              (player, i) => `
            <tr>
              <th scope="row">${playerTag(player)}</th>
              <td>${built[i]}</td>
              <td>
                <span class="play-award" data-held="${state.longestRoad === i}"
                  title="Longest unbroken road">${roads[i]}</span>
              </td>
              <td>${
                army
                  ? `<span class="play-award" data-held="${state.largestArmy === i}"
                      title="Knights played">${knights[i]}</span>`
                  : `<span title="Active strength of all knights">${troops.active[i]} of ${troops.total[i]}</span>`
              }</td>
              <td class="play-table__stepper">
                <button data-action="extra" data-value="${i}:-1" aria-label="Remove a point">-</button>
                <span>${player.extraPoints}</span>
                <button data-action="extra" data-value="${i}:1" aria-label="Add a point">+</button>
              </td>
              <td class="play-table__total">${points[i]}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <p class="play-muted">
      Road is each player's longest run${army ? " and Army their knights played" : ""}. A
      highlighted number holds the award for two points: five roads${army ? " or three knights" : ""}
      at least, and more than anyone else.
      ${army ? "" : "Knights is the strength awake out of all a player has on the board."}
      ${villages ? `Cloth so far: ${state.players.map((player, i) => `${escapeHtml(player.name)} ${cloth[i]}`).join(", ")}; every two are a point.` : ""}
      Use Other for victory point cards and island bonuses.
    </p>`;
}

/** Cities & Knights only: the improvements, walls and metropolises that sit off the board. */
export function cityHtml(state: GameState): string {
  const stepper = (action: string, key: string, value: number, held: boolean) => `
    <td class="play-table__stepper">
      <button data-action="${action}" data-value="${key}:-1" aria-label="One fewer">-</button>
      <span class="play-award" data-held="${held}">${value}</span>
      <button data-action="${action}" data-value="${key}:1" aria-label="One more">+</button>
    </td>`;
  return `
    <h2>City improvements <span class="play-muted">levels out of ${MAX_IMPROVEMENT}</span></h2>
    <div class="play-table-wrap">
      <table class="play-table">
        <thead>
          <tr><th>Player</th>${TRACKS.map((track) => `<th>${TRACK_LABEL[track]}</th>`).join("")}<th>Walls</th></tr>
        </thead>
        <tbody>
          ${state.players
            .map(
              (player, i) => `
            <tr>
              <th scope="row">${playerTag(player)}</th>
              ${TRACKS.map((track) =>
                stepper("improve", `${i}:${track}`, improvementLevel(state, i, track), state.metropolis[track] === i)
              ).join("")}
              ${stepper("wall", String(i), wallCount(state, i), false)}
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <p class="play-muted">
      A highlighted level holds that track's metropolis, worth two points and safe from the
      barbarians. Each level costs its own number in the track's commodity; a wall is two brick.
    </p>`;
}

export function statsHtml(state: GameState): string {
  const rolls = state.rolls.length;
  const counts = TOTALS.map((total) => state.rolls.filter((roll) => roll.total === total).length);
  const expected = TOTALS.map((total) => (rolls * waysToRoll(total)) / 36);
  const tallest = Math.max(1, ...counts, ...expected);
  const { received, expected: due } = productionTotals(state);
  const spent = buildSpending(state);

  return `
    <h2>Dice <span class="play-muted">${rolls} rolls · ${elapsed(state.startedAt)} played</span></h2>
    <div class="histogram" role="img" aria-label="How often each total has come up">
      ${TOTALS.map(
        (total, i) => `
        <div class="histogram__column">
          <div class="histogram__plot">
            <div class="histogram__bar" style="height: ${(counts[i] / tallest) * 100}%"></div>
            <div class="histogram__expected" style="bottom: ${(expected[i] / tallest) * 100}%"></div>
          </div>
          <span class="histogram__count">${counts[i]}</span>
          <span class="histogram__total">${total}</span>
        </div>`
      ).join("")}
    </div>
    <p class="play-muted">Bars are rolls so far; the line is what even dice would give.</p>
    <div class="play-table-wrap">
      <table class="play-table">
        <thead><tr><th>Player</th><th>Cards</th><th>Expected</th><th>Luck</th><th>Spent</th></tr></thead>
        <tbody>
          ${state.players
            .map((player, i) => {
              const luck = received[i] - due[i];
              return `
            <tr>
              <th scope="row">${playerTag(player)}</th>
              <td>${received[i]}</td>
              <td>${due[i].toFixed(1)}</td>
              <td class="play-table__total">${luck >= 0 ? "+" : ""}${luck.toFixed(1)}</td>
              <td>${spent[i]}</td>
            </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>`;
}
