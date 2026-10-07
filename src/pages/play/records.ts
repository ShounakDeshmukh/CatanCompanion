import { clearRecords, loadRecords, type GameRecord } from "../../lib/gameHistory";
import { saveGame } from "../../lib/gameCodec";
import { sampleGame } from "../../lib/sampleGame";
import { escapeHtml, playerTag } from "./format";
import { shareResult } from "./resultCard";

function recordHtml(record: GameRecord, index: number): string {
  const [winner] = record.players;
  const minutes = Math.max(1, Math.round((record.endedAt - record.startedAt) / 60000));
  const mostRolled = record.rolls.indexOf(Math.max(...record.rolls)) + 2;
  return `
    <details class="play-record" ${index === 0 ? "open" : ""}>
      <summary>
        ${playerTag(winner)} ${winner.points >= record.target ? "won with" : "was leading on"} ${winner.points}
        <span class="play-muted">${new Date(record.endedAt).toLocaleDateString()} · ${escapeHtml(record.board)}</span>
      </summary>
      <div class="play-table-wrap">
        <table class="play-table">
          <thead><tr><th>Player</th><th>Points</th><th>Cards</th><th>Luck</th></tr></thead>
          <tbody>
            ${record.players
              .map(
                (player) => `
              <tr>
                <th scope="row">${playerTag(player)}</th>
                <td class="play-table__total">${player.points}</td>
                <td>${player.cards}</td>
                <td>${player.luck >= 0 ? "+" : ""}${player.luck.toFixed(1)}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="play-muted">${record.turns} turns in about ${minutes} min, first to ${record.target}.
        ${record.turns > 0 ? `The dice favoured ${mostRolled}, rolled ${record.rolls[mostRolled - 2]} times.` : ""}</p>
      <button class="play-chip" data-share-record="${index}">Share result</button>
    </details>`;
}

/** Shown when there is no game: how to start one, and the results of earlier ones. */
export function renderEmpty(root: HTMLElement): void {
  const records = loadRecords();
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
    </section>
    ${
      records.length === 0
        ? ""
        : `<section class="card play-empty">
            <h2>Past games</h2>
            ${records.map(recordHtml).join("")}
            <button class="play-link" id="play-clear-records">Clear past games</button>
          </section>`
    }`;
  document.getElementById("play-sample")?.addEventListener("click", () => {
    saveGame(sampleGame());
    window.location.reload();
  });
  for (const button of root.querySelectorAll<HTMLElement>("[data-share-record]")) {
    button.addEventListener("click", () => void shareResult(records[Number(button.dataset.shareRecord)]));
  }
  document.getElementById("play-clear-records")?.addEventListener("click", () => {
    if (!confirm("Remove the record of every past game on this device?")) return;
    clearRecords();
    renderEmpty(root);
  });
}
