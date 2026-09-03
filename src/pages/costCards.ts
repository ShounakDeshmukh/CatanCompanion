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
  wool: "Sheep",
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

/** A single labeled chip with a quantity badge, used where the count still needs calling out. */
function buildCostChip(svgMarkup: string, label: string, amount: number): HTMLElement {
  const chip = document.createElement("span");
  chip.className = "cost-chip";
  chip.title = `${amount} ${label}`;
  const icon = document.createElement("span");
  icon.className = "cost-chip__icon";
  icon.innerHTML = svgMarkup;
  const qty = document.createElement("span");
  qty.className = "cost-chip__qty";
  qty.textContent = String(amount);
  chip.append(icon, qty);
  return chip;
}

/** One icon token per unit of cost - brick x2 prints as two brick tokens, not "brick x2". */
function showResourcePopover(resource: keyof ResourceCost, anchor: HTMLElement): void {
  const existing = document.querySelector(".resource-popover");
  if (existing) {
    existing.remove();
  }

  const label = RESOURCE_LABEL[resource];
  const popover = document.createElement("div");
  popover.className = "resource-popover";
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-live", "polite");
  popover.innerHTML = `
    <div class="resource-popover__inner">
      <div class="resource-popover__title">${label}</div>
    </div>
  `;

  document.body.appendChild(popover);

  const anchorRect = anchor.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  const left = anchorRect.left + anchorRect.width / 2;
  const top = anchorRect.top;

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.style.transform = `translate(-50%, calc(-100% - 12px))`;

  if (popoverRect.width > window.innerWidth - 24) {
    popover.style.left = `${window.innerWidth / 2}px`;
  }

  const close = (event?: MouseEvent | KeyboardEvent): void => {
    const target = event?.target as Node | null;
    if (target && popover.contains(target)) {
      return;
    }
    popover.remove();
    document.removeEventListener("click", close);
    document.removeEventListener("keydown", close);
    window.clearTimeout(autoHideTimer);
  };

  const autoHideTimer = window.setTimeout(() => {
    popover.remove();
    document.removeEventListener("click", close);
    document.removeEventListener("keydown", close);
  }, 1500);

  document.addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      popover.remove();
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
      window.clearTimeout(autoHideTimer);
    }
  });
}

function buildCostTokens(cost: ResourceCost): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "building-row__costs";
  for (const [resource, amount] of Object.entries(cost) as [keyof ResourceCost, number][]) {
    for (let i = 0; i < amount; i++) {
      const token = document.createElement("button");
      token.type = "button";
      token.className = "cost-token resource-token";
      token.title = RESOURCE_LABEL[resource];
      token.style.setProperty("--chip-color", `var(--color-${resource})`);
      token.innerHTML = RESOURCE_ICON_SVG[resource];
      token.addEventListener("click", (event) => {
        event.stopPropagation();
        showResourcePopover(resource, token);
      });
      wrap.appendChild(token);
    }
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
  row.appendChild(buildCostTokens(item.cost));
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
