import "../styles/theme.css";
import "../styles/board.css";
import "../styles/play.css";
import { renderNav } from "../lib/nav";
import { getBoardEntry } from "../data/boards/registry";
import type { CatanBoard, Hex, HexType, NumberChitValue } from "../data/boards/types";
import { RESOURCE_BY_HEX } from "../data/boards/types";
import { buildBoard } from "../lib/boardFactory";
import { HEX_LABEL, renderHexBoard } from "../lib/hexBoard";
import { boardGeometry, type Edge } from "../lib/vertices";
import { clearGame, loadGame, loadUndo, saveGame, saveUndo } from "../lib/gameCodec";
import {
  EVENT_LABEL,
  KNIGHT_RANK,
  TOTALS,
  barbarianOutcome,
  dieHtml,
  elapsed,
  escapeHtml,
  nameList,
  payoutText,
  playerTag,
  setHtml,
  takings,
} from "./play/format";
import { cityHtml, historyHtml, scoresHtml, statsHtml } from "./play/panels";
import { renderEmpty } from "./play/empty";
import { renderResult } from "./play/result";
import { renderSetup } from "./play/setup";
import {
  buyDevelopmentCard,
  changeWalls,
  lowerImprovement,
  movePirate,
  raiseImprovement,
} from "../lib/expansionTracking";
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
  activateKnight,
  barbarianOutlook,
  barbariansResolved,
  moveKnight,
  pendingPillage,
  pillageCity,
  promoteKnight,
  recruitKnight,
  removeKnight,
  resolveBarbarians,
  standDownKnight,
  KNIGHTS_PER_RANK,
  knightAvailable,
  knightsOfRank,
} from "../lib/cityKnights";
import {
  facedownRemaining,
  placeSetupPiece,
  revealHex,
  startingCards,
} from "../lib/gameSetup";
import {
  BARBARIAN_TRACK_LENGTH,
  barbarianPosition,
  barbariansAttacked,
  cardPlayedThisTurn,
  changeExtraPoints,
  currentPlayer,
  cycleBuilding,
  endTurn,
  hasRolled,
  knightCost,
  moveRobber,
  networkCorners,
  pairedPlayer,
  playKnight,
  playRoadBuilding,
  recordRoll,
  setLastEvent,
  setupTurn,
  toggleRoad,
  tooCloseToBuild,
  type EventDie,
  type GameState,
  type KnightAction,
  type Track,
  PIECE_LIMITS,
  pieceAvailable,
  piecesOnBoard,
  type Piece,
} from "../lib/gameState";

renderNav("play");

const root = document.getElementById("play-root") as HTMLElement;

type Mode = "build" | "road" | "ship" | "knight" | "robber" | "pirate";

const ZOOM_STEPS = [1, 1.6, 2.4];

const MODE_LABEL: Record<Mode, string> = {
  build: "Settlements",
  road: "Roads",
  ship: "Ships",
  knight: "Knights",
  robber: "Robber",
  pirate: "Pirate",
};

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
const rollDie = () => 1 + Math.floor(Math.random() * 6);

