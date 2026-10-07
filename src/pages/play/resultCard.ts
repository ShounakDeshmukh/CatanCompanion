import type { GameRecord } from "../../lib/gameHistory";
import { SITE_URL } from "../../lib/site";

const SIZE = 1080;
const INK = "#2b1c10";
const MUTED = "#6b5738";
const HEADING = '"Cinzel", Georgia, serif';
const BODY = '"Crimson Pro", Georgia, serif';

/** The colours of the pieces, as play.css has them; a canvas cannot read the stylesheet. */
const PIECE_COLOR: Record<GameRecord["players"][number]["color"], string> = {
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

/** Draws a finished game as a square picture, the size chat apps and feeds show whole. */
export async function drawResultCard(record: GameRecord): Promise<HTMLCanvasElement> {
  // text drawn before a web font has loaded falls back for good, so wait for both
  await Promise.all([
    document.fonts.load(`700 64px ${HEADING}`),
    document.fonts.load(`400 40px ${BODY}`),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const draw = canvas.getContext("2d");
  if (!draw) throw new Error("This browser cannot draw the result");

  draw.fillStyle = "#3c2416";
  draw.fillRect(0, 0, SIZE, SIZE);
  const sheet = draw.createLinearGradient(0, 0, SIZE, SIZE);
  sheet.addColorStop(0, "#f6ecce");
  sheet.addColorStop(0.55, "#e2cc98");
  sheet.addColorStop(1, "#c9ab70");
  draw.fillStyle = sheet;
  draw.beginPath();
  draw.roundRect(36, 36, SIZE - 72, SIZE - 72, 28);
  draw.fill();
  draw.strokeStyle = "rgb(43 28 16 / 0.35)";
  draw.lineWidth = 2;
  draw.beginPath();
  draw.roundRect(58, 58, SIZE - 116, SIZE - 116, 16);
  draw.stroke();

  const text = (value: string, x: number, y: number, font: string, color = INK, align: CanvasTextAlign = "left") => {
    draw.font = font;
    draw.fillStyle = color;
    draw.textAlign = align;
    draw.fillText(value, x, y);
  };

  const [winner] = record.players;
  const minutes = Math.max(1, Math.round((record.endedAt - record.startedAt) / 60000));
  text("CATAN COMPANION", SIZE / 2, 140, `700 34px ${HEADING}`, MUTED, "center");
  const verb = winner.points >= record.target ? "wins" : "leads";
  text(`${winner.name} ${verb}`, SIZE / 2, 250, `700 92px ${HEADING}`, INK, "center");
  text(
    `${record.board} · ${new Date(record.endedAt).toLocaleDateString()}`,
    SIZE / 2,
    312,
    `400 36px ${BODY}`,
    MUTED,
    "center"
  );

  const top = 400;
  const step = Math.min(96, 480 / record.players.length);
  text("POINTS", 760, top - 30, `700 24px ${BODY}`, MUTED, "right");
  text("CARDS", 880, top - 30, `700 24px ${BODY}`, MUTED, "right");
  text("LUCK", 990, top - 30, `700 24px ${BODY}`, MUTED, "right");
  record.players.forEach((player, place) => {
    const y = top + 44 + place * step;
    draw.strokeStyle = "rgb(43 28 16 / 0.15)";
    draw.beginPath();
    draw.moveTo(96, y - 56);
    draw.lineTo(SIZE - 96, y - 56);
    draw.stroke();

    draw.fillStyle = PIECE_COLOR[player.color];
    draw.strokeStyle = INK;
    draw.lineWidth = 3;
    draw.beginPath();
    draw.arc(120, y - 16, 18, 0, Math.PI * 2);
    draw.fill();
    draw.stroke();

    text(player.name, 160, y, `600 50px ${BODY}`);
    text(String(player.points), 760, y, `700 60px ${HEADING}`, INK, "right");
    text(String(player.cards), 880, y, `400 44px ${BODY}`, MUTED, "right");
    text(`${player.luck >= 0 ? "+" : ""}${player.luck.toFixed(1)}`, 990, y, `400 44px ${BODY}`, MUTED, "right");
  });

  const luckiest = record.players.reduce((best, player) => (player.luck > best.luck ? player : best));
  const mostRolled = record.rolls.indexOf(Math.max(...record.rolls)) + 2;
  const lines = [`${record.turns} turns in about ${minutes} minutes, first to ${record.target}`];
  if (record.turns > 0) {
    lines.push(`The dice favoured ${mostRolled}, and ${luckiest.name} had the luck`);
  }
  lines.forEach((line, index) => text(line, SIZE / 2, 900 + index * 48, `400 36px ${BODY}`, INK, "center"));
  text(SITE_URL.replace(/^https:\/\/|\/$/g, ""), SIZE / 2, 1010, `400 28px ${BODY}`, MUTED, "center");

  return canvas;
}

/** Hands the picture to the phone's share sheet where there is one, and saves it otherwise. */
export async function shareResult(record: GameRecord): Promise<void> {
  const canvas = await drawResultCard(record);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  const file = new File([blob], "catan-result.png", { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Catan result", text: SITE_URL });
      return;
    } catch (error) {
      // closing the share sheet is not a failure; anything else falls through to a download
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(link.href);
}
