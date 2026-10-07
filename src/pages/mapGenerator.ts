import "../styles/theme.css";
import "../styles/board.css";
import { renderNav } from "../lib/nav";
import { BOARD_REGISTRY, getBoardEntry } from "../data/boards/registry";
import {
  DEFAULT_CONSTRAINTS,
  randomSeed,
  type ShuffleConstraints,
} from "../lib/shuffle";
import type { CatanBoard, Hex } from "../data/boards/types";
import { renderHexBoard } from "../lib/hexBoard";
import { renderFacedownStack } from "../lib/facedownStack";
import { decodeShareHash, encodeShareHash } from "../lib/shareLink";
import { newGame } from "../lib/gameState";
import { loadGame, saveGame } from "../lib/gameCodec";
import { boardStats, type Yield } from "../lib/boardStats";
import { boardGeometry } from "../lib/vertices";
import { HEX_LABEL } from "../lib/hexBoard";

renderNav("map-generator");

type MapGenerationSuccess = {
  generationId: number;
  ok: true;
  boardId: string;
  seed: number;
  constraints: ShuffleConstraints;
  board: CatanBoard;
  hexes: Hex[];
};

type MapGenerationFailure = {
  generationId: number;
  ok: false;
  name: string;
  error: string;
};

type MapGenerationMessage = MapGenerationSuccess | MapGenerationFailure;

const boardSelect = document.getElementById("board-select") as HTMLSelectElement;
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const no68 = byId<HTMLInputElement>("no-6-8-adjacent");
const no212 = byId<HTMLInputElement>("no-2-12-adjacent");
const noPairs = byId<HTMLInputElement>("no-same-adjacent");
const maxTerrain = byId<HTMLSelectElement>("max-connected-terrain");
const maxPips = byId<HTMLSelectElement>("max-intersection-pips");
const minIslands = byId<HTMLSelectElement>("min-island-count");
const minIslandsField = byId<HTMLLabelElement>("min-islands-field");

const CONSTRAINT_INPUTS = [no68, no212, noPairs, maxTerrain, maxPips, minIslands];

function readConstraints(): ShuffleConstraints {
  return {
    noAdjacentSixEight: no68.checked,
    noAdjacentTwoTwelve: no212.checked,
    noAdjacentPairs: noPairs.checked,
    maxConnectedLikeTerrain: Number(maxTerrain.value),
    maxIntersectionPipCount: Number(maxPips.value),
    minIslandCount: Number(minIslands.value),
  };
}

function writeConstraints(c: ShuffleConstraints): void {
  no68.checked = c.noAdjacentSixEight;
  no212.checked = c.noAdjacentTwoTwelve;
  noPairs.checked = c.noAdjacentPairs;
  maxTerrain.value = String(c.maxConnectedLikeTerrain);
  maxPips.value = String(c.maxIntersectionPipCount);
  minIslands.value = String(c.minIslandCount);
}

const generatorWorker = new Worker(new URL("../workers/mapGeneratorWorker.ts", import.meta.url), {
  type: "module",
});

let activeGenerationId = 0;
const form = document.getElementById("map-controls") as HTMLFormElement;
const root = document.getElementById("map-generator-root") as HTMLElement;
const shuffleButton = form.querySelector("button[type=submit]") as HTMLButtonElement;
const startGameButton = byId<HTMLButtonElement>("start-game");
let shownBoard: { boardId: string; hexes: Hex[] } | undefined;

// 26 boards is too many for a flat list, so group them the way the boxes are sold
const groups = new Map<string, HTMLOptGroupElement>();
for (const entry of BOARD_REGISTRY) {
  let group = groups.get(entry.group);
  if (!group) {
    group = document.createElement("optgroup");
    group.label = entry.group;
    groups.set(entry.group, group);
    boardSelect.appendChild(group);
  }
  const option = document.createElement("option");
  option.value = entry.id;
  option.textContent = entry.label;
  group.appendChild(option);
}

