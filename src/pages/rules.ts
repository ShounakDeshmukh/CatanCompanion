import "../styles/theme.css";
import "../styles/rules.css";
import { renderNav } from "../lib/nav";
import { baseRules } from "../data/rules/base";
import { seafarersRules } from "../data/rules/seafarers";
import { citiesKnightsRules } from "../data/rules/citiesKnights";
import { combinedNotes } from "../data/rules/combinedNotes";
import type { Ruleset } from "../data/rules/types";

renderNav("rules");

const RULESETS: Ruleset[] = [
  baseRules,
  seafarersRules,
  citiesKnightsRules,
  {
    id: "combined",
    name: "Combining Expansions",
    tagline: "Notes for when your group plays more than one expansion together.",
    sections: combinedNotes,
  },
];

const tabsEl = document.getElementById("rules-tabs") as HTMLElement;
const rootEl = document.getElementById("rules-root") as HTMLElement;

function bodyToHtml(paragraphs: string[]): string {
  return paragraphs
    .map((p) => {
      if (!p.startsWith("- ")) return `<p>${p}</p>`;
      const items = p.slice(2).split("\n- ");
      return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
    })
    .join("");
}

function renderRuleset(ruleset: Ruleset): void {
  rootEl.innerHTML = `
    <p class="rules-tagline">${ruleset.tagline}</p>
    ${ruleset.sections
      .map(
        (section) => `
      <section class="rule-section card" style="margin-bottom: 1rem">
        <h2>${section.title}</h2>
        ${bodyToHtml(section.body)}
      </section>`
      )
      .join("")}
  `;
}

function selectTab(id: string): void {
  const ruleset = RULESETS.find((r) => r.id === id) ?? RULESETS[0];
  tabsEl.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.rulesetId === ruleset.id);
  });
  renderRuleset(ruleset);
  history.replaceState(null, "", `#${ruleset.id}`);
}

for (const ruleset of RULESETS) {
  const button = document.createElement("button");
  button.textContent = ruleset.name;
  button.dataset.rulesetId = ruleset.id;
  button.addEventListener("click", () => selectTab(ruleset.id));
  tabsEl.appendChild(button);
}

selectTab(window.location.hash.slice(1) || RULESETS[0].id);
