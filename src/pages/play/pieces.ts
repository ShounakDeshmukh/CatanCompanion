import cityArt from "../../assets/piece-city.svg?raw";
import knight1Art from "../../assets/piece-knight-1.svg?raw";
import knight2Art from "../../assets/piece-knight-2.svg?raw";
import knight3Art from "../../assets/piece-knight-3.svg?raw";
import roadArt from "../../assets/piece-road.svg?raw";
import settlementArt from "../../assets/piece-settlement.svg?raw";
import shipArt from "../../assets/piece-ship.svg?raw";
import type { Knight } from "../../lib/gameState";

/**
 * The players' pieces. Each is one drawing whose body is painted `currentColor`, so the same
 * picture serves every player: on the page it takes the colour of the element it sits in,
 * and for a canvas a copy is made with the colour written into it.
 */
export type PieceKind = "settlement" | "city" | "road" | "ship" | `knight-${Knight["level"]}`;

const ART: Record<PieceKind, string> = {
  settlement: settlementArt,
  city: cityArt,
  road: roadArt,
  ship: shipArt,
  "knight-1": knight1Art,
  "knight-2": knight2Art,
  "knight-3": knight3Art,
};

export const PIECE_KINDS = Object.keys(ART) as PieceKind[];

/**
 * A knight's helmet is painted by `--helm` where that is set. Asleep it is bare stone, as
 * the token's inactive face is in the box, and its base still says whose it is.
 */
export const ASLEEP_HELM = "#a8a296";

/** A piece's width and height as fractions of a hex's width. play.css sizes them to match. */
export const PIECE_SPAN: Record<PieceKind, readonly [number, number]> = {
  settlement: [0.3, 0.3],
  city: [0.42, 0.42],
  road: [0.5, 0.12],
  ship: [0.5, 0.2],
  "knight-1": [0.36, 0.36],
  "knight-2": [0.36, 0.36],
  "knight-3": [0.36, 0.36],
};

const ROOT = /^<svg ([^>]*)>/;

/** A piece on the page, drawn from the sprite and coloured by the element around it. */
export function pieceHtml(kind: PieceKind): string {
  return `<svg class="piece piece--${kind}" aria-hidden="true"><use href="#piece-${kind}"/></svg>`;
}

/**
 * Puts every piece's drawing into the page once, for {@link pieceHtml} to refer to. It is
 * shrunk to nothing instead of hidden, as some browsers will not paint a gradient that
 * lives in a hidden picture.
 */
export function mountPieceSprite(): void {
  if (document.getElementById("piece-sprite")) return;
  const symbols = PIECE_KINDS.map((kind) => {
    const viewBox = /viewBox="([^"]*)"/.exec(ART[kind])?.[1];
    return ART[kind]
      .replace(ROOT, `<symbol id="piece-${kind}" viewBox="${viewBox}">`)
      .replace(/<title>[^<]*<\/title>/, "")
      .replace(/<\/svg>\s*$/, "</symbol>");
  });
  document.body.insertAdjacentHTML(
    "beforeend",
    `<svg id="piece-sprite" width="0" height="0" style="position: absolute" aria-hidden="true">${symbols.join("")}</svg>`
  );
}

/** A piece as a picture a canvas can draw, with its player's colour written in. */
export function pieceImageUrl(kind: PieceKind, color: string, asleep: boolean = false): string {
  const helm = asleep ? ` style="--helm: ${ASLEEP_HELM}"` : "";
  const tinted = ART[kind].replace(ROOT, `<svg $1 color="${color}"${helm}>`);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(tinted)}`;
}
