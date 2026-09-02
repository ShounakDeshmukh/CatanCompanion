import "../styles/theme.css";
import "../styles/costCards.css";
import { renderNav } from "../lib/nav";
import {
  BUILDING_COSTS,
  IMPROVEMENT_TRACKS,
  type Expansion,
  type ResourceCost,
} from "../data/costs";
import { BUILDING_ICON_SVG, COMMODITY_ICON_SVG, RESOURCE_ICON_SVG } from "../assets/customIcons";

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

/**
 * Cost chip icon, colored via the --chip-color custom property. Pass colorVar to tint it
 * directly (building-cost rows mix several resources per row); omit it inside an
 * improvement-track card, where every chip shares the ancestor card's --track-color.
 */
function buildCostChip(svgMarkup: string, label: string, amount: number, colorVar?: string): HTMLElement {
  const chip = document.createElement("span");
  chip.className = "cost-chip";
  chip.title = `${amount} ${label}`;
  const icon = document.createElement("span");
  icon.className = "cost-chip__icon";
  if (colorVar) icon.style.setProperty("--chip-color", `var(${colorVar})`);
  icon.innerHTML = svgMarkup;
  const qty = document.createElement("span");
  qty.className = "cost-chip__qty";
  qty.textContent = String(amount);
  chip.append(icon, qty);
  return chip;
}

/** One chip per resource type (with a quantity), the way a real reference card prints it. */
function buildCostChips(cost: ResourceCost): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "building-row__costs";
  for (const [resource, amount] of Object.entries(cost) as [keyof ResourceCost, number][]) {
    if (!amount) continue;
    wrap.appendChild(
      buildCostChip(RESOURCE_ICON_SVG[resource], RESOURCE_LABEL[resource], amount, `--color-${resource}`)
    );
  }
  return wrap;
}

const toggles = document.getElementById("expansion-toggles") as HTMLFormElement;
const root = document.getElementById("cost-cards-root") as HTMLElement;

function activeExpansions(): Set<Expansion> {
  const checked = toggles.querySelectorAll<HTMLInputElement>("input:checked");
  return new Set(Array.from(checked).map((input) => input.value as Expansion));
}

function buildBuildingRow(item: (typeof BUILDING_COSTS)[number]): HTMLElement {
  const row = document.createElement("div");
  row.className = "building-row";

  const icon = document.createElement("div");
  icon.className = "building-row__icon";
  icon.innerHTML = BUILDING_ICON_SVG[item.id] ?? "";
  row.appendChild(icon);

  const body = document.createElement("div");
  body.className = "building-row__body";
  const name = document.createElement("div");
  name.className = "building-row__name";
  name.textContent = item.label;
  body.appendChild(name);
  if (item.note) {
    const note = document.createElement("div");
    note.className = "building-row__note";
    note.textContent = item.note;
    body.appendChild(note);
  }
  row.appendChild(body);
  row.appendChild(buildCostChips(item.cost));
  return row;
}

function buildTrackCard(track: (typeof IMPROVEMENT_TRACKS)[number]): HTMLElement {
  const card = document.createElement("div");
  card.className = "reference-card";
  card.style.setProperty("--track-color", `var(${TRACK_COLOR_VAR[track.id]})`);

  const inner = document.createElement("div");
  inner.className = "reference-card__inner";

  const header = document.createElement("div");
  header.className = "track-header";
  header.innerHTML = `
    <span class="track-header__badge">${COMMODITY_ICON_SVG[track.commodity]}</span>
    <span>
      <span class="track-header__name">${track.name}</span>
      <span class="track-header__commodity">Paid in ${track.commodity}</span>
    </span>
  `;
  inner.appendChild(header);

  for (const lvl of track.levels) {
    const row = document.createElement("div");
    row.className = "level-row";
    row.appendChild(buildCostChip(COMMODITY_ICON_SVG[track.commodity], track.commodity, lvl.cost));
    const body = document.createElement("span");
    body.innerHTML = `<span class="level-row__name">${lvl.name}</span>${
      lvl.ability ? `<span class="level-row__ability">${lvl.ability}</span>` : ""
    }`;
    row.appendChild(body);
    inner.appendChild(row);
  }

  card.appendChild(inner);
  return card;
}

function render(): void {
  const active = activeExpansions();
  root.innerHTML = "";

  const buildingSection = document.createElement("section");
  buildingSection.className = "cost-section";
  buildingSection.innerHTML = "<h2>Building Costs</h2>";

  const card = document.createElement("div");
  card.className = "reference-card reference-card--main";
  const inner = document.createElement("div");
  inner.className = "reference-card__inner";
  card.appendChild(inner);

  let lastExpansion: Expansion | null = null;
  let rowCount = 0;
  for (const item of BUILDING_COSTS) {
    if (!active.has(item.expansion)) continue;
    if (item.expansion !== lastExpansion && item.expansion !== "base") {
      const label = document.createElement("div");
      label.className = "expansion-label";
      label.textContent = EXPANSION_LABEL[item.expansion];
      inner.appendChild(label);
    }
    lastExpansion = item.expansion;
    inner.appendChild(buildBuildingRow(item));
    rowCount++;
  }

  if (rowCount > 0) {
    buildingSection.appendChild(card);
    root.appendChild(buildingSection);
  }

  if (active.has("citiesKnights")) {
    const trackSection = document.createElement("section");
    trackSection.className = "cost-section";
    trackSection.innerHTML = "<h2>City Improvements</h2>";
    const tracks = document.createElement("div");
    tracks.className = "improvement-tracks";
    for (const track of IMPROVEMENT_TRACKS) {
      tracks.appendChild(buildTrackCard(track));
    }
    trackSection.appendChild(tracks);
    root.appendChild(trackSection);
  }

  if (rowCount === 0) {
    const empty = document.createElement("p");
    empty.className = "card";
    empty.textContent = "Select at least one expansion above to see its costs.";
    root.prepend(empty);
  }
}

toggles.addEventListener("change", render);
render();
