import {
  HARBOR_ART,
  HARBOR_ART_SIDEWAYS,
  HEX_ART,
  HEX_ART_SIDEWAYS,
} from "../../assets/hexes/index";
import pirateArt from "../../assets/pirate.svg";
import robberArt from "../../assets/robber.svg";
import type { CatanBoard, Hex, Orientation } from "../../data/boards/types";
import { pipsForNumber } from "../../data/boards/types";
import type { PlayerColor } from "../../lib/gameState";
import type { BoardView } from "../../lib/replay";
import { boardGeometry } from "../../lib/vertices";

export const INK = "#2b1c10";
export const HEADING = '"Cinzel", Georgia, serif';
export const BODY = '"Crimson Pro", Georgia, serif';

/** The colours of the pieces, as play.css has them; a canvas cannot read the stylesheet. */
export const PIECE_COLOR: Record<PlayerColor, string> = {
  red: "#c8322b",
  blue: "#2f6fc1",
  white: "#f2efe6",
  orange: "#e08a1e",
  green: "#3d8b40",
  brown: "#7a4a2a",
  black: "#26221f",
  gray: "#8b8f94",
  purple: "#7b4bb0",
  pink: "#e27aa6",
  lime: "#a6d42a",
};

const PARCHMENT = "#ecdcb0";
const PARCHMENT_EDGE = "#5e4322";
const HOT = "#b3311b";
const OUTLINE = "#1d140c";
const PORT_LABEL = { "3:1": "3:1", brick: "2:1 Brick", wood: "2:1 Wood", wool: "2:1 Wool", wheat: "2:1 Wheat", ore: "2:1 Ore" };
const EDGE_ITEM = {
  victoryPoint: { label: "1 VP", fill: "#c9a227", ink: "#2b2118" },
  developmentCard: { label: "Dev", fill: HOT, ink: "#f6ecd4" },
};

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Draws a view of the board as large as fits in a box, centred. `changed` rings the corner,
 * side or hex that was just played on.
 */
export type BoardPainter = (
  draw: CanvasRenderingContext2D,
  view: BoardView,
  box: Box,
  changed?: string | number
) => void;

/** Waits for the load event and not for `decode()`, which a tab in the background never answers. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

async function loadAll<Key extends string | number>(
  art: Record<Key, string>
): Promise<Record<Key, HTMLImageElement>> {
  const entries = await Promise.all(
    Object.entries<string>(art).map(async ([key, src]) => [key, await loadImage(src)] as const)
  );
  return Object.fromEntries(entries) as Record<Key, HTMLImageElement>;
}

/**
 * The Play page's board, redrawn on a canvas so it can go into a picture: the same tiles and
 * the same proportions as board.css and play.css give the pieces. Resolves once the artwork
 * has loaded, after which painting is immediate.
 */
