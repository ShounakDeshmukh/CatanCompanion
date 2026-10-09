import type { BoardEntry } from "../../data/boards/registry";
import { saveGame } from "../../lib/gameCodec";
import { rollForFirst, seatedFrom } from "../../lib/gameSetup";
import { PLAYER_COLORS, type GameState, type Player, type PlayerColor } from "../../lib/gameState";
import { NUDGE_STEPS, loadPrefs, savePrefs } from "../../lib/prefs";
import { shuffleInPlace } from "../../lib/shuffle";
import { dieHtml, escapeHtml, playerTag } from "./format";
import { cue } from "./sound";

const rollDie = () => 1 + Math.floor(Math.random() * 6);

/**
 * Rolls for who goes first and shows the table how it fell, then hands `onSettled` the
 * players in turn order once they have seen it.
 */
function renderRollOff(root: HTMLElement, table: Player[], onSettled: (players: Player[]) => void): void {
  const { rounds, first } = rollForFirst(table.length, rollDie);
  const names = (seats: number[]) => seats.map((seat) => escapeHtml(table[seat].name)).join(" and ");
  const roundsHtml = rounds.map((round, index) => {
    const again =
      index === 0
        ? ""
        : `<p class="play-muted">${names(round.map(({ seat }) => seat))} are level, and roll again.</p>`;
    const throws = round.map(
      ({ seat, dice }) =>
        `<li>${playerTag(table[seat])} ${dice.map(dieHtml).join("")}<strong>${dice[0] + dice[1]}</strong></li>`
    );
    return `${again}<ul class="play-rolloff">${throws.join("")}</ul>`;
  });
  root.innerHTML = `
    <section class="card play-setup">
      <h2>Who goes first?</h2>
      <p class="play-muted">Everyone rolls. The highest places first and takes the first turn,
        and play runs clockwise from them.</p>
      ${roundsHtml.join("")}
      <p><strong>${playerTag(table[first])} goes first.</strong></p>
      <button class="btn" id="play-begin">Start placing</button>
    </section>`;
  cue("roll");
  root.querySelector("#play-begin")?.addEventListener("click", () => onSettled(seatedFrom(table, first)));
}

