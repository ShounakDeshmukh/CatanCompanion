import "../styles/theme.css";
import "../styles/board.css";
import "../styles/play.css";
import { renderNav } from "../lib/nav";
import { getBoardEntry, type BoardEntry } from "../data/boards/registry";
import type { CatanBoard, Hex, HexType, NumberChitValue } from "../data/boards/types";
import { RESOURCE_BY_HEX } from "../data/boards/types";
import { buildBoard } from "../lib/boardFactory";
import { HEX_LABEL, renderHexBoard } from "../lib/hexBoard";
import { shuffleInPlace } from "../lib/shuffle";
import { boardGeometry, type Edge } from "../lib/vertices";
import { clearGame, loadGame, loadUndo, saveGame, saveUndo } from "../lib/gameCodec";
import {
  MAX_IMPROVEMENT,
  buyDevelopmentCard,
  changeWalls,
  improvementLevel,
  lowerImprovement,
  movePirate,
  raiseImprovement,
  wallCount,
} from "../lib/expansionTracking";
import { clearRecords, loadRecords, saveRecord, summarize, type GameRecord } from "../lib/gameHistory";
import {
  hostRoom,
  newRoomId,
  qrSvg,
  watchRoom,
  watchUrl,
  watchedRoom,
  type Host,
  type Snapshot,
} from "../lib/share";
import {
  BARBARIAN_TRACK_LENGTH,
  PLAYER_COLORS,
  activateKnight,
  barbarianOutlook,
  barbarianPosition,
  barbariansAttacked,
  barbariansResolved,
  buildSpending,
  clothCollected,
  entryCost,
  TRACKS,
  cardPlayedThisTurn,
  currentPlayer,
  cycleBuilding,
  endTurn,
  facedownRemaining,
  hasRolled,
  knightCost,
  knightStrength,
  knightsPlayed,
  moveKnight,
  moveRobber,
  networkCorners,
  pairedPlayer,
  pendingPillage,
  pillageCity,
  placeSetupPiece,
  playKnight,
  playRoadBuilding,
  promoteKnight,
  recruitKnight,
  removeKnight,
  resolveBarbarians,
  playerPoints,
  productionTotals,
  recordRoll,
  revealHex,
  roadLengths,
  setLastEvent,
  setupTurn,
  standDownKnight,
  startingCards,
  toggleRoad,
  tooCloseToBuild,
  type Card,
  type EventDie,
  type GameState,
  type KnightAction,
  type LedgerEntry,
  type Payout,
  type Player,
  type PlayerColor,
  type Track,
} from "../lib/gameState";

renderNav("play");

const root = document.getElementById("play-root") as HTMLElement;

const CARD_LABEL: Record<Card, string> = {
  brick: "Brick",
  wood: "Wood",
  wool: "Sheep",
  wheat: "Wheat",
  ore: "Ore",
  choice: "of their choice",
  paper: "Paper",
  cloth: "Cloth",
  coin: "Coin",
};

const EVENT_LABEL: Record<EventDie, string> = {
  ship: "Ship",
  yellow: "Yellow gate",
  blue: "Blue gate",
  green: "Green gate",
};

type Mode = "build" | "road" | "ship" | "knight" | "robber" | "pirate";

const ZOOM_STEPS = [1, 1.6, 2.4];
const TRACK_LABEL: Record<Track, string> = { science: "Science", trade: "Trade", politics: "Politics" };

const MODE_LABEL: Record<Mode, string> = {
  build: "Settlements",
  road: "Roads",
  ship: "Ships",
  knight: "Knights",
  robber: "Robber",
  pirate: "Pirate",
};

const KNIGHT_RANK = ["Basic", "Strong", "Mighty"] as const;

const KNIGHT_ACTION_TEXT: Record<KnightAction, string> = {
  recruit: "recruits a knight",
  promote: "promotes a knight",
  activate: "activates a knight",
  move: "moves a knight",
  chase: "chases the robber off with a knight",
};

const AWARD_LABEL = { longestRoad: "Longest Road", largestArmy: "Largest Army" } as const;

const SETUP_HINT = {
  settlement: "Tap a corner on the board. Placing runs round the table, then back again.",
  city: "Tap a corner on the board. This one earns a card from each terrain hex it touches.",
  road: "Tap a side next to the building just placed.",
} as const;

const SHIP_SETUP_HINT = "Pick Roads or Ships, then tap a side next to the building just placed.";

const MODE_HINT: Record<Mode, string> = {
  build: "Tap a corner to place a settlement. Tap again for a city, and once more to remove it.",
  road: "Tap a hex side to lay a road. Tap it again to remove it.",
  ship: "Tap a hex side on the water to launch a ship. Tap it again to remove it.",
  knight: "Tap a corner on your road to recruit a knight, or tap a knight for what it can do.",
  robber: "Tap the hex the robber moves to.",
  pirate: "Tap the sea hex the pirate sails to.",
};

const EVENT_FACES: EventDie[] = ["ship", "ship", "ship", "yellow", "blue", "green"];
const TOTALS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const waysToRoll = (total: number) => 6 - Math.abs(7 - total);
const rollDie = () => 1 + Math.floor(Math.random() * 6);

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string
  );
}

const drawnHtml = new WeakMap<HTMLElement, string>();

/**
 * Replaces an element's markup only when it has actually changed. Most taps alter one or two
 * panels, and leaving the rest alone also keeps the history list scrolled where it was.
 */
function setHtml(element: HTMLElement, html: string): void {
  if (drawnHtml.get(element) === html) return;
  drawnHtml.set(element, html);
  element.innerHTML = html;
}

