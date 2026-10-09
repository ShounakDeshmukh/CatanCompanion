import type { CatanBoard } from "../../data/boards/types";
import { summarize } from "../../lib/gameHistory";
import type { GameState, PlayerColor } from "../../lib/gameState";
import { replay } from "../../lib/replay";
import { SITE_URL } from "../../lib/site";
import { playerTag } from "./format";
import { replayGif } from "./replayGif";
import { cardArt, cardCanvas, drawResultCard, finalScene } from "./resultCard";

/** Hands a file to the phone's share sheet where there is one, and saves it otherwise. */
async function shareFile(file: File): Promise<void> {
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
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(link.href);
}

const CONFETTI_PIECES = 80;
const CONFETTI_MS = 5000;

/** Showers the page with confetti, mostly in the winner's colour, and clears it away after. */
function celebrate(color: PlayerColor): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const between = (low: number, high: number) => low + Math.random() * (high - low);
  const paints = [`var(--player-${color})`, `var(--player-${color})`, "#e9b949", "var(--parchment-light)"];
  const shower = document.createElement("div");
  shower.className = "confetti";
  shower.setAttribute("aria-hidden", "true");
  shower.innerHTML = Array.from(
    { length: CONFETTI_PIECES },
    (_, piece) =>
      `<i style="left: ${between(0, 100)}%; background: ${paints[piece % paints.length]};
        --drift: ${between(-12, 12)}vw; --spin: ${between(-900, 900)}deg;
        animation-delay: ${between(0, 900)}ms; animation-duration: ${between(2200, 3800)}ms"></i>`
  ).join("");
  document.body.appendChild(shower);
  setTimeout(() => shower.remove(), CONFETTI_MS);
}

/**
 * What a finished game leaves behind: a card with the final board on it, and a replay of
 * how the board was built. Both are made here from the game as it ended and are kept
 * nowhere, so they are there to be shared or saved until the page is left.
 *
 * The card is drawn before the page is touched, and the promise rejects if it cannot be, so
 * the caller still has the game on screen. It resolves once the card is showing; the replay
 * follows on its own.
 */
export async function renderResult(
  root: HTMLElement,
  state: GameState,
  board: CatanBoard,
  boardLabel: string
): Promise<void> {
  const record = summarize(state, boardLabel);
  const art = await cardArt(board);
  const { canvas, draw } = cardCanvas();
  drawResultCard(draw, record, art, finalScene(record, state));
  const picture = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!picture) throw new Error("This browser cannot save the result as a picture");

  const [winner] = record.players;
  const won = winner.points >= record.target;
  // a viewer's page hides the controls of a game in play, which these are not
  root.classList.remove("play--viewing");
  root.innerHTML = `
    <section class="card play-empty">
      <h2>${playerTag(winner)} ${won ? "wins" : "was leading"}</h2>
      <p class="play-muted">The result is not kept on this device, so share or save it before
        leaving the page.</p>
      <div class="play-chips">
        <button class="btn" id="play-share-picture">Share picture</button>
        <button class="btn btn-secondary" id="play-share-replay" disabled>Making the replay…</button>
        <a class="btn btn-secondary" href="./map-generator.html">New game</a>
      </div>
      <img class="play-card" id="play-card" alt="The result card, with the board as the game ended" hidden />
    </section>`;
  const card = root.querySelector("#play-card") as HTMLImageElement;
  // the result lives only on this page, so leaving before any of it has been taken asks first
  const warn = (event: BeforeUnloadEvent) => event.preventDefault();
  window.addEventListener("beforeunload", warn);
  // The files are made ahead of the tap: a share sheet only opens straight from one.
  const offer = (id: string, label: string, blob: Blob, name: string) => {
    const button = root.querySelector(id) as HTMLButtonElement;
    const file = new File([blob], name, { type: blob.type });
    button.textContent = label;
    button.disabled = false;
    button.addEventListener("click", () => {
      window.removeEventListener("beforeunload", warn);
      void shareFile(file);
    });
    card.src = URL.createObjectURL(blob);
    card.hidden = false;
  };

  offer("#play-share-picture", "Share picture", picture, "catan-result.png");
  // a game stopped early has a leader, which is not the same as a winner
  if (won) celebrate(winner.color);

  const moments = replay(state);
  const noReplay = () => root.querySelector("#play-share-replay")?.remove();
  // a board nothing was ever put on has no story to play back
  if (moments.length < 2) {
    noReplay();
    return;
  }
  // the picture stands on its own, so a replay that cannot be made is simply not offered
  void replayGif(record, art, moments).then(
    (film) => offer("#play-share-replay", "Share replay", film, "catan-replay.gif"),
    noReplay
  );
}
