import "../styles/theme.css";
import "../styles/board.css";
import { renderNav } from "../lib/nav";
import { BOARD_REGISTRY, getBoardEntry } from "../data/boards/registry";
import { buildBoard } from "../lib/boardFactory";
import { generateBoard, randomSeed, UnsatisfiableConstraintsError } from "../lib/shuffle";
import { renderHexBoard } from "../lib/hexBoard";
import { decodeShareHash, encodeShareHash } from "../lib/shareLink";

renderNav("map-generator");

const boardSelect = document.getElementById("board-select") as HTMLSelectElement;
const no6and8Checkbox = document.getElementById("no-6-8-adjacent") as HTMLInputElement;
const noSameCheckbox = document.getElementById("no-same-adjacent") as HTMLInputElement;
const form = document.getElementById("map-controls") as HTMLFormElement;
const shareUrlInput = document.getElementById("share-url") as HTMLInputElement;
const copyLinkButton = document.getElementById("copy-link") as HTMLButtonElement;
const printButton = document.getElementById("print-board") as HTMLButtonElement;
const root = document.getElementById("map-generator-root") as HTMLElement;

for (const entry of BOARD_REGISTRY) {
  const option = document.createElement("option");
  option.value = entry.id;
  option.textContent = entry.label;
  boardSelect.appendChild(option);
}

function generateAndRender(boardId: string, seed: number): void {
  const entry = getBoardEntry(boardId);
  if (!entry) return;

  const base = buildBoard(entry.template);
  base.constraints = {
    ...base.constraints,
    no6and8Adjacent: no6and8Checkbox.checked || base.constraints?.no6and8Adjacent,
    noSameNumberAdjacent: noSameCheckbox.checked || base.constraints?.noSameNumberAdjacent,
  };

  try {
    const { board, seed: usedSeed } = generateBoard(base, seed);
    renderHexBoard(root, board);
    const hash = encodeShareHash({ boardId, seed: usedSeed });
    history.replaceState(null, "", hash);
    shareUrlInput.value = `${window.location.origin}${window.location.pathname}${hash}`;
  } catch (error) {
    if (error instanceof UnsatisfiableConstraintsError) {
      root.innerHTML = `<p class="card">${error.message}</p>`;
    } else {
      throw error;
    }
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  generateAndRender(boardSelect.value, randomSeed());
});

copyLinkButton.addEventListener("click", () => {
  navigator.clipboard.writeText(shareUrlInput.value).then(() => {
    copyLinkButton.textContent = "Copied!";
    setTimeout(() => (copyLinkButton.textContent = "Copy link"), 1500);
  });
});

printButton.addEventListener("click", () => window.print());

const shared = decodeShareHash(window.location.hash);
const initialBoardId = shared && getBoardEntry(shared.boardId) ? shared.boardId : BOARD_REGISTRY[0].id;
boardSelect.value = initialBoardId;
generateAndRender(initialBoardId, shared?.seed ?? randomSeed());
