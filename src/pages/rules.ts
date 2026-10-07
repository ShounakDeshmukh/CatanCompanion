import "../styles/theme.css";
import "../styles/rules.css";
import { renderNav } from "../lib/nav";
import { baseRules } from "../data/rules/base";
import { seafarersRules } from "../data/rules/seafarers";
import { citiesKnightsRules } from "../data/rules/citiesKnights";
import { combinedNotes } from "../data/rules/combinedNotes";
import type { RuleSection, Ruleset } from "../data/rules/types";
import { highlight, queryWords, searchRules } from "../lib/rulesSearch";

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
const searchEl = document.getElementById("rules-search") as HTMLInputElement;

/** A section's address: `#base/robber`. The rule set alone, `#base`, opens its tab. */
const sectionHash = (ruleset: Ruleset, section: RuleSection) => `#${ruleset.id}/${section.id}`;
const sectionDomId = (ruleset: Ruleset, section: RuleSection) => `${ruleset.id}-${section.id}`;

function bodyToHtml(paragraphs: string[], words: string[]): string {
  return paragraphs
    .map((p) => {
      if (!p.startsWith("- ")) return `<p>${highlight(p, words)}</p>`;
      const items = p.slice(2).split("\n- ");
      return `<ul>${items.map((item) => `<li>${highlight(item, words)}</li>`).join("")}</ul>`;
    })
    .join("");
}

function sectionHtml(ruleset: Ruleset, section: RuleSection, words: string[], from = ""): string {
  return `
    <section class="rule-section card" id="${sectionDomId(ruleset, section)}">
      ${from ? `<p class="rule-section__from">${from}</p>` : ""}
      <h2>
        ${highlight(section.title, words)}
        <a class="rule-section__link" href="${sectionHash(ruleset, section)}"
          aria-label="Link to ${section.title}">#</a>
      </h2>
      ${bodyToHtml(section.body, words)}
    </section>`;
}

function renderRuleset(ruleset: Ruleset): void {
  rootEl.innerHTML = `
    <p class="rules-tagline">${ruleset.tagline}</p>
    <nav class="rules-contents" aria-label="Sections">
      ${ruleset.sections
        .map((section) => `<a href="${sectionHash(ruleset, section)}">${section.title}</a>`)
        .join("")}
    </nav>
    ${ruleset.sections.map((section) => sectionHtml(ruleset, section, [])).join("")}`;
}

function renderSearch(query: string): void {
  const words = queryWords(query);
  const matches = searchRules(RULESETS, query);
  const count = matches.length === 1 ? "1 section" : `${matches.length} sections`;
  rootEl.innerHTML = `
    <p class="rules-tagline">${count} across all the rules mention this.</p>
    ${matches
      .map(({ ruleset, section }) => sectionHtml(ruleset, section, words, ruleset.name))
      .join("")}`;
}

function markTab(id: string | undefined): void {
  tabsEl.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.rulesetId === id);
  });
}

/** Shows whatever the address bar names, which is what makes section links shareable. */
function showFromHash(): void {
  const [rulesetId, sectionId] = window.location.hash.slice(1).split("/");
  const ruleset = RULESETS.find((r) => r.id === rulesetId) ?? RULESETS[0];
  searchEl.value = "";
  markTab(ruleset.id);
  renderRuleset(ruleset);

  const section = ruleset.sections.find((s) => s.id === sectionId);
  if (section) document.getElementById(sectionDomId(ruleset, section))?.scrollIntoView();
}

for (const ruleset of RULESETS) {
  const button = document.createElement("button");
  button.textContent = ruleset.name;
  button.dataset.rulesetId = ruleset.id;
  button.addEventListener("click", () => {
    // setting the same hash again fires no event, so draw directly in that case
    if (window.location.hash === `#${ruleset.id}`) showFromHash();
    else window.location.hash = ruleset.id;
  });
  tabsEl.appendChild(button);
}

searchEl.addEventListener("input", () => {
  if (searchEl.value.trim() === "") {
    showFromHash();
    return;
  }
  // a search runs across every rule set, so no one tab is the current one
  markTab(undefined);
  renderSearch(searchEl.value);
});

window.addEventListener("hashchange", showFromHash);
showFromHash();
