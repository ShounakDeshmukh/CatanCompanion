import type { CatanBoard, HexCell, HexType, PortType } from "../data/boards/types";
import { PIPS_BY_NUMBER } from "../data/boards/types";

const HEX_COLOR_VAR: Record<HexType, string> = {
  hills: "--color-brick",
  forest: "--color-wood",
  pasture: "--color-wool",
  fields: "--color-wheat",
  mountains: "--color-ore",
  gold: "--color-gold",
  desert: "--color-desert",
  sea: "--color-sea",
  fog: "--color-fog",
};

const HEX_LABEL: Record<HexType, string> = {
  hills: "Hills",
  forest: "Forest",
  pasture: "Pasture",
  fields: "Fields",
  mountains: "Mountains",
  gold: "Gold Field",
  desert: "Desert",
  sea: "Sea",
  fog: "Fog",
};

const PORT_LABEL: Record<PortType, string> = {
  "3:1": "3:1",
  brick: "2:1 Brick",
  wood: "2:1 Wood",
  wool: "2:1 Wool",
  wheat: "2:1 Wheat",
  ore: "2:1 Ore",
};

const HEX_CLIP_PATH =
  "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";

function buildNumberChit(cell: HexCell): HTMLElement {
  const chit = document.createElement("div");
  chit.className = "hex-chit";
  if (cell.number === undefined) return chit;

  const pips = PIPS_BY_NUMBER[cell.number];
  const isHot = cell.number === 6 || cell.number === 8;
  chit.classList.toggle("hex-chit--hot", isHot);

  const value = document.createElement("span");
  value.className = "hex-chit__value";
  value.textContent =
    cell.secondNumber !== undefined ? `${cell.number}/${cell.secondNumber}` : String(cell.number);
  chit.appendChild(value);

  const dots = document.createElement("span");
  dots.className = "hex-chit__pips";
  dots.textContent = "•".repeat(pips);
  chit.appendChild(dots);

  return chit;
}

function buildHexElement(cell: HexCell, index: number, neighborIsLand: boolean): HTMLElement {
  const hex = document.createElement("div");
  hex.className = "hex";
  hex.dataset.hexIndex = String(index);
  hex.style.setProperty("--hex-color", `var(${HEX_COLOR_VAR[cell.type]})`);
  hex.style.clipPath = HEX_CLIP_PATH;
  hex.title = HEX_LABEL[cell.type];

  if (cell.type === "desert") {
    const robber = document.createElement("div");
    robber.className = "hex-robber";
    robber.title = "Robber";
    hex.appendChild(robber);
  }

  if (cell.number !== undefined) {
    hex.appendChild(buildNumberChit(cell));
  }

  if (cell.port) {
    const port = document.createElement("div");
    port.className = "hex-port";
    port.textContent = PORT_LABEL[cell.port.type];
    hex.appendChild(port);
  } else if (!neighborIsLand && cell.type === "sea") {
    hex.classList.add("hex--open-water");
  }

  return hex;
}

export function renderHexBoard(container: HTMLElement, board: CatanBoard): void {
  container.innerHTML = "";
  container.className = "hex-board";
  container.style.gridTemplateColumns = board.cssGridTemplateColumns;
  container.style.gridTemplateRows = board.cssGridTemplateRows;
  container.style.aspectRatio = String(board.aspectRatio);

  board.cells.forEach((cell, index) => {
    const touchesLand = Object.values(board.neighbors[index]).some(
      (n) => board.cells[n].type !== "sea"
    );
    const hex = buildHexElement(cell, index, touchesLand);
    hex.style.gridArea = board.cssGridAreas[index];
    container.appendChild(hex);
  });
}
