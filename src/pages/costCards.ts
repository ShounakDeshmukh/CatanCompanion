import "../styles/theme.css";
import "../styles/costCards.css";
import { renderNav } from "../lib/nav";
import { BUILDING_COSTS, IMPROVEMENT_TRACKS, type Expansion, type ResourceCost } from "../data/costs";

renderNav("cost-cards");

const RESOURCE_LABEL: Record<keyof ResourceCost, string> = {
  brick: "Brick",
  wood: "Wood",
  wool: "Wool",
  wheat: "Wheat",
  ore: "Ore",
};

const RESOURCE_COLOR_VAR: Record<keyof ResourceCost, string> = {
  brick: "--color-brick",
  wood: "--color-wood",
  wool: "--color-wool",
  wheat: "--color-wheat",
  ore: "--color-ore",
};

const TRACK_COLOR_VAR: Record<string, string> = {
  science: "--color-paper",
  trade: "--color-cloth",
  politics: "--color-coin",
};

const toggles = document.getElementById("expansion-toggles") as HTMLFormElement;
const root = document.getElementById("cost-cards-root") as HTMLElement;

function activeExpansions(): Set<Expansion> {
  const checked = toggles.querySelectorAll<HTMLInputElement>("input:checked");
  return new Set(Array.from(checked).map((input) => input.value as Expansion));
}

function buildPipRow(cost: ResourceCost): HTMLElement {
  const row = document.createElement("div");
  row.className = "pip-row";
  for (const [resource, amount] of Object.entries(cost) as [keyof ResourceCost, number][]) {
    const pip = document.createElement("span");
    pip.className = "pip";
    pip.style.setProperty("--pip-color", `var(${RESOURCE_COLOR_VAR[resource]})`);
    pip.textContent = `${amount} ${RESOURCE_LABEL[resource]}`;
    row.appendChild(pip);
  }
  return row;
}

function render(): void {
  const active = activeExpansions();
  root.innerHTML = "";

  const buildingSection = document.createElement("section");
  buildingSection.className = "cost-section";
  buildingSection.innerHTML = "<h2>Building Costs</h2>";
  const grid = document.createElement("div");
  grid.className = "cost-grid";

  for (const item of BUILDING_COSTS) {
    if (!active.has(item.expansion)) continue;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="cost-card__label">${item.label}</div>
      ${item.note ? `<div class="cost-card__note">${item.note}</div>` : ""}
    `;
    card.appendChild(buildPipRow(item.cost));
    grid.appendChild(card);
  }
  buildingSection.appendChild(grid);
  root.appendChild(buildingSection);

  if (active.has("citiesKnights")) {
    const trackSection = document.createElement("section");
    trackSection.className = "cost-section";
    trackSection.innerHTML = "<h2>City Improvements</h2>";
    const tracks = document.createElement("div");
    tracks.className = "improvement-tracks";

    for (const track of IMPROVEMENT_TRACKS) {
      const trackEl = document.createElement("div");
      trackEl.className = "improvement-track card";
      trackEl.style.setProperty("--track-color", `var(${TRACK_COLOR_VAR[track.id]})`);
      trackEl.innerHTML = `
        <h3>${track.name}</h3>
        <div class="improvement-track__commodity">Paid in ${track.commodity}</div>
        ${track.levels
          .map(
            (lvl) => `
          <div class="improvement-level">
            <span class="improvement-level__cost">${lvl.cost}x</span>
            <span>
              <span class="improvement-level__name">${lvl.name}</span>
              ${lvl.ability ? `<span class="improvement-level__ability">${lvl.ability}</span>` : ""}
            </span>
          </div>`
          )
          .join("")}
      `;
      tracks.appendChild(trackEl);
    }
    trackSection.appendChild(tracks);
    root.appendChild(trackSection);
  }

  if (root.children.length === 0 || grid.children.length === 0) {
    const empty = document.createElement("p");
    empty.className = "card";
    empty.textContent = "Select at least one expansion above to see its costs.";
    root.prepend(empty);
  }
}

toggles.addEventListener("change", render);
render();