function playerTag(player: Pick<Player, "name" | "color">): string {
  return `<span class="player-dot" style="--player-color: var(--player-${player.color})"></span>${escapeHtml(player.name)}`;
}

function payoutText(payout: Payout): string {
  return (Object.entries(payout) as [Card, number][])
    .map(([card, count]) => `${count} ${CARD_LABEL[card]}`)
    .join(", ");
}

function elapsed(since: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - since) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Phones dim and lock between turns, which is the quickest way to stop anyone using this. */
function keepScreenAwake(): void {
  const request = () => {
    // rejects when the page is hidden or the device is saving power; nothing to do about either
    navigator.wakeLock?.request("screen").catch(() => undefined);
  };
  request();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") request();
  });
}

function recordHtml(record: GameRecord, open: boolean): string {
  const [winner] = record.players;
  const minutes = Math.max(1, Math.round((record.endedAt - record.startedAt) / 60000));
  const mostRolled = record.rolls.indexOf(Math.max(...record.rolls)) + 2;
  return `
    <details class="play-record" ${open ? "open" : ""}>
      <summary>
        ${playerTag(winner)} won with ${winner.points}
        <span class="play-muted">${new Date(record.endedAt).toLocaleDateString()} · ${escapeHtml(record.board)}</span>
      </summary>
      <div class="play-table-wrap">
        <table class="play-table">
          <thead><tr><th>Player</th><th>Points</th><th>Cards</th><th>Luck</th></tr></thead>
          <tbody>
            ${record.players
              .map(
                (player) => `
              <tr>
                <th scope="row">${playerTag(player)}</th>
                <td class="play-table__total">${player.points}</td>
                <td>${player.cards}</td>
                <td>${player.luck >= 0 ? "+" : ""}${player.luck.toFixed(1)}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="play-muted">${record.turns} turns in about ${minutes} min, first to ${record.target}.
        ${record.turns > 0 ? `The dice favoured ${mostRolled}, rolled ${record.rolls[mostRolled - 2]} times.` : ""}</p>
    </details>`;
}

function renderEmpty(): void {
  const records = loadRecords();
  root.innerHTML = `
    <section class="card play-empty">
      <h2>No game in progress</h2>
      <p>Pick a board, lay it out on the table, then press <strong>Start game</strong>.</p>
      <a class="btn" href="./map-generator.html">Choose a board</a>
    </section>
    ${
      records.length === 0
        ? ""
        : `<section class="card play-empty">
            <h2>Past games</h2>
            ${records.map((record, index) => recordHtml(record, index === 0)).join("")}
            <button class="play-link" id="play-clear-records">Clear past games</button>
          </section>`
    }`;
  document.getElementById("play-clear-records")?.addEventListener("click", () => {
    if (!confirm("Remove the record of every past game on this device?")) return;
    clearRecords();
    renderEmpty();
  });
}

function renderSetup(game: GameState, entry: BoardEntry, board: CatanBoard): void {
  const [minPlayers, maxPlayers] = entry.players;
  const seats = minPlayers === maxPlayers ? `${minPlayers}` : `${minPlayers} to ${maxPlayers}`;
  const defaultsToCitiesKnights = game.boardId.startsWith("ck");
  root.innerHTML = `
    <form class="card play-setup" id="play-setup">
      <h2>Who is playing?</h2>
      <p class="play-muted">${escapeHtml(entry.label)} is set up for ${seats} players.</p>
      <div class="play-setup__players"></div>
      <div class="play-chips" ${minPlayers === maxPlayers ? "hidden" : ""}>
        <button class="play-chip" type="button" data-players="add">Add player</button>
        <button class="play-chip" type="button" data-players="remove">Remove player</button>
      </div>
      <label class="play-setup__option">
        <input type="checkbox" name="shuffle" checked /> Randomise turn order
      </label>
      <label class="play-setup__option">
        <input type="checkbox" name="citiesKnights" ${defaultsToCitiesKnights ? "checked" : ""} />
        Cities &amp; Knights (commodities and barbarians)
      </label>
      <label class="play-setup__option">
        Points to win
        <input type="number" name="target" min="3" max="30"
          value="${defaultsToCitiesKnights ? 13 : 10}" />
      </label>
      <button class="btn" type="submit">Start</button>
    </form>`;

  const form = root.querySelector("form") as HTMLFormElement;
  const target = form.elements.namedItem("target") as HTMLInputElement;
  const citiesKnights = form.elements.namedItem("citiesKnights") as HTMLInputElement;
  citiesKnights.addEventListener("change", () => {
    target.value = citiesKnights.checked ? "13" : "10";
  });

  const rows = form.querySelector(".play-setup__players") as HTMLElement;
  const addButton = form.querySelector("[data-players=add]") as HTMLButtonElement;
  const removeButton = form.querySelector("[data-players=remove]") as HTMLButtonElement;
  const nameInputs = () => [...rows.querySelectorAll<HTMLInputElement>("input")];

  const colorSelects = () => [...rows.querySelectorAll<HTMLSelectElement>("select")];

  function paintDot(select: HTMLSelectElement): void {
    const dot = select.previousElementSibling as HTMLElement;
    dot.style.setProperty("--player-color", `var(--player-${select.value})`);
    select.dataset.shown = select.value;
  }

  function addPlayerRow(): void {
    const seat = rows.childElementCount;
    const taken = new Set(colorSelects().map((select) => select.value));
    const free = PLAYER_COLORS.find((color) => !taken.has(color));
    rows.insertAdjacentHTML(
      "beforeend",
      `<div class="play-setup__player">
        <span class="player-dot"></span>
        <select aria-label="Player ${seat + 1} colour">
          ${PLAYER_COLORS.map(
            (color) =>
              `<option value="${color}"${color === free ? " selected" : ""}>${color[0].toUpperCase()}${color.slice(1)}</option>`
          ).join("")}
        </select>
        <input type="text" maxlength="16" autocomplete="off" placeholder="Player ${seat + 1}"
          aria-label="Player ${seat + 1} name" />
      </div>`
    );
    paintDot(colorSelects()[seat]);
  }

  // two players cannot share a colour, so picking one that is taken swaps the two over
  rows.addEventListener("change", (event) => {
    const changed = event.target as HTMLSelectElement;
    if (changed.tagName !== "SELECT") return;
    const clash = colorSelects().find((other) => other !== changed && other.value === changed.value);
    if (clash) {
      clash.value = changed.dataset.shown as string;
      paintDot(clash);
    }
    paintDot(changed);
  });

  function syncPlayerButtons(): void {
    addButton.disabled = rows.childElementCount >= maxPlayers;
    removeButton.disabled = rows.childElementCount <= minPlayers;
  }

  for (let seat = 0; seat < minPlayers; seat++) addPlayerRow();
  syncPlayerButtons();
  addButton.addEventListener("click", () => {
    addPlayerRow();
    syncPlayerButtons();
    nameInputs().at(-1)?.focus();
  });
  removeButton.addEventListener("click", () => {
    rows.lastElementChild?.remove();
    syncPlayerButtons();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    // a row left blank still means a player, so it takes the name its placeholder shows
    const colors = colorSelects();
    const players: Player[] = nameInputs().map((input, seat) => ({
      name: input.value.trim() || input.placeholder,
      color: colors[seat].value as PlayerColor,
      extraPoints: 0,
    }));
    if ((form.elements.namedItem("shuffle") as HTMLInputElement).checked) {
      shuffleInPlace(players, Math.random);
    }

    const started: GameState = {
      ...game,
      players,
      citiesKnights: citiesKnights.checked,
      targetPoints: Number(target.value) || 10,
      startedAt: Date.now(),
    };
    saveGame(started);
    runGame(started, board);
  });
}

/**
 * Draws a game and, unless `viewing`, lets it be played. Returns a way to replace what is
 * shown, which is how a viewer's page follows the host.
 */
function runGame(
  initial: GameState,
  board: CatanBoard,
  viewing: boolean = false
): (snapshot: Snapshot) => void {
  let state = initial;
  let builder = currentPlayer(state);
  let mode: Mode = "build";
  /** The two faces behind the last total, when the app rolled it. */
  let dice: [number, number] | undefined;
  let boardStale = true;
  let pieceLayer: HTMLElement | undefined;
  /** The fog hex being turned over, and the terrain picked for it while its disc is chosen. */
  let revealing: { index: number; type?: HexType } | undefined;
  /** Who is moving the robber when it was a knight that sent it, not a seven. */
  let robberMover: number | undefined;
  /** The corner of the knight whose menu is open, and of one picked up to be moved. */
  let knightMenu: string | undefined;
  let movingKnight: string | undefined;
  let zoom = 0;
  const undoStack = viewing ? [] : loadUndo(initial);
  let host: Host | undefined;
  let viewers = 0;
  let shareError = "";

  const layout = board.recommendedLayout;
  const { vertices, edges } = boardGeometry(board);
  // fog may turn out to be land, so only open sea is ruled out
  const touchesLand = (hexes: number[]) => hexes.some((index) => layout[index].type !== "sea");
  const buildable = vertices.filter((vertex) => touchesLand(vertex.hexes));
  // ships cross open water, so Seafarers maps keep every hex side
  const seafaring = state.boardId.startsWith("sf");
  const roadSites = edges.filter((edge) => seafaring || touchesLand(edge.hexes));

  root.classList.toggle("play--viewing", viewing);
  root.innerHTML = `
    ${viewing ? `<p class="play-watching">Watching along · <span id="play-watch-status">Live</span></p>` : ""}
    <section class="card play-turn" id="play-turn"></section>
    <div class="play-toolbar" id="play-toolbar"></div>
    <div class="play-board-scroll" id="play-board-scroll"><div id="play-board"></div></div>
    <section class="card" id="play-scores"></section>
    <section class="card" id="play-city" hidden></section>
    <section class="card" id="play-stats"></section>
    <section class="card" id="play-history"></section>
    <section class="card" id="play-share"></section>
    <dialog class="play-reveal" id="play-reveal"></dialog>
    <dialog class="play-reveal" id="play-knight"></dialog>
    <p class="play-end"><button class="btn btn-secondary" data-action="end">End game</button></p>`;
  const turnEl = root.querySelector("#play-turn") as HTMLElement;
  const toolbarEl = root.querySelector("#play-toolbar") as HTMLElement;
  const boardEl = root.querySelector("#play-board") as HTMLElement;
  const boardScrollEl = root.querySelector("#play-board-scroll") as HTMLElement;
  const scoresEl = root.querySelector("#play-scores") as HTMLElement;
  const cityEl = root.querySelector("#play-city") as HTMLElement;
  const boardLabel = getBoardEntry(state.boardId)?.label ?? state.boardId;
  const statsEl = root.querySelector("#play-stats") as HTMLElement;
  const historyEl = root.querySelector("#play-history") as HTMLElement;
  const shareEl = root.querySelector("#play-share") as HTMLElement;
  const revealEl = root.querySelector("#play-reveal") as HTMLDialogElement;
  const knightEl = root.querySelector("#play-knight") as HTMLDialogElement;

  const takings = (payouts: Payout[], verb: string): string[] =>
    payouts.flatMap((payout, i) =>
      Object.keys(payout).length > 0
        ? [`<li>${playerTag(state.players[i])} ${verb} <strong>${payoutText(payout)}</strong></li>`]
        : []
    );

  const nameList = (seats: number[]) =>
    seats.map((seat) => escapeHtml(state.players[seat].name)).join(" and ");

  function barbarianOutcome(defended: boolean, seats: number[]): string {
    if (!defended) return `The barbarians win. ${nameList(seats)} ${seats.length === 1 ? "loses" : "each lose"} a city.`;
    if (seats.length === 0) return "Catan holds, though no knight was awake to defend it.";
    return seats.length === 1
      ? `Catan holds. ${nameList(seats)} is Defender of Catan and takes a victory point.`
      : `Catan holds. ${nameList(seats)} tie as defenders and each take a progress card.`;
  }

  function barbarianHtml(): string {
    if (barbariansResolved(state)) {
      const owing = pendingPillage(state);
      return owing.length > 0
        ? `<p class="play-alert">${nameList(owing)}: tap the city the barbarians take.</p>`
        : "";
    }
    const { cities, strength, defended, players } = barbarianOutlook(state);
    const knights = strength.reduce((sum, level) => sum + level, 0);
    return `
      <div class="play-alert">
        <p><strong>The barbarians attack.</strong> ${cities} ${cities === 1 ? "city" : "cities"}
          against ${knights} in active knights
          (${state.players.map((player, seat) => `${escapeHtml(player.name)} ${strength[seat]}`).join(", ")}).</p>
        <p>${barbarianOutcome(defended, players)}</p>
        <div class="play-actions">
          <button class="btn btn-secondary" data-action="barbarians">Resolve the attack</button>
        </div>
      </div>`;
  }

  function turnHtml(): string {
    const players = state.players;
    const opening = takings(startingCards(state, vertices), "starts with");
    const openingHtml = opening.length > 0 ? `<ul class="play-payouts">${opening.join("")}</ul>` : "";
    const undo = `<button class="play-link" data-action="undo" ${undoStack.length > 0 ? "" : "disabled"}>Undo</button>`;

    const setup = setupTurn(state);
    if (setup && state.setup) {
      const article = setup.piece === "road" ? "a road" : `a ${setup.piece}`;
      return `
        <header class="play-turn__head">
          <h2>${playerTag(players[setup.player])} places ${article}</h2>
          <span class="play-muted">Setup · ${state.setup.length} of ${players.length * 4} placed</span>
        </header>
        <p class="play-muted">${setup.piece === "road" && seafaring ? SHIP_SETUP_HINT : SETUP_HINT[setup.piece]}</p>
        ${openingHtml}
        ${undo}`;
    }

    const turnPlayer = currentPlayer(state);
    const player = players[turnPlayer];
    const rolled = hasRolled(state);
    const last = rolled ? state.rolls.at(-1) : undefined;
    const header = `
      <header class="play-turn__head">
        <h2>${playerTag(player)}'s turn</h2>
        <span class="play-muted">Turn ${state.turn + 1} · <span id="play-timer">${elapsed(state.turnStartedAt)}</span></span>
      </header>`;

    // Cities & Knights has no knight cards; its knights are pieces on the board
    const owed = state.freeRoads;
    // one development card a turn in the base game; progress cards have no such limit
    const spent = !state.citiesKnights && cardPlayedThisTurn(state) ? "disabled" : "";
    const cards = `
      <div class="play-chips play-actions">
        <span class="play-label">${escapeHtml(player.name)} plays</span>
        ${state.citiesKnights ? "" : `<button class="play-chip" data-action="knight" ${spent}>Knight</button>`}
        <button class="play-chip" data-action="road-building" ${spent}>Road Building</button>
        ${spent ? `<span class="play-muted">One card a turn</span>` : ""}
      </div>
      ${
        owed
          ? `<p class="play-paired">${playerTag(players[owed.player])} has ${owed.left} free ${owed.left === 1 ? "road" : "roads"} to lay.</p>`
          : ""
      }`;

    let citiesKnights = "";
    if (state.citiesKnights) {
      const eventButtons = (Object.keys(EVENT_LABEL) as EventDie[])
        .map(
          (event) =>
            `<button class="play-chip play-chip--${event}" data-action="event" data-value="${event}"
              aria-pressed="${last?.event === event}">${EVENT_LABEL[event]}</button>`
        )
        .join("");
      citiesKnights = `
        ${last ? `<div class="play-chips"><span class="play-label">Event die</span>${eventButtons}</div>` : ""}
        ${last && barbariansAttacked(state) ? barbarianHtml() : ""}
        <p class="play-muted">Barbarians: ${barbarianPosition(state)} of ${BARBARIAN_TRACK_LENGTH} steps</p>`;
    }

    if (!last) {
      return `
        ${header}
        ${state.turn === 0 ? openingHtml : ""}
        <p class="play-muted">Tap the number rolled.</p>
        <div class="play-pad">
          ${TOTALS.map(
            (total) =>
              `<button class="play-pad__key${total === 7 ? " play-pad__key--seven" : ""}" data-action="roll" data-value="${total}">${total}</button>`
          ).join("")}
          <button class="play-pad__key play-pad__key--wide" data-action="virtual">Roll for us</button>
        </div>
        ${citiesKnights}
        ${cards}
        ${undo}`;
    }

    const shown = dice ? `${dice[0]} + ${dice[1]} = ${last.total}` : String(last.total);
    const collecting = takings(last.payouts, "takes");
    let detail: string;
    if (last.total === 7) {
      detail = `<p>Anyone holding more than seven cards discards half. ${escapeHtml(player.name)} moves the robber${seafaring ? ", or the pirate from the Placing row" : ""}: tap its new hex.</p>`;
    } else if (collecting.length > 0) {
      detail = `<ul class="play-payouts">${collecting.join("")}</ul>`;
    } else {
      detail = `<p class="play-muted">Nobody collects.</p>`;
    }
    const paired = pairedPlayer(state, turnPlayer);
    const next = players[(turnPlayer + 1) % players.length];

    return `
      ${header}
      <div class="play-result" aria-live="polite">
        <p class="play-rolled">Rolled <strong class="play-rolled__total">${shown}</strong></p>
        ${detail}
        ${
          paired === null
            ? ""
            : `<p class="play-paired">${playerTag(players[paired])} is the paired player: may build and trade with the supply, but not with other players.</p>`
        }
        ${citiesKnights}
      </div>
      ${cards}
      <div class="play-actions play-next">
        <button class="btn" data-action="next">Next player: ${escapeHtml(next.name)}</button>
      </div>
      ${undo}`;
  }

  /** During the opening placements the app decides what goes down next; later the toolbar does. */
  function placingMode(): Mode {
    const setup = setupTurn(state);
    if (!setup) return mode;
    if (setup.piece !== "road") return "build";
    return mode === "ship" ? "ship" : "road";
  }

  /** A road needs land on one side of it and a ship needs water. Fog may yet be either. */
  function sideSuits(edge: Edge, ship: boolean): boolean {
    return edge.hexes.some((index) => {
      const type = state.hexes[index].type;
      return type === "fog" || (type === "sea") === ship;
    });
  }

  function historyHtml(): string {
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
      if (entry.kind === "barbarians") return barbarianOutcome(entry.defended, entry.players);
      if (entry.kind === "metropolis") {
        return entry.player === null
          ? `Nobody holds the ${TRACK_LABEL[entry.track]} metropolis`
          : `${playerTag(players[entry.player])} builds the ${TRACK_LABEL[entry.track]} metropolis`;
      }
      const who = playerTag(players[entry.player]);
      switch (entry.kind) {
        case "roll": {
          const roll = state.rolls[entry.roll];
          const collected = takings(roll.payouts, "takes");
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
        lines.push(...takings(startingCards(state, vertices), "starts with"));
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

  function toolbarHtml(): string {
    const modeChips = (options: Mode[]) => `
      <div class="play-chips">
        <span class="play-label">Placing</span>
        ${options
          .map(
            (option) =>
              `<button class="play-chip" data-action="mode" data-value="${option}"
                aria-pressed="${option === placingMode()}">${MODE_LABEL[option]}</button>`
          )
          .join("")}
      </div>`;

    // the opening placements are in a fixed order, so the only choice is road or ship
    const setup = setupTurn(state);
    if (setup) return setup.piece === "road" && seafaring ? modeChips(["road", "ship"]) : "";
    return `
      <div class="play-chips">
        <span class="play-label">Building as</span>
        ${state.players
          .map(
            (player, i) =>
              `<button class="play-chip" data-action="builder" data-value="${i}"
                aria-pressed="${i === builder}">${playerTag(player)}</button>`
          )
          .join("")}
      </div>
      ${modeChips(
        (Object.keys(MODE_LABEL) as Mode[]).filter(
          (option) =>
            (option !== "ship" || seafaring) &&
            (option !== "pirate" || seafaring) &&
            (option !== "knight" || state.citiesKnights)
        )
      )}
      <div class="play-chips">
        ${state.citiesKnights ? "" : `<button class="play-chip" data-action="buy-card">Buy development card</button>`}
        <button class="play-chip" data-action="zoom">Zoom ${ZOOM_STEPS[zoom] === 1 ? "in" : `${ZOOM_STEPS[zoom]}x`}</button>
      </div>
      <p class="play-muted">${movingKnight ? "Tap the corner the knight moves to." : MODE_HINT[mode]}</p>`;
  }

  function scoresHtml(): string {
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
  function cityHtml(): string {
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

  function statsHtml(): string {
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

  function render(): void {
    if (boardStale || !pieceLayer) {
      renderHexBoard(boardEl, board, state.hexes, state.robber ?? -1, state.pirate ?? -1);
      boardEl.style.width = `${ZOOM_STEPS[zoom] * 100}%`;
      boardEl.style.maxWidth = zoom === 0 ? "" : "none";
      pieceLayer = document.createElement("div");
      pieceLayer.className = "piece-layer";
      (boardEl.querySelector(".hex-board") as HTMLElement).appendChild(pieceLayer);
      boardStale = false;
    }
    // only sites that are legal right now get a marker: during the opening placements the
    // app decides what goes down next, afterwards the toolbar does
    const setup = setupTurn(state);
    // a viewer places nothing, so only the pieces already down are drawn
    const placing = viewing ? "view" : placingMode();
    const layingShip = placing === "ship";
    const layingSide = placing === "road" || layingShip;
    boardEl.dataset.mode = placing;

    let cornerOpen: (corner: string) => boolean;
    let sideOpen: (ends: [string, string]) => boolean;
    if (setup) {
      const justBuilt = state.setup?.at(-1) as string;
      cornerOpen = () => true;
      sideOpen = (ends) => ends.includes(justBuilt);
    } else {
      // a settlement can go at the end of a road or a ship, but a road only continues roads.
      // A knight being moved stays on its owner's roads, whoever is selected as building.
      const owner = movingKnight ? state.knights[movingKnight].player : builder;
      const network = networkCorners(state, edges, owner, layingSide ? layingShip : undefined);
      cornerOpen = (corner) => network.has(corner);
      sideOpen = (ends) => ends.some((end) => network.has(end));
    }

    const ships = new Set(state.ships);
    const roadHtml = roadSites
      .filter(
        (edge) =>
          state.roads[edge.id] !== undefined ||
          (layingSide && sideOpen(edge.ends) && sideSuits(edge, layingShip))
      )
      .map((edge) => {
        const owner = state.players[state.roads[edge.id]];
        const piece = ships.has(edge.id) ? "ship" : "road";
        const label = owner ? `${owner.name}'s ${piece}` : "Empty hex side";
        return `<button class="edge${owner ? ` edge--${piece}` : ""}"
          data-action="road" data-value="${edge.id}" aria-label="${escapeHtml(label)}"
          style="left: ${edge.x * 100}%; top: ${edge.y * 100}%; --edge-angle: ${edge.angle}deg;${
            owner ? ` --player-color: var(--player-${owner.color})` : ""
          }"></button>`;
      })
      .join("");

    // Seafarers maps are drawn turned a quarter, so a knight's number is turned back
    const upright = board.horizontal ? ` style="transform: rotate(-90deg)"` : "";
    const cornerHtml = buildable
      .map((vertex) => {
        const at = `left: ${vertex.x * 100}%; top: ${vertex.y * 100}%;`;
        const color = (seat: number) => ` --player-color: var(--player-${state.players[seat].color})`;
        const building = state.buildings[vertex.id];
        if (building) {
          const label = `${state.players[building.player].name}'s ${building.kind}`;
          return `<button class="vertex vertex--${building.kind}" data-action="build"
            data-value="${vertex.id}" aria-label="${escapeHtml(label)}"
            style="${at}${color(building.player)}"></button>`;
        }
        const knight = state.knights[vertex.id];
        if (knight) {
          const label = `${state.players[knight.player].name}'s ${knight.active ? "active" : "inactive"} ${KNIGHT_RANK[knight.level - 1].toLowerCase()} knight`;
          return `<button class="vertex vertex--knight" data-action="knight-menu"
            data-value="${vertex.id}" data-active="${knight.active}" aria-label="${escapeHtml(label)}"
            style="${at}${color(knight.player)}"><span${upright}>${knight.level}</span></button>`;
        }
        const open =
          (placing === "build" || placing === "knight") &&
          cornerOpen(vertex.id) &&
          (placing === "knight" || !tooCloseToBuild(state, edges, vertex.id));
        return open
          ? `<button class="vertex vertex--open" data-value="${vertex.id}" aria-label="Empty corner"
              data-action="${placing === "knight" ? "knight-site" : "build"}" style="${at}"></button>`
          : "";
      })
      .join("");

    setHtml(pieceLayer, roadHtml + cornerHtml);
    setHtml(turnEl, turnHtml());
    setHtml(toolbarEl, toolbarHtml());
    setHtml(scoresEl, scoresHtml());
    cityEl.hidden = !state.citiesKnights;
    if (state.citiesKnights) setHtml(cityEl, cityHtml());
    setHtml(statsEl, statsHtml());
    setHtml(historyEl, historyHtml());
  }

  function show(next: GameState): void {
    state = next;
    saveGame(state);
    host?.send({ state, dice });
    render();
  }

  /** Applies a change to the game, keeping what came before so it can be undone. */
  function commit(next: GameState): void {
    undoStack.push(state);
    saveUndo(undoStack);
    show(next);
  }

  /** Redrawn only when sharing itself changes, so the QR code is not rebuilt on every tap. */
  async function renderShare(): Promise<void> {
    if (viewing) {
      shareEl.hidden = true;
      return;
    }
    if (!state.room) {
      shareEl.innerHTML = `
        <h2>Watch along</h2>
        <p class="play-muted">Let the table follow this game on their own phones. It connects
          phone to phone, and works best when everyone is on the same wifi.</p>
        <button class="btn btn-secondary" data-action="share">Share with viewers</button>`;
      return;
    }
    const url = watchUrl(state.room);
    shareEl.innerHTML = `
      <h2>Watch along <span class="play-muted">${viewers} watching</span></h2>
      ${shareError ? `<p class="play-alert">${shareError}</p>` : ""}
      <div class="play-share">
        <div class="play-share__code">${await qrSvg(url)}</div>
        <div>
          <p class="play-muted">Scan the code, or send the link. Keep this page open: viewers
            pause while this phone is locked.</p>
          <input class="play-share__link" type="text" readonly value="${url}"
            aria-label="Link for viewers" />
          <div class="play-chips">
            <button class="play-chip" data-action="share-copy">Copy link</button>
            <button class="play-chip" data-action="share-stop">Stop sharing</button>
          </div>
        </div>
      </div>`;
  }

  async function startHosting(room: string): Promise<void> {
    host = await hostRoom(
      room,
      () => ({ state, dice }),
      (count, error) => {
        viewers = count;
        shareError = error ?? "";
        void renderShare();
      }
    );
  }

  function roll(total: number, event?: EventDie): void {
    builder = currentPlayer(state);
    robberMover = undefined;
    if (total === 7) mode = "robber";
    commit(recordRoll(state, vertices, total, event, undefined, edges));
  }

  /** The facedown stack as it stands, with the hex being edited put back so it can be re-picked. */
  function stackForReveal(index: number) {
    if (!board.facedownStack) return undefined;
    const others = state.hexes.map((hex, i) => (i === index ? layout[i] : hex));
    return facedownRemaining(board.facedownStack, layout, others);
  }

  function renderReveal(): void {
    if (!revealing) return;
    const stack = stackForReveal(revealing.index);
    if (!stack) return;

    const option = (action: string, value: string | number, label: string, left: number) =>
      `<button class="play-chip" data-action="${action}" data-value="${value}">${label}
        <span class="play-reveal__left">${left} left</span></button>`;
    const picked = revealing.type;
    const choices = picked
      ? (Object.entries(stack.chits) as [string, number][])
          .filter(([, left]) => left > 0)
          .map(([value, left]) => option("reveal-number", value, value, left))
      : (Object.entries(stack.terrain) as [HexType, number][])
          .filter(([, left]) => left > 0)
          .map(([type, left]) => option("reveal-terrain", type, HEX_LABEL[type], left));

    revealEl.innerHTML = `
      <h2>${picked ? `${HEX_LABEL[picked]}: which number disc?` : "What was turned over?"}</h2>
      <div class="play-chips">${choices.join("")}</div>
      <p class="play-muted">Whoever explored a terrain hex takes one card of it as a reward.</p>
      <div class="play-chips">
        ${state.hexes[revealing.index].type === "fog" ? "" : `<button class="play-chip" data-action="reveal-terrain" data-value="fog">Turn back to fog</button>`}
        <button class="play-chip" data-action="reveal-cancel">Cancel</button>
      </div>`;
    if (!revealEl.open) revealEl.showModal();
  }

  function renderKnightMenu(): void {
    const knight = knightMenu === undefined ? undefined : state.knights[knightMenu];
    if (!knight) return;
    const option = (value: string, label: string, cost?: KnightAction) =>
      `<button class="play-chip" data-action="knight-do" data-value="${value}">${label}
        ${cost ? `<span class="play-reveal__left">${payoutText(knightCost(cost))}</span>` : ""}</button>`;
    knightEl.innerHTML = `
      <h2>${playerTag(state.players[knight.player])}'s ${KNIGHT_RANK[knight.level - 1].toLowerCase()} knight</h2>
      <p class="play-muted">${knight.active ? "Active" : "Inactive"}, strength ${knight.level}.</p>
      <div class="play-chips">
        ${knight.active ? "" : option("activate", "Activate", "activate")}
        ${knight.level < 3 ? option("promote", "Promote", "promote") : ""}
        ${knight.active ? option("move", "Move") + option("chase", "Chase the robber") + option("rest", "Set inactive") : ""}
      </div>
      <div class="play-chips">
        ${option("remove", "Take off the board")}
        <button class="play-chip" data-action="knight-cancel">Cancel</button>
      </div>`;
    if (!knightEl.open) knightEl.showModal();
  }

  function finishReveal(hex: Hex): void {
    if (!revealing) return;
    const { index } = revealing;
    revealing = undefined;
    revealEl.close();
    boardStale = true;
    commit(revealHex(state, index, hex));
  }

  const actions: Record<string, (value: string) => void> = {
    roll: (value) => {
      dice = undefined;
      roll(Number(value));
    },
    virtual: () => {
      dice = [rollDie(), rollDie()];
      roll(dice[0] + dice[1], state.citiesKnights ? EVENT_FACES[rollDie() - 1] : undefined);
    },
    event: (value) => commit(setLastEvent(state, value as EventDie)),
    next: () => {
      const next = endTurn(state);
      dice = undefined;
      mode = "build";
      robberMover = undefined;
      builder = currentPlayer(next);
      commit(next);
    },
    knight: () => {
      robberMover = currentPlayer(state);
      mode = "robber";
      commit(playKnight(state, robberMover));
    },
    "road-building": () => {
      builder = currentPlayer(state);
      if (mode !== "ship") mode = "road";
      commit(playRoadBuilding(state, builder));
    },
    undo: () => {
      const previous = undoStack.pop();
      if (!previous) return;
      saveUndo(undoStack);
      dice = undefined;
      mode = "build";
      robberMover = undefined;
      movingKnight = undefined;
      boardStale = true;
      builder = currentPlayer(previous);
      // sharing is not part of the game, so stepping back must not switch it off
      show({ ...previous, room: state.room });
    },
    builder: (value) => {
      builder = Number(value);
      render();
    },
    mode: (value) => {
      mode = value as Mode;
      movingKnight = undefined;
      render();
    },
    // pieces already down are left alone during setup; Undo takes them back
    build: (value) => {
      const building = state.buildings[value];
      if (setupTurn(state)) {
        if (!building) commit(placeSetupPiece(state, edges, value));
      } else if (building?.kind === "city" && pendingPillage(state).includes(building.player)) {
        commit(pillageCity(state, value));
      } else {
        commit(cycleBuilding(state, edges, value, builder));
      }
    },
    "knight-site": (value) => {
      const moving = movingKnight;
      movingKnight = undefined;
      commit(
        moving
          ? moveKnight(state, edges, moving, value)
          : recruitKnight(state, edges, value, builder)
      );
    },
    "knight-menu": (value) => {
      knightMenu = value;
      renderKnightMenu();
    },
    "knight-do": (value) => {
      const corner = knightMenu;
      knightEl.close();
      if (!corner) return;
      const owner = state.knights[corner].player;
      if (value === "activate") commit(activateKnight(state, corner));
      else if (value === "promote") commit(promoteKnight(state, corner));
      else if (value === "rest") commit(standDownKnight(state, corner));
      else if (value === "remove") commit(removeKnight(state, edges, corner));
      else if (value === "chase") {
        robberMover = owner;
        mode = "robber";
        commit(standDownKnight(state, corner, true));
      } else if (value === "move") {
        movingKnight = corner;
        mode = "knight";
        render();
      }
    },
    barbarians: () => commit(resolveBarbarians(state)),
    "buy-card": () => commit(buyDevelopmentCard(state, builder)),
    improve: (value) => {
      const [seat, track, change] = value.split(":");
      const act = change === "1" ? raiseImprovement : lowerImprovement;
      commit(act(state, Number(seat), track as Track));
    },
    wall: (value) => {
      const [seat, change] = value.split(":").map(Number);
      commit(changeWalls(state, seat, change === 1 ? 1 : -1));
    },
    zoom: () => {
      // keep whatever is in the middle of the view in the middle after the board changes size
      const centre = (boardScrollEl.scrollLeft + boardScrollEl.clientWidth / 2) / boardScrollEl.scrollWidth;
      const middle = (boardScrollEl.scrollTop + boardScrollEl.clientHeight / 2) / boardScrollEl.scrollHeight;
      zoom = (zoom + 1) % ZOOM_STEPS.length;
      boardStale = true;
      render();
      boardScrollEl.scrollLeft = centre * boardScrollEl.scrollWidth - boardScrollEl.clientWidth / 2;
      boardScrollEl.scrollTop = middle * boardScrollEl.scrollHeight - boardScrollEl.clientHeight / 2;
    },
    road: (value) => {
      const ship = placingMode() === "ship";
      if (!setupTurn(state)) {
        commit(toggleRoad(state, edges, value, builder, { ship }));
      } else if (state.roads[value] === undefined) {
        // the road-or-ship choice was only for this piece
        mode = "build";
        commit(placeSetupPiece(state, edges, value, ship));
      }
    },
    "reveal-terrain": (value) => {
      const type = value as HexType;
      if (type in RESOURCE_BY_HEX) {
        revealing = revealing && { ...revealing, type };
        renderReveal();
        return;
      }
      finishReveal({ type } as Hex);
    },
    "reveal-number": (value) =>
      finishReveal({ type: revealing?.type, number: Number(value) as NumberChitValue } as Hex),
    "knight-cancel": () => knightEl.close(),
    "reveal-cancel": () => {
      revealing = undefined;
      revealEl.close();
    },
    extra: (value) => {
      const [player, change] = value.split(":").map(Number);
      commit({
        ...state,
        players: state.players.map((entry, i) =>
          i === player ? { ...entry, extraPoints: entry.extraPoints + change } : entry
        ),
      });
    },
    share: () => {
      const room = newRoomId();
      show({ ...state, room });
      void renderShare();
      void startHosting(room);
    },
    "share-copy": () => {
      if (state.room) void navigator.clipboard.writeText(watchUrl(state.room));
    },
    "share-stop": () => {
      host?.close();
      host = undefined;
      viewers = 0;
      shareError = "";
      show({ ...state, room: null });
      void renderShare();
    },
    end: () => {
      if (!confirm("End this game? The result is kept under Past games.")) return;
      // a game nobody rolled in is not worth remembering
      if (state.rolls.length > 0) saveRecord(summarize(state, boardLabel));
      host?.close();
      clearGame();
      window.location.reload();
    },
  };

  root.addEventListener("click", (event) => {
    if (viewing) return;
    const target = event.target as HTMLElement;
    const control = target.closest<HTMLElement>("[data-action]");
    if (control?.dataset.action) {
      actions[control.dataset.action](control.dataset.value ?? "");
      return;
    }

    // a tap on a number disc or the robber lands on the layer above the tile
    const hex = target.closest<HTMLElement>("[data-hex-index]");
    if (!hex) return;
    const index = Number(hex.dataset.hexIndex);
    if (mode === "robber") {
      if (state.hexes[index].type === "sea") return;
      const mover = robberMover;
      mode = "build";
      robberMover = undefined;
      boardStale = true;
      commit(moveRobber(state, index, mover));
    } else if (mode === "pirate") {
      if (state.hexes[index].type !== "sea") return;
      mode = "build";
      boardStale = true;
      commit(movePirate(state, index, robberMover ?? currentPlayer(state)));
    } else if (layout[index].type === "fog") {
      revealing = { index };
      renderReveal();
    }
  });
  // The close event arrives late, sometimes after the dialog has been opened again for the
  // next tap, so it only clears the selection if the dialog really is still shut.
  revealEl.addEventListener("close", () => {
    if (!revealEl.open) revealing = undefined;
  });
  knightEl.addEventListener("close", () => {
    if (!knightEl.open) knightMenu = undefined;
  });

  setInterval(() => {
    const timer = document.getElementById("play-timer");
    if (timer) timer.textContent = elapsed(state.turnStartedAt);
  }, 1000);

  keepScreenAwake();
  render();
  void renderShare();
  // a reload should not cut the viewers off
  if (!viewing && state.room) void startHosting(state.room);

  return (snapshot) => {
    state = snapshot.state;
    dice = snapshot.dice;
    boardStale = true;
    render();
  };
}

