import type { CatanBoard, Hex, HexType, Orientation, PortType } from "../data/boards/types";
import { pipsForNumber } from "../data/boards/types";
import { HEX_ART } from "../assets/hexes/index";

type HexBoardContainer = HTMLElement & {
  __hexBoardResizeObserver?: ResizeObserver;
};

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
  village: "--color-cloth",
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
  village: "Cloth Village",
};

const PORT_LABEL: Record<PortType, string> = {
  "3:1": "3:1",
  brick: "2:1 Brick",
  wood: "2:1 Wood",
  wool: "2:1 Wool",
  wheat: "2:1 Wheat",
  ore: "2:1 Ore",
};

function buildNumberChit(hex: Hex, uprightBy: number): HTMLElement {
  const chit = document.createElement("div");
  chit.className = "hex-chit";
  chit.style.transform = `rotate(${uprightBy}deg)`;
  if (hex.number === undefined) return chit;

  chit.classList.toggle("hex-chit--hot", hex.number === 6 || hex.number === 8);

  const value = document.createElement("span");
  value.className = "hex-chit__value";
  value.textContent =
    hex.secondNumber !== undefined ? `${hex.number}/${hex.secondNumber}` : String(hex.number);
  chit.appendChild(value);

  const dots = document.createElement("span");
  dots.className = "hex-chit__pips";
  dots.textContent = "•".repeat(pipsForNumber(hex.number));
  chit.appendChild(dots);

  return chit;
}

/**
 * A harbor is drawn as a full-hex overlay rotated so its dock sits on one specific edge.
 * `orientation` is degrees clockwise from west-facing, so the dock is laid out against the
 * west edge and the whole overlay is then turned. The label is turned back the other way,
 * plus the board's own rotation, so it stays upright however the hex is oriented.
 */
function buildPort(type: PortType, orientation: Orientation, uprightBy: number): HTMLElement {
  const port = document.createElement("div");
  port.className = "hex-port";
  port.style.transform = `rotate(${orientation}deg)`;

  // two piers running from the harbour out to the ends of the western edge, which is the
  // edge orientation 0 points at; the whole overlay is then rotated onto the real edge
  port.insertAdjacentHTML(
    "beforeend",
    `<svg class="hex-port__docks" viewBox="0 0 200 231" aria-hidden="true">
       <path d="M58 92 L14 70 M58 139 L14 161" />
       <circle cx="66" cy="115.5" r="13" />
     </svg>`
  );

  const label = document.createElement("span");
  label.className = "hex-port__label";
  label.textContent = PORT_LABEL[type];
  label.style.transform = `translate(-50%, -50%) rotate(${uprightBy - orientation}deg)`;
  port.appendChild(label);

  return port;
}

const EDGE_ITEM_LABEL = { victoryPoint: "1 VP", developmentCard: "Dev" } as const;

/** Edge tokens are placed like ports: laid out on the west edge, then rotated onto theirs. */
function buildEdgeItem(item: NonNullable<Hex["edgeItems"]>[number], uprightBy: number) {
  const wrapper = document.createElement("div");
  wrapper.className = "hex-edge-item";
  wrapper.style.transform = `rotate(${item.orientation}deg)`;

  const badge = document.createElement("span");
  badge.className = `hex-edge-item__badge hex-edge-item__badge--${item.kind}`;
  badge.textContent = EDGE_ITEM_LABEL[item.kind];
  badge.title = item.kind === "victoryPoint" ? "Victory point token" : "Development card";
  badge.style.transform = `translate(-50%, -50%) rotate(${uprightBy - item.orientation}deg)`;
  wrapper.appendChild(badge);

  return wrapper;
}

function buildHex(hex: Hex, index: number, showRobber: boolean, uprightBy: number): HTMLElement {
  const element = document.createElement("div");
  element.className = "hex";
  element.dataset.hexIndex = String(index);
  element.style.setProperty("--hex-color", `var(${HEX_COLOR_VAR[hex.type]})`);
  element.style.setProperty("--hex-art", `url("${HEX_ART[hex.type]}")`);
  if (hex.orientation) element.style.setProperty("--hex-spin", `${hex.orientation}deg`);
  element.title = HEX_LABEL[hex.type];

  if (showRobber) {
    const robber = document.createElement("div");
    robber.className = "hex-robber";
    robber.title = "Robber";
    element.appendChild(robber);
  }

  if (hex.type === "fog") {
    // the host turns these over at the table, so mark them rather than dealing them out
    const unknown = document.createElement("span");
    unknown.className = "hex-unknown";
    unknown.textContent = "?";
    unknown.title = "Unknown - taken from the facedown stack";
    unknown.style.transform = `rotate(${uprightBy}deg)`;
    element.appendChild(unknown);
  }

  if (hex.number !== undefined) element.appendChild(buildNumberChit(hex, uprightBy));
  for (const item of hex.edgeItems ?? []) {
    element.classList.add("hex--has-port");
    element.appendChild(buildEdgeItem(item, uprightBy));
  }

  if (hex.port) {
    element.classList.add("hex--has-port");
    element.appendChild(buildPort(hex.port.type, hex.port.orientation, uprightBy));
  }

  return element;
}

export function renderHexBoard(container: HTMLElement, board: CatanBoard, hexes: Hex[]): void {
  const observedContainer = container as HexBoardContainer;
  observedContainer.__hexBoardResizeObserver?.disconnect();

  container.innerHTML = "";
  container.className = "hex-board-frame";

  const grid = document.createElement("div");
  grid.className = "hex-board";
  grid.style.gridTemplateColumns = board.cssGridTemplateColumns;
  grid.style.gridTemplateRows = board.cssGridTemplateRows;
  grid.style.width = board.boardWidthPercentage ?? "100%";
  grid.style.height = board.boardHeightPercentage ?? "100%";
  // Seafarers maps are printed rotated relative to the way they are written down
  const boardRotation = board.horizontal ? 90 : 0;
  if (boardRotation) grid.style.transform = `rotate(${boardRotation}deg)`;

  // scenarios can have several deserts but there is only ever one robber
  const robberIndex = hexes.findIndex((hex) => hex.type === "desert");

  hexes.forEach((hex, index) => {
    const element = buildHex(hex, index, index === robberIndex, -boardRotation);
    element.style.gridArea = board.cssGridAreas[index];
    grid.appendChild(element);
  });

  container.appendChild(grid);

  const updateHexScale = (): void => {
    const firstHex = grid.querySelector<HTMLElement>(".hex");
    if (!firstHex) return;

    const { width, height } = firstHex.getBoundingClientRect();
    const hexSize = Math.min(width, height);
    if (hexSize > 0) {
      grid.style.setProperty("--hex-size", `${hexSize}px`);
    }
  };

  updateHexScale();
  const resizeObserver = new ResizeObserver(() => updateHexScale());
  resizeObserver.observe(grid);
  observedContainer.__hexBoardResizeObserver = resizeObserver;
}