function syncBoardSpecificControls(board: CatanBoard): void {
  // islands can only be counted differently on boards whose sea hexes are allowed to move,
  // so the control is pointless anywhere else
  const islandsMoveable = board.recommendedLayout.some(
    (hex) => hex.type === "sea" && !hex.fixed
  );
  minIslandsField.classList.toggle("map-chip--disabled", !islandsMoveable);
  minIslands.disabled = !islandsMoveable;
  if (!islandsMoveable) minIslands.value = "1";
}

const YIELD_LABEL: Record<Yield, string> = {
  brick: "Brick",
  wood: "Wood",
  wool: "Sheep",
  wheat: "Wheat",
  ore: "Ore",
  choice: "Gold",
};

/**
 * How the dealt board is balanced: how often each resource pays out, and the strongest
 * places to settle. Hovering or tapping a spot lights up its hexes on the board.
 */
function renderBalance(board: CatanBoard, hexes: Hex[]): HTMLElement {
  const stats = boardStats(hexes, boardGeometry(board).vertices);
  const most = Math.max(1, ...Object.values(stats.pips));
  const section = document.createElement("section");
  section.className = "card board-balance";
  section.innerHTML = `
    <h2>Balance</h2>
    <div class="board-balance__grid">
      <div>
        <h3>Pips per resource</h3>
        ${(Object.keys(YIELD_LABEL) as Yield[])
          .filter((resource) => stats.hexes[resource])
          .map(
            (resource) => `
          <div class="board-balance__row">
            <span>${YIELD_LABEL[resource]}</span>
            <span class="board-balance__bar"><span style="width: ${((stats.pips[resource] ?? 0) / most) * 100}%; background: var(--color-${resource === "choice" ? "gold" : resource})"></span></span>
            <span>${stats.pips[resource]} on ${stats.hexes[resource]}</span>
          </div>`
          )
          .join("")}
      </div>
      <div>
        <h3>Strongest spots</h3>
        <ol class="board-balance__spots">
          ${stats.corners
            .map(
              (corner) => `
            <li tabindex="0" data-hexes="${corner.hexes.join(",")}">
              <strong>${corner.pips} pips</strong>
              ${corner.hexes.map((index) => `${HEX_LABEL[hexes[index].type]} ${hexes[index].number}`).join(", ")}
            </li>`
            )
            .join("")}
        </ol>
      </div>
    </div>
    ${hexes.some((hex) => hex.type === "fog") ? `<p class="board-balance__note">Fog hexes are unknown until explored and are not counted.</p>` : ""}`;

  const light = (indices: string | undefined, on: boolean) => {
    for (const index of indices?.split(",") ?? []) {
      root.querySelector(`.hex[data-hex-index="${index}"]`)?.classList.toggle("hex--lit", on);
    }
  };
  for (const spot of section.querySelectorAll<HTMLElement>("[data-hexes]")) {
    for (const [event, on] of [["mouseenter", true], ["focus", true], ["mouseleave", false], ["blur", false]] as const) {
      spot.addEventListener(event, () => light(spot.dataset.hexes, on));
    }
  }
  return section;
}

function renderGeneratedBoard(
  boardId: string,
  seed: number,
  constraints: ShuffleConstraints,
  board: CatanBoard,
  hexes: Hex[]
): void {
  syncBoardSpecificControls(board);

  root.innerHTML = "";
  const boardHost = document.createElement("div");
  root.appendChild(boardHost);
  renderHexBoard(boardHost, board, hexes);
  if (board.facedownStack) root.appendChild(renderFacedownStack(board.facedownStack));
  root.appendChild(renderBalance(board, hexes));
  history.replaceState(null, "", encodeShareHash({ boardId, seed, constraints }));
  shownBoard = { boardId, hexes };
}

