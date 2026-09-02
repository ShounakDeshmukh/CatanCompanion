import "../styles/theme.css";
import "../styles/costCards.css";
import { renderNav } from "../lib/nav";
import {
  BUILDING_COSTS,
  IMPROVEMENT_TRACKS,
  type Commodity,
  type Expansion,
  type ResourceCost,
} from "../data/costs";
import { COMMODITY_ICON, RESOURCE_ICON } from "../assets/icons/index";

renderNav("cost-cards");

const RESOURCE_LABEL: Record<keyof ResourceCost, string> = {
  brick: "Brick",
  wood: "Wood",
  wool: "Wool",
  wheat: "Wheat",
  ore: "Ore",
};

const TRACK_COLOR_VAR: Record<string, string> = {
  science: "--color-paper",
  trade: "--color-cloth",
  politics: "--color-coin",
};

const EXPANSION_LABEL: Record<Expansion, string> = {
  base: "Base",
  seafarers: "Seafarers",
  citiesKnights: "Cities & Knights",
};

const toggles = document.getElementById("expansion-toggles") as HTMLFormElement;
const root = document.getElementById("cost-cards-root") as HTMLElement;

function activeExpansions(): Set<Expansion> {
  const checked = toggles.querySelectorAll<HTMLInputElement>("input:checked");
  return new Set(Array.from(checked).map((input) => input.value as Expansion));
}

/** One token per unit, the way the cost is printed on a real card. */
function buildTokenRow(cost: ResourceCost): HTMLElement {
  const row = document.createElement("div");
  row.className = "token-row";
  for (const [resource, amount] of Object.entries(cost) as [keyof ResourceCost, number][]) {
    for (let i = 0; i < amount; i++) {
      const token = document.createElement("img");
      token.className = "token";
      token.src = RESOURCE_ICON[resource];
      token.alt = i === 0 ? `${amount} ${RESOURCE_LABEL[resource]}` : "";
      token.title = `${amount} ${RESOURCE_LABEL[resource]}`;
      row.appendChild(token);
    }
  }
  return row;
}

function buildCommodityRow(commodity: Commodity, amount: number): HTMLElement {
  const row = document.createElement("span");
  row.className = "token-row token-row--inline";
  for (let i = 0; i < amount; i++) {
    const token = document.createElement("img");
    token.className = "token token--small";
    token.src = COMMODITY_ICON[commodity];
    token.alt = i === 0 ? `${amount} ${commodity}` : "";
    row.appendChild(token);
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
    const card = document.createElement("article");
    card.className = `cost-card cost-card--${item.expansion}`;
    card.innerHTML = `
      <header class="cost-card__head">
        <h3 class="cost-card__label">${item.label}</h3>
        <span class="cost-card__tag">${EXPANSION_LABEL[item.expansion]}</span>
      </header>
      ${item.note ? `<p class="cost-card__note">${item.note}</p>` : ""}
    `;
    card.appendChild(buildTokenRow(item.cost));
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
      trackEl.className = "improvement-track";
      trackEl.style.setProperty("--track-color", `var(${TRACK_COLOR_VAR[track.id]})`);
      trackEl.innerHTML = `
        <header class="improvement-track__head">
          <img class="token token--head" src="${COMMODITY_ICON[track.commodity]}" alt="" />
          <div>
            <h3>${track.name}</h3>
            <div class="improvement-track__commodity">Paid in ${track.commodity}</div>
          </div>
        </header>
      `;
      for (const lvl of track.levels) {
        const row = document.createElement("div");
        row.className = "improvement-level";
        const cost = document.createElement("span");
        cost.className = "improvement-level__cost";
        cost.appendChild(buildCommodityRow(track.commodity, lvl.cost));
        row.appendChild(cost);
        const body = document.createElement("span");
        body.innerHTML = `<span class="improvement-level__name">${lvl.name}</span>${
          lvl.ability ? `<span class="improvement-level__ability">${lvl.ability}</span>` : ""
        }`;
        row.appendChild(body);
        trackEl.appendChild(row);
      }
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
