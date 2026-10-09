import type { CatanBoard, Hex, HexType, Orientation, PortType } from "../data/boards/types";
import { pipsForNumber } from "../data/boards/types";
import {
  HARBOR_ART,
  HARBOR_ART_SIDEWAYS,
  HEX_ART,
  HEX_ART_SIDEWAYS,
} from "../assets/hexes/index";

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

export const HEX_LABEL: Record<HexType, string> = {
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
 * The plaque naming a harbor's trade. Which edge the harbor serves is shown by its tile. The
 * plaque is laid out as if that edge were the western one and the whole overlay then turned
 * onto the real edge, which is what lets it sit out on the water, clear of the village drawn
 * along the coast. `orientation` is degrees clockwise from west-facing. The label is turned
 * back the other way, plus the board's own rotation, so it stays upright.
 */
function buildPort(type: PortType, orientation: Orientation, uprightBy: number): HTMLElement {
  const port = document.createElement("div");
  port.className = "hex-port";
  port.style.transform = `rotate(${orientation}deg)`;

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

/** The terrain tile itself. Everything that sits on it is built by {@link buildHexTop}. */
function buildHex(hex: Hex, index: number, uprightBy: number): HTMLElement {
  const upright = uprightBy === 0;
  // a harbor has its own tile, drawn with the coast along the edge it serves
  const art = hex.port
    ? (upright ? HARBOR_ART : HARBOR_ART_SIDEWAYS)[hex.port.orientation]
    : (upright ? HEX_ART : HEX_ART_SIDEWAYS)[hex.type];
  const element = document.createElement("div");
  element.className = "hex";
  element.dataset.hexIndex = String(index);
  element.style.setProperty("--hex-color", `var(${HEX_COLOR_VAR[hex.type]})`);
  element.style.setProperty("--hex-art", `url("${art}")`);
  if (hex.orientation) element.style.setProperty("--hex-spin", `${hex.orientation}deg`);
  element.title = HEX_LABEL[hex.type];
  return element;
}

/**
 * What stands on a hex: the robber, its number disc, a harbor, edge tokens. These are kept
 * apart from the tile so that they can all be drawn after every tile on the board. Harbor
 * plaques and edge tokens overhang their own hex, and as children of the tile they were
 * painted over by whichever neighbouring tile came later. Returns nothing for a bare hex.
 */
function buildHexTop(
  hex: Hex,
  index: number,
  thief: "robber" | "pirate" | undefined,
  uprightBy: number
): HTMLElement | undefined {
  const element = document.createElement("div");
  element.className = "hex-top";
  element.dataset.hexIndex = String(index);

  if (thief) {
    // the pirate stands on its hex just as the robber does, with its own figure
    const robber = document.createElement("div");
    robber.className = thief === "pirate" ? "hex-robber hex-robber--pirate" : "hex-robber";
    robber.title = thief === "pirate" ? "Pirate" : "Robber";
    robber.style.transform = `translate(-50%, -50%) rotate(${uprightBy}deg)`;
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
    element.classList.add("hex-top--reaching");
    element.appendChild(buildEdgeItem(item, uprightBy));
  }

  if (hex.port) {
    element.classList.add("hex-top--reaching");
    element.appendChild(buildPort(hex.port.type, hex.port.orientation, uprightBy));
  }

  return element.childElementCount > 0 ? element : undefined;
}

export function renderHexBoard(
  container: HTMLElement,
  board: CatanBoard,
  hexes: Hex[],
  // scenarios can have several deserts but there is only ever one robber
  robberIndex: number = hexes.findIndex((hex) => hex.type === "desert"),
  pirateIndex: number = -1
): void {
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

  // every tile first, then everything that stands on them, so nothing ends up under a tile
  const tops: HTMLElement[] = [];
  hexes.forEach((hex, index) => {
    const tile = buildHex(hex, index, -boardRotation);
    tile.style.gridArea = board.cssGridAreas[index];
    grid.appendChild(tile);

    const thief = index === robberIndex ? "robber" : index === pirateIndex ? "pirate" : undefined;
    const top = buildHexTop(hex, index, thief, -boardRotation);
    if (!top) return;
    top.style.gridArea = board.cssGridAreas[index];
    tops.push(top);
  });
  grid.append(...tops);

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