function watchGame(room: string): void {
  root.innerHTML = `
    <section class="card play-empty">
      <h2>Watching a game</h2>
      <p id="play-watch-status">Connecting…</p>
    </section>`;

  let show: ((snapshot: Snapshot) => void) | undefined;
  let shown: GameState | undefined;
  void watchRoom(
    room,
    (snapshot) => {
      const { state } = snapshot;
      // the host has started a different game, which may be on a different board
      if (shown && (shown.boardId !== state.boardId || shown.startedAt !== state.startedAt)) {
        window.location.reload();
        return;
      }
      const entry = getBoardEntry(state.boardId);
      if (!entry || state.players.length === 0) return;
      show ??= runGame(state, buildBoard(entry.template), true);
      show(snapshot);
      shown = state;
    },
    (status) => {
      const label = document.getElementById("play-watch-status");
      if (label) label.textContent = status;
    }
  );
}

const watching = watchedRoom(window.location.hash);
const game = watching ? undefined : loadGame();
const entry = game && getBoardEntry(game.boardId);
if (watching) {
  watchGame(watching);
} else if (!game || !entry) {
  renderEmpty();
} else {
  const board = buildBoard(entry.template);
  if (game.players.length === 0) renderSetup(game, entry, board);
  else runGame(game, board);
}