/** Where a piece went down between two states of the game, if one did. */
function placedSite(before: GameState, after: GameState): string | undefined {
  for (const entry of after.ledger.slice(before.ledger.length)) {
    if (entry.kind === "build") return entry.site;
    if (entry.kind === "troop" && (entry.action === "recruit" || entry.action === "move")) {
      return entry.site;
    }
  }
  return undefined;
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
  /** The corner or side a piece has just gone down on, for the one draw that drops it in. */
  let placed: string | undefined;
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
  /** Set once the game is over and its result is on screen in place of the board. */
  let ended = false;

  const layout = board.recommendedLayout;
  const { vertices, edges } = boardGeometry(board);
  // Judged on the board as dealt: shuffling moves land and sea about on several maps, so the
  // rule book's layout says nothing about where this game's coast is. Fog may turn out to be
  // land, so only open sea is ruled out.
  const touchesLand = (hexes: number[]) =>
    hexes.some((index) => initial.hexes[index].type !== "sea");
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

  function barbarianHtml(): string {
    if (barbariansResolved(state)) {
      const owing = pendingPillage(state);
      return owing.length > 0
        ? `<p class="play-alert">${nameList(state, owing)}: tap the city the barbarians take.</p>`
        : "";
    }
    const { cities, strength, defended, players } = barbarianOutlook(state);
    const knights = strength.reduce((sum, level) => sum + level, 0);
    return `
      <div class="play-alert">
        <p><strong>The barbarians attack.</strong> ${cities} ${cities === 1 ? "city" : "cities"}
          against ${knights} in active knights
          (${state.players.map((player, seat) => `${escapeHtml(player.name)} ${strength[seat]}`).join(", ")}).</p>
        <p>${barbarianOutcome(state, defended, players)}</p>
        <div class="play-actions">
          <button class="btn btn-secondary" data-action="barbarians">Resolve the attack</button>
        </div>
      </div>`;
  }

  function turnHtml(): string {
    const players = state.players;
    const opening = takings(state, startingCards(state, vertices), "starts with");
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

    const collecting = takings(state, last.payouts, "takes");
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
        <p class="play-rolled">Rolled ${(dice ?? []).map(dieHtml).join("")}
          <strong class="play-rolled__total">${last.total}</strong></p>
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

  /** What the player who is building has on the board, out of what their box holds. */
  function supplyHtml(): string {
    const onBoard = piecesOnBoard(state, builder);
    const pieces: Piece[] = seafaring
      ? ["settlement", "city", "road", "ship"]
      : ["settlement", "city", "road"];
    const tally = (count: number, limit: number, label: string) =>
      `<span class="${count >= limit ? "play-supply__out" : ""}">${count} of ${limit} ${label}</span>`;
    const counts = pieces.map((piece) =>
      tally(onBoard[piece], PIECE_LIMITS[piece], piece === "city" ? "cities" : `${piece}s`)
    );
    if (state.citiesKnights) {
      counts.push(
        ...KNIGHT_RANK.map((rank, index) =>
          tally(
            knightsOfRank(state, builder, (index + 1) as 1 | 2 | 3),
            KNIGHTS_PER_RANK,
            `${rank.toLowerCase()} knights`
          )
        )
      );
    }
    return `${escapeHtml(state.players[builder].name)} has out ${counts.join(", ")}.`;
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
      <p class="play-muted">${movingKnight ? "Tap the corner the knight moves to." : MODE_HINT[mode]}</p>
      <p class="play-muted play-supply">${supplyHtml()}</p>`;
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
      const moving = movingKnight === undefined ? undefined : state.knights[movingKnight];
      const owner = moving?.player ?? builder;
      const network = networkCorners(state, edges, owner, layingSide ? layingShip : undefined);
      // nothing is offered that the builder has run out of; a knight being moved is already out
      const inBox =
        placing === "knight"
          ? moving !== undefined || knightAvailable(state, builder, 1)
          : pieceAvailable(state, builder, layingSide ? (layingShip ? "ship" : "road") : "settlement");
      cornerOpen = (corner) => inBox && network.has(corner);
      sideOpen = (ends) => inBox && ends.some((end) => network.has(end));
    }

    const dropping = (site: string) => (site === placed ? " is-new" : "");
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
        return `<button class="edge${owner ? ` edge--${piece}` : ""}${dropping(edge.id)}"
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
          return `<button class="vertex vertex--${building.kind}${dropping(vertex.id)}" data-action="build"
            data-value="${vertex.id}" aria-label="${escapeHtml(label)}"
            style="${at}${color(building.player)}"></button>`;
        }
        const knight = state.knights[vertex.id];
        if (knight) {
          const label = `${state.players[knight.player].name}'s ${knight.active ? "active" : "inactive"} ${KNIGHT_RANK[knight.level - 1].toLowerCase()} knight`;
          return `<button class="vertex vertex--knight${dropping(vertex.id)}" data-action="knight-menu"
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
    placed = undefined;
    setHtml(turnEl, turnHtml());
    setHtml(toolbarEl, toolbarHtml());
    setHtml(scoresEl, scoresHtml(state, edges));
    cityEl.hidden = !state.citiesKnights;
    if (state.citiesKnights) setHtml(cityEl, cityHtml(state));
    setHtml(statsEl, statsHtml(state));
    setHtml(historyEl, historyHtml(state, vertices));
  }

  function show(next: GameState): void {
    state = next;
    saveGame(state);
    host?.send({ state, dice });
    render();
  }

  /** Applies a change to the game, keeping what came before so it can be undone. */
  function commit(next: GameState): void {
    // a move the rules refused comes back as the same game, and is not a step to undo
    if (next === state) return;
    undoStack.push(state);
    saveUndo(undoStack);
    placed = placedSite(state, next);
    show(next);
  }

  /** Lights the hexes a roll pays out on. The robber's hex stays dark, as it pays nothing. */
  function lightRolled(total: number): void {
    state.hexes.forEach((hex, index) => {
      if (index === state.robber || (hex.number !== total && hex.secondNumber !== total)) return;
      // the tile and what stands on it are separate elements sharing the hex's index
      for (const element of boardEl.querySelectorAll(`[data-hex-index="${index}"]`)) {
        element.classList.add("is-rolled");
        element.addEventListener("animationend", () => element.classList.remove("is-rolled"), {
          once: true,
        });
      }
    });
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

  /** Counts starts and stops, so a start that was cancelled while loading can tell. */
  let shareRun = 0;

  async function startHosting(room: string): Promise<void> {
    const run = ++shareRun;
    const started = await hostRoom(
      room,
      () => ({ state, dice, ended }),
      (count, error) => {
        viewers = count;
        shareError = error ?? "";
        void renderShare();
      }
    );
    // Stop sharing may have been tapped while the connection library was still loading
    if (run !== shareRun) {
      started.close();
      return;
    }
    host = started;
  }

  function roll(total: number, event?: EventDie): void {
    builder = currentPlayer(state);
    robberMover = undefined;
    if (total === 7) mode = "robber";
    const rolled = recordRoll(state, vertices, total, event, undefined, edges);
    if (rolled === state) return;
    commit(rolled);
    lightRolled(total);
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
        ${knight.level < 3 && knightAvailable(state, knight.player, (knight.level + 1) as 2 | 3) ? option("promote", "Promote", "promote") : ""}
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
      // whatever is chosen replaces a move left half-made, which may have been of this knight
      movingKnight = undefined;
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
      commit(changeExtraPoints(state, player, change === 1 ? 1 : -1));
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
      shareRun++;
      host?.close();
      host = undefined;
      viewers = 0;
      shareError = "";
      show({ ...state, room: null });
      void renderShare();
    },
    end: () => {
      if (!confirm("End this game? Its result can be shared from the next screen, but is not kept.")) return;
      // a game nobody rolled in has no result worth showing
      if (state.rolls.length === 0) {
        host?.close();
        clearGame();
        window.location.reload();
        return;
      }
      // The saved game goes only once its result is on screen, as the result is all that
      // will be left of it. The room stays open while this page does, so a viewer who was
      // away when the game ended still gets the result on coming back.
      renderResult(root, state, board, boardLabel).then(
        () => {
          ended = true;
          clearGame();
          host?.send({ state, dice, ended });
        },
        () => alert("The result could not be drawn, so the game has been kept. Check the connection and try again.")
      );
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
    // the host goes on sending the finished game to whoever joins, and once is enough here
    if (ended) return;
    const rolled = snapshot.state.rolls.length > state.rolls.length;
    placed = placedSite(state, snapshot.state);
    state = snapshot.state;
    dice = snapshot.dice;
    boardStale = true;
    render();
    const last = state.rolls.at(-1);
    if (rolled && last) lightRolled(last.total);
    if (!snapshot.ended) return;
    ended = true;
    // a result that cannot be drawn leaves the final board showing, which is the next best thing
    renderResult(root, state, board, boardLabel).catch(() => undefined);
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

// finished games were once kept here; nothing reads them now
localStorage.removeItem("catan-comp-history");

const watching = watchedRoom(window.location.hash);
const game = watching ? undefined : loadGame();
const entry = game && getBoardEntry(game.boardId);
if (watching) {
  watchGame(watching);
} else if (!game || !entry) {
  renderEmpty(root);
} else {
  const board = buildBoard(entry.template);
  if (game.players.length === 0) renderSetup(root, game, entry, (started) => runGame(started, board));
  else runGame(game, board);
}
