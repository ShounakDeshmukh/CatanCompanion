import grainArt from "../../assets/parchment.webp";
import type { CatanBoard } from "../../data/boards/types";
import type { GameRecord } from "../../lib/gameHistory";
import type { Award, GameState, PlayerColor } from "../../lib/gameState";
import type { BoardView } from "../../lib/replay";
import { SITE_URL } from "../../lib/site";
import {
  BODY,
  HEADING,
  INK,
  PIECE_COLOR,
  boardPainter,
  loadImage,
  type BoardPainter,
  type Mark,
} from "./boardCanvas";

/** Four by five, the tallest picture feeds and chat apps show whole. */
const WIDTH = 1080;
const HEIGHT = 1350;
const MUTED = "#6b5738";

const GRAIN_SCALE = 2.5;
const GOLD = "#e3b23c";
const AWARD_NAME: Record<Award, string> = {
  longestRoad: "Longest Road",
  largestArmy: "Largest Army",
};

/** The board starts under the heading and the standings end above the closing lines. */
const BOARD_TOP = 262;
const STANDINGS_END = 1146;
const ROW_STEP = 60;
/** The most the rows may spread over, which is what six players are fitted into. */
const ROWS_SPAN = 200;
/** From the foot of the board to the first row: a gap, then the column headings. */
const STANDINGS_HEAD = 88;

/** What the card is drawn with, once it has all loaded. */
export interface CardArt {
  paintBoard: BoardPainter;
  /** The grain of the site's parchment, tiled over the sheet. */
  grain: HTMLImageElement;
}

/**
 * Loads everything a card of this board needs, with the pieces in the colours at the table.
 * The fonts are waited for too: text drawn before a web font has loaded falls back for good.
 */
export async function cardArt(board: CatanBoard, colors: PlayerColor[]): Promise<CardArt> {
  const [paintBoard, grain] = await Promise.all([
    boardPainter(board, colors),
    loadImage(grainArt),
    document.fonts.load(`700 64px ${HEADING}`),
    document.fonts.load(`400 40px ${BODY}`),
    document.fonts.load(`700 40px ${BODY}`),
  ]);
  return { paintBoard, grain };
}

/** A canvas the card fits at `scale`, set up so the card can be drawn at its full size. */
export function cardCanvas(scale: number = 1): { canvas: HTMLCanvasElement; draw: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * scale;
  canvas.height = HEIGHT * scale;
  // the replay reads every frame back, which this keeps off the graphics card
  const draw = canvas.getContext("2d", { willReadFrequently: scale !== 1 });
  if (!draw) throw new Error("This browser cannot draw the result");
  draw.scale(scale, scale);
  return { canvas, draw };
}

/** A crown for the winner: three points on a band, `size` across, its top left at x and y. */
function drawCrown(draw: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const points = [
    [0, 0.25],
    [0.27, 0.55],
    [0.5, 0],
    [0.73, 0.55],
    [1, 0.25],
    [0.9, 0.85],
    [0.1, 0.85],
  ];
  draw.beginPath();
  for (const [across, down] of points) draw.lineTo(x + across * size, y + down * size);
  draw.closePath();
  draw.fillStyle = GOLD;
  draw.fill();
  draw.strokeStyle = INK;
  draw.lineWidth = 2;
  draw.lineJoin = "round";
  draw.stroke();
}

/** The parts of the card that differ from one frame of the replay to the next. */
export interface Scene {
  headline: string;
  view: BoardView;
  mark?: Mark;
  /** The standings to show, in the order the game finished in. */
  players: GameRecord["players"];
  /** The seat of whoever won, once that is being said. */
  crowned?: number;
}

/** The card as it is shared on its own: who won, the final board and the final scores. */
export function finalScene(record: GameRecord, state: GameState): Scene {
  const [winner] = record.players;
  const won = winner.points >= record.target;
  return {
    headline: `${winner.name} ${won ? "wins" : "leads"}`,
    view: state,
    players: record.players,
    crowned: won ? winner.seat : undefined,
  };
}

/**
 * Draws a finished game's card around one scene of it. The standings sit at the foot of the
 * sheet and the board takes whatever is left above them, so a table of three gets a larger
 * board than a table of six. A GIF has too few colours for the sheet's gradient and grain,
 * which come out in bands and speckle, so `flat` gives the replay a plain sheet.
 */