generatorWorker.addEventListener("message", (event: MessageEvent<MapGenerationMessage>) => {
  const message = event.data;
  if (message.generationId !== activeGenerationId) return;

  setControlsDisabled(false);
  root.classList.remove("map-generating");

  if (!message.ok) {
    root.innerHTML = `<p class="card">${message.error}</p>`;
    return;
  }

  renderGeneratedBoard(message.boardId, message.seed, message.constraints, message.board, message.hexes);
});

generatorWorker.addEventListener("error", () => {
  if (activeGenerationId === 0) return;
  setControlsDisabled(false);
  root.classList.remove("map-generating");
  root.innerHTML = `<p class="card">Map generation failed.</p>`;
});

function requestGeneration(boardId: string, seed: number, constraints: ShuffleConstraints): void {
  if (!getBoardEntry(boardId)) return;

  activeGenerationId += 1;
  generatorWorker.postMessage({
    generationId: activeGenerationId,
    boardId,
    seed,
    constraints,
  });
}

function setControlsDisabled(disabled: boolean): void {
  shuffleButton.disabled = disabled;
  shuffleButton.textContent = disabled ? "Generating…" : "Shuffle";
  startGameButton.disabled = disabled;
  boardSelect.disabled = disabled;
  for (const input of CONSTRAINT_INPUTS) {
    // generateAndRender decides min-islands' own disabled state based on the board, so only
    // this function's disable side touches it - re-enabling is left to that logic
    if (input === minIslands && !disabled) continue;
    input.disabled = disabled;
  }
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

// a tight combination of constraints can make the shuffler burn its full time budget
// (up to 1.5s, see shuffle.ts) searching for a satisfying board. The controls are disabled
// and given a paint first so the page stays responsive while the worker does the work.
async function reshuffle(boardId: string, seed: number): Promise<void> {
  const constraints = readConstraints();
  shownBoard = undefined;
  setControlsDisabled(true);
  // The board on screen stays where it is, dimmed, until its replacement is ready. Clearing
  // it would collapse the page for a moment and pull the footer up into view, which flashed
  // on every shuffle. The very first board has nothing to stand in for it, so an empty frame
  // of the same size holds its place.
  root.classList.add("map-generating");
  if (!root.querySelector(".hex-board-frame")) {
    root.innerHTML = `<div class="hex-board-frame"><p class="card">Generating board…</p></div>`;
  }
  await nextPaint();
  requestGeneration(boardId, seed, constraints);
}

// picking a board draws it straight away; there is nothing else the button could be for
boardSelect.addEventListener("change", () => void reshuffle(boardSelect.value, randomSeed()));
form.addEventListener("submit", (event) => {
  event.preventDefault();
  void reshuffle(boardSelect.value, randomSeed());
});

startGameButton.addEventListener("click", () => {
  if (!shownBoard) return;
  const inProgress = loadGame();
  if (
    inProgress &&
    inProgress.players.length > 0 &&
    !confirm("This replaces the game in progress. Start a new one on this board?")
  ) {
    return;
  }
  saveGame(newGame(shownBoard.boardId, shownBoard.hexes));
  window.location.href = "./play.html";
});

// a constraint change re-runs the same seed, so you can see what that setting did rather
// than being handed an unrelated board
for (const input of CONSTRAINT_INPUTS) {
  input.addEventListener("change", () => {
    const current = decodeShareHash(window.location.hash);
    void reshuffle(boardSelect.value, current?.seed ?? randomSeed());
  });
}

// a shared link carries its own settings, off ones included, so the defaults only apply
// when the page is opened fresh
const shared = decodeShareHash(window.location.hash);
if (shared && getBoardEntry(shared.boardId)) {
  boardSelect.value = shared.boardId;
  writeConstraints(shared.constraints);
} else {
  writeConstraints(DEFAULT_CONSTRAINTS);
}
void reshuffle(boardSelect.value || BOARD_REGISTRY[0].id, shared?.seed ?? randomSeed());