/** The form that names the players, after which `onStart` is handed the game to run. */
export function renderSetup(
  root: HTMLElement,
  game: GameState,
  entry: BoardEntry,
  onStart: (game: GameState) => void
): void {
  const [minPlayers, maxPlayers] = entry.players;
  const seats = minPlayers === maxPlayers ? `${minPlayers}` : `${minPlayers} to ${maxPlayers}`;
  const defaultsToCitiesKnights = game.boardId.startsWith("ck");
  const prefs = loadPrefs();
  root.innerHTML = `
    <form class="card play-setup" id="play-setup">
      <h2>Who is playing?</h2>
      <p class="play-muted">${escapeHtml(entry.label)} is set up for ${seats} players. List them
        in the order they sit, clockwise round the table.</p>
      <div class="play-setup__players"></div>
      <div class="play-chips" ${minPlayers === maxPlayers ? "hidden" : ""}>
        <button class="play-chip" type="button" data-players="add">Add player</button>
        <button class="play-chip" type="button" data-players="remove">Remove player</button>
      </div>
      <label class="play-setup__option">
        <input type="checkbox" name="rollOff" checked /> Roll the dice for who goes first
      </label>
      <label class="play-setup__option">
        <input type="checkbox" name="shuffle" /> Randomise turn order
      </label>
      <label class="play-setup__option">
        <input type="checkbox" name="citiesKnights" ${defaultsToCitiesKnights ? "checked" : ""} />
        Cities &amp; Knights (commodities and barbarians)
      </label>
      <label class="play-setup__option">
        Points to win
        <input type="number" name="target" min="3" max="30"
          value="${defaultsToCitiesKnights ? 13 : 10}" />
      </label>
      <label class="play-setup__option">
        Nudge a turn that runs past
        <select name="nudge">
          ${NUDGE_STEPS.map(
            (minutes) =>
              `<option value="${minutes}"${minutes === prefs.nudge ? " selected" : ""}>${
                minutes === 0 ? "Never" : `${minutes} min`
              }</option>`
          ).join("")}
        </select>
      </label>
      <button class="btn" type="submit">Start</button>
    </form>`;

  const form = root.querySelector("form") as HTMLFormElement;
  const target = form.elements.namedItem("target") as HTMLInputElement;
  const citiesKnights = form.elements.namedItem("citiesKnights") as HTMLInputElement;
  citiesKnights.addEventListener("change", () => {
    target.value = citiesKnights.checked ? "13" : "10";
  });

  const rows = form.querySelector(".play-setup__players") as HTMLElement;
  const addButton = form.querySelector("[data-players=add]") as HTMLButtonElement;
  const removeButton = form.querySelector("[data-players=remove]") as HTMLButtonElement;
  const nameInputs = () => [...rows.querySelectorAll<HTMLInputElement>("input")];

  const colorSelects = () => [...rows.querySelectorAll<HTMLSelectElement>("select")];
  const start = (players: Player[]) => {
    const started: GameState = {
      ...game,
      players,
      citiesKnights: citiesKnights.checked,
      targetPoints: Number(target.value) || 10,
      startedAt: Date.now(),
    };
    saveGame(started);
    onStart(started);
  };

  function paintDot(select: HTMLSelectElement): void {
    const dot = select.previousElementSibling as HTMLElement;
    dot.style.setProperty("--player-color", `var(--player-${select.value})`);
    select.dataset.shown = select.value;
  }

  function addPlayerRow(): void {
    const seat = rows.childElementCount;
    const taken = new Set(colorSelects().map((select) => select.value));
    const free = PLAYER_COLORS.find((color) => !taken.has(color));
    rows.insertAdjacentHTML(
      "beforeend",
      `<div class="play-setup__player">
        <span class="player-dot"></span>
        <select aria-label="Player ${seat + 1} colour">
          ${PLAYER_COLORS.map(
            (color) =>
              `<option value="${color}"${color === free ? " selected" : ""}>${color[0].toUpperCase()}${color.slice(1)}</option>`
          ).join("")}
        </select>
        <input type="text" maxlength="16" autocomplete="off" placeholder="Player ${seat + 1}"
          aria-label="Player ${seat + 1} name" />
      </div>`
    );
    paintDot(colorSelects()[seat]);
  }

  // two players cannot share a colour, so picking one that is taken swaps the two over
  rows.addEventListener("change", (event) => {
    const changed = event.target as HTMLSelectElement;
    if (changed.tagName !== "SELECT") return;
    const clash = colorSelects().find((other) => other !== changed && other.value === changed.value);
    if (clash) {
      clash.value = changed.dataset.shown as string;
      paintDot(clash);
    }
    paintDot(changed);
  });

  function syncPlayerButtons(): void {
    addButton.disabled = rows.childElementCount >= maxPlayers;
    removeButton.disabled = rows.childElementCount <= minPlayers;
  }

  for (let seat = 0; seat < minPlayers; seat++) addPlayerRow();
  syncPlayerButtons();
  addButton.addEventListener("click", () => {
    addPlayerRow();
    syncPlayerButtons();
    nameInputs().at(-1)?.focus();
  });
  removeButton.addEventListener("click", () => {
    rows.lastElementChild?.remove();
    syncPlayerButtons();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    // a row left blank still means a player, so it takes the name its placeholder shows
    const colors = colorSelects();
    const players: Player[] = nameInputs().map((input, seat) => ({
      name: input.value.trim() || input.placeholder,
      color: colors[seat].value as PlayerColor,
      extraPoints: 0,
    }));
    const nudge = Number((form.elements.namedItem("nudge") as HTMLSelectElement).value);
    savePrefs({ ...prefs, nudge });
    if ((form.elements.namedItem("shuffle") as HTMLInputElement).checked) {
      shuffleInPlace(players, Math.random);
    }
    // with the dice left out, the first player listed starts
    if ((form.elements.namedItem("rollOff") as HTMLInputElement).checked) {
      renderRollOff(root, players, start);
    } else {
      start(players);
    }
  });
}
