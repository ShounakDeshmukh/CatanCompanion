import { saveGame } from "../../lib/gameCodec";
import { sampleGame } from "../../lib/sampleGame";

/** Shown when there is no game: how to start one. */
export function renderEmpty(root: HTMLElement): void {
  root.innerHTML = `
    <section class="card play-empty">
      <h2>No game in progress</h2>
      <p>Pick a board, lay it out on the table, then press <strong>Start game</strong>.</p>
      <div class="play-chips">
        <a class="btn" href="./map-generator.html">Choose a board</a>
        <button class="btn btn-secondary" id="play-sample">Try a sample game</button>
      </div>
      <p class="play-muted">The sample is a three-player game a few rounds in. Tap a roll to
        see who collects, then end it whenever you like.</p>
    </section>`;
  document.getElementById("play-sample")?.addEventListener("click", () => {
    saveGame(sampleGame());
    window.location.reload();
  });
}