export function drawResultCard(
  draw: CanvasRenderingContext2D,
  record: GameRecord,
  { paintBoard, grain }: CardArt,
  scene: Scene,
  flat: boolean = false
): void {
  draw.fillStyle = "#3c2416";
  draw.fillRect(0, 0, WIDTH, HEIGHT);
  const sheet = draw.createLinearGradient(0, 0, WIDTH, HEIGHT);
  sheet.addColorStop(0, "#f6ecce");
  sheet.addColorStop(0.55, "#e2cc98");
  sheet.addColorStop(1, "#c9ab70");
  draw.fillStyle = flat ? "#e6d3a3" : sheet;
  draw.beginPath();
  draw.roundRect(36, 36, WIDTH - 72, HEIGHT - 72, 28);
  draw.fill();
  const texture = flat ? null : draw.createPattern(grain, "repeat");
  if (texture) {
    // the grain is made for the page, and a card is looked at from further off
    texture.setTransform(new DOMMatrix().scale(GRAIN_SCALE));
    draw.fillStyle = texture;
    draw.fill();
  }
  draw.strokeStyle = "rgb(43 28 16 / 0.35)";
  draw.lineWidth = 2;
  draw.beginPath();
  draw.roundRect(58, 58, WIDTH - 116, HEIGHT - 116, 16);
  draw.stroke();

  const text = (value: string, x: number, y: number, font: string, color = INK, align: CanvasTextAlign = "left") => {
    draw.font = font;
    draw.fillStyle = color;
    draw.textAlign = align;
    draw.textBaseline = "alphabetic";
    draw.fillText(value, x, y);
  };

  const { headline, players } = scene;
  const minutes = Math.max(1, Math.round((record.endedAt - record.startedAt) / 60000));
  text("CATAN COMPANION", WIDTH / 2, 118, `700 30px ${HEADING}`, MUTED, "center");
  draw.font = `700 76px ${HEADING}`;
  // a long name is set smaller rather than run off the sheet
  const size = Math.min(76, (76 * (WIDTH - 200)) / draw.measureText(headline).width);
  text(headline, WIDTH / 2, 196, `700 ${size}px ${HEADING}`, INK, "center");
  text(
    `${record.board} · ${new Date(record.endedAt).toLocaleDateString()}`,
    WIDTH / 2,
    242,
    `400 32px ${BODY}`,
    MUTED,
    "center"
  );

  // six players share the room four have, so their rows are set closer and smaller
  const step = Math.min(ROW_STEP, ROWS_SPAN / (players.length - 1));
  const fit = step / ROW_STEP;
  const top = STANDINGS_END - (players.length - 1) * step;
  const board = { x: 80, y: BOARD_TOP, width: WIDTH - 160, height: top - STANDINGS_HEAD - BOARD_TOP };
  paintBoard(draw, scene.view, board, scene.mark);

  text("POINTS", 990, top - 48, `700 22px ${BODY}`, MUTED, "right");
  players.forEach((player, place) => {
    const y = top + place * step;
    draw.strokeStyle = "rgb(43 28 16 / 0.15)";
    draw.lineWidth = 2;
    draw.beginPath();
    draw.moveTo(96, y - 42 * fit);
    draw.lineTo(WIDTH - 96, y - 42 * fit);
    draw.stroke();

    draw.fillStyle = PIECE_COLOR[player.color];
    draw.strokeStyle = INK;
    draw.lineWidth = 3;
    draw.beginPath();
    draw.arc(120, y - 13 * fit, 15 * fit, 0, Math.PI * 2);
    draw.fill();
    draw.stroke();

    text(player.name, 156, y, `600 ${42 * fit}px ${BODY}`);
    if (player.seat === scene.crowned) {
      drawCrown(draw, 156 + draw.measureText(player.name).width + 16 * fit, y - 30 * fit, 30 * fit);
    }
    text(String(player.points), 990, y, `700 ${46 * fit}px ${HEADING}`, INK, "right");

    // what the player holds is set out leftwards from the points, the way a table would lay
    // the award cards beside them
    let right = 890;
    for (const award of player.awards) {
      draw.font = `700 ${24 * fit}px ${BODY}`;
      const wide = draw.measureText(AWARD_NAME[award]).width + 28 * fit;
      const tall = 36 * fit;
      draw.beginPath();
      draw.roundRect(right - wide, y - 13 * fit - tall / 2, wide, tall, tall / 2);
      draw.fillStyle = GOLD;
      draw.fill();
      draw.strokeStyle = INK;
      draw.lineWidth = 2;
      draw.stroke();
      text(AWARD_NAME[award], right - wide / 2, y - 5 * fit, draw.font, INK, "center");
      right -= wide + 12 * fit;
    }
  });

  const mostRolled = record.rolls.indexOf(Math.max(...record.rolls)) + 2;
  const lines = [
    `${record.turns} turns in about ${minutes} ${minutes === 1 ? "minute" : "minutes"}, first to ${record.target}`,
  ];
  if (record.turns > 0) {
    lines.push(`The dice favoured ${mostRolled}, rolled ${record.rolls[mostRolled - 2]} times`);
  }
  lines.forEach((line, index) => text(line, WIDTH / 2, 1196 + index * 40, `400 31px ${BODY}`, INK, "center"));
  text(SITE_URL.replace(/^https:\/\/|\/$/g, ""), WIDTH / 2, 1276, `400 25px ${BODY}`, MUTED, "center");
}