export async function boardPainter(board: CatanBoard): Promise<BoardPainter> {
  const sideways = board.horizontal === true;
  const [tiles, harbors, robber, pirate] = await Promise.all([
    loadAll(sideways ? HEX_ART_SIDEWAYS : HEX_ART),
    loadAll<Orientation>(sideways ? HARBOR_ART_SIDEWAYS : HARBOR_ART),
    loadImage(robberArt),
    loadImage(pirateArt),
  ]);
  const { vertices, edges, aspect, side } = boardGeometry(board);
  const sites = new Map([...vertices, ...edges].map((site) => [site.id, site]));
  const centres = board.cssGridAreas.map(() => ({ x: 0, y: 0 }));
  for (const vertex of vertices) {
    for (const index of vertex.hexes) {
      centres[index].x += vertex.x / 6;
      centres[index].y += vertex.y / 6;
    }
  }

  return (draw, view, box, changed) => {
    // a Seafarers map is turned a quarter, so it fills the box the other way about
    const shape = sideways ? 1 / aspect : aspect;
    // harbor plaques and pieces on the coast overhang the grid a little
    const fit = 0.94 * Math.min(box.width / shape, box.height);
    const height = sideways ? fit * shape : fit;
    const width = height * aspect;
    const sideLength = side * height;
    const hexSize = Math.sqrt(3) * sideLength;
    const upright = sideways ? -Math.PI / 2 : 0;

    /** Runs `paint` with the origin on a point of the grid and, if asked, the page's way up. */
    const at = (point: { x: number; y: number }, turn: number, paint: () => void) => {
      draw.save();
      draw.translate(point.x * width, point.y * height);
      draw.rotate(turn);
      paint();
      draw.restore();
    };
    const text = (value: string, y: number, font: string, color: string) => {
      draw.font = font;
      draw.fillStyle = color;
      draw.textAlign = "center";
      draw.textBaseline = "middle";
      draw.fillText(value, 0, y);
    };
    /** A piece's dark outline and pale inner line, then its colour, around the current path. */
    const piece = (color: string) => {
      draw.strokeStyle = OUTLINE;
      draw.lineWidth = hexSize * 0.07;
      draw.stroke();
      draw.strokeStyle = "rgb(255 255 255 / 0.7)";
      draw.lineWidth = hexSize * 0.025;
      draw.stroke();
      draw.fillStyle = color;
      draw.fill();
    };
    /** A label on something along a hex's edge, set out from the centre towards that edge. */
    const plaque = (
      centre: { x: number; y: number },
      orientation: Orientation,
      reach: number,
      label: string,
      fill: string,
      ink: string
    ) => {
      const angle = (orientation * Math.PI) / 180;
      at(centre, 0, () => {
        draw.translate(Math.cos(angle) * reach * hexSize, Math.sin(angle) * reach * hexSize);
        draw.rotate(upright);
        draw.font = `700 ${hexSize * 0.165}px ${BODY}`;
        const wide = draw.measureText(label).width + hexSize * 0.16;
        const tall = hexSize * 0.22;
        draw.beginPath();
        draw.roundRect(-wide / 2, -tall / 2, wide, tall, tall / 2);
        draw.fillStyle = fill;
        draw.fill();
        draw.strokeStyle = PARCHMENT_EDGE;
        draw.lineWidth = Math.max(1, hexSize * 0.012);
        draw.stroke();
        text(label, hexSize * 0.01, draw.font, ink);
      });
    };

    const tile = (hex: Hex, index: number) =>
      at(centres[index], ((hex.orientation ?? 0) * Math.PI) / 180, () => {
        draw.beginPath();
        for (let corner = 0; corner < 6; corner++) {
          const angle = (corner * Math.PI) / 3 - Math.PI / 2;
          draw.lineTo(Math.cos(angle) * sideLength, Math.sin(angle) * sideLength);
        }
        draw.closePath();
        // keeps the page from showing through where two tiles' soft edges meet
        draw.strokeStyle = PARCHMENT_EDGE;
        draw.lineWidth = 2;
        draw.stroke();
        draw.clip();
        // the artwork's own frame sits a little inside the picture, as board.css allows for
        const across = hexSize * 1.032;
        const down = sideLength * 2 * 1.032;
        const art = hex.port ? harbors[hex.port.orientation] : tiles[hex.type];
        draw.drawImage(art, -across / 2, -down / 2, across, down);
      });

    const chit = (hex: Hex, index: number) =>
      at(centres[index], upright, () => {
        if (hex.type === "fog") {
          draw.shadowColor = "rgb(0 0 0 / 0.55)";
          draw.shadowBlur = hexSize * 0.04;
          text("?", 0, `700 ${hexSize * 0.38}px ${HEADING}`, "#f2ede2");
          return;
        }
        if (hex.number === undefined) return;
        const radius = hexSize * 0.215;
        const face = draw.createRadialGradient(-radius * 0.3, -radius * 0.45, 0, 0, 0, radius);
        face.addColorStop(0, "#fffaf0");
        face.addColorStop(0.45, "#f6ecce");
        face.addColorStop(1, "#e2cc98");
        draw.beginPath();
        draw.arc(0, 0, radius, 0, Math.PI * 2);
        draw.fillStyle = face;
        draw.fill();
        draw.strokeStyle = PARCHMENT_EDGE;
        draw.lineWidth = Math.max(1, hexSize * 0.012);
        draw.stroke();

        const ink = hex.number === 6 || hex.number === 8 ? HOT : INK;
        const paired = hex.secondNumber !== undefined;
        const value = paired ? `${hex.number}/${hex.secondNumber}` : String(hex.number);
        text(value, -hexSize * 0.03, `700 ${hexSize * (paired ? 0.12 : 0.17)}px ${HEADING}`, ink);
        const pips = pipsForNumber(hex.number);
        for (let pip = 0; pip < pips; pip++) {
          draw.beginPath();
          draw.arc((pip - (pips - 1) / 2) * hexSize * 0.04, hexSize * 0.1, hexSize * 0.013, 0, Math.PI * 2);
          draw.fill();
        }
      });

    const thief = (index: number | null, figure: HTMLImageElement) => {
      if (index === null) return;
      at(centres[index], upright, () => {
        const across = hexSize * 0.38;
        draw.drawImage(figure, -across / 2, -across * 0.6, across, across * 1.2);
      });
    };

    draw.save();
    draw.translate(box.x + box.width / 2, box.y + box.height / 2);
    if (sideways) draw.rotate(Math.PI / 2);
    draw.translate(-width / 2, -height / 2);

    view.hexes.forEach(tile);
    view.hexes.forEach((hex, index) => {
      chit(hex, index);
      if (hex.port) plaque(centres[index], hex.port.orientation, 0.1, PORT_LABEL[hex.port.type], PARCHMENT, INK);
      for (const item of hex.edgeItems ?? []) {
        const { label, fill, ink } = EDGE_ITEM[item.kind];
        plaque(centres[index], item.orientation, -0.35, label, fill, ink);
      }
    });
    thief(view.robber, robber);
    thief(view.pirate, pirate);

    const ships = new Set(view.ships);
    for (const edge of edges) {
      const owner = view.roads[edge.id];
      if (owner === undefined) continue;
      at(edge, (edge.angle * Math.PI) / 180, () => {
        const long = hexSize * 0.48;
        const thick = hexSize * 0.1;
        draw.beginPath();
        draw.roundRect(-long / 2, -thick / 2, long, thick, thick * 0.2);
        piece(PIECE_COLOR[view.players[owner].color]);
        if (ships.has(edge.id)) {
          // a ship is a road with a pale stripe down it
          draw.fillStyle = "rgb(255 255 255 / 0.85)";
          draw.fillRect(-long / 2, -thick * 0.2, long, thick * 0.4);
        }
      });
    }

    for (const vertex of vertices) {
      const building = view.buildings[vertex.id];
      const knight = view.knights[vertex.id];
      if (building) {
        at(vertex, 0, () => {
          const half = hexSize * (building.kind === "city" ? 0.19 : 0.13);
          draw.beginPath();
          draw.roundRect(-half, -half, half * 2, half * 2, hexSize * 0.02);
          piece(PIECE_COLOR[view.players[building.player].color]);
          if (building.kind !== "city") return;
          // a city is the larger block with a pale line inside it
          draw.strokeStyle = "rgb(255 255 255 / 0.85)";
          draw.lineWidth = hexSize * 0.025;
          draw.strokeRect(-half * 0.68, -half * 0.68, half * 1.36, half * 1.36);
        });
      } else if (knight) {
        at(vertex, upright, () => {
          // asleep, a knight is faded
          draw.globalAlpha = knight.active ? 1 : 0.6;
          draw.beginPath();
          draw.arc(0, 0, hexSize * 0.17, 0, Math.PI * 2);
          piece(PIECE_COLOR[view.players[knight.player].color]);
          draw.globalAlpha = 1;
          draw.shadowColor = "#000";
          draw.shadowBlur = hexSize * 0.03;
          text(String(knight.level), hexSize * 0.01, `700 ${hexSize * 0.17}px ${HEADING}`, "#fff");
        });
      }
    }

    const spot = typeof changed === "number" ? centres[changed] : sites.get(changed ?? "");
    if (spot) {
      at(spot, 0, () => {
        draw.beginPath();
        draw.arc(0, 0, hexSize * (typeof changed === "number" ? 0.34 : 0.3), 0, Math.PI * 2);
        draw.strokeStyle = OUTLINE;
        draw.lineWidth = hexSize * 0.07;
        draw.stroke();
        draw.strokeStyle = "#ffd65a";
        draw.lineWidth = hexSize * 0.04;
        draw.stroke();
      });
    }
    draw.restore();
  };
}
