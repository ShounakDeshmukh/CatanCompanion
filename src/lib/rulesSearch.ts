import type { RuleSection, Ruleset } from "../data/rules/types";

export interface RuleMatch {
  ruleset: Ruleset;
  section: RuleSection;
}

/** The words of a query, lower-cased. An empty list means there is nothing to search for. */
export function queryWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Sections containing every word of the query, in their title or anywhere in their text. */
export function searchRules(rulesets: Ruleset[], query: string): RuleMatch[] {
  const words = queryWords(query);
  if (words.length === 0) return [];
  return rulesets.flatMap((ruleset) =>
    ruleset.sections
      .filter((section) => {
        const text = `${section.title}\n${section.body.join("\n")}`.toLowerCase();
        return words.every((word) => text.includes(word));
      })
      .map((section) => ({ ruleset, section }))
  );
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string
  );
}

/** `text` as HTML, with each occurrence of a query word wrapped in a mark element. */
export function highlight(text: string, words: string[]): string {
  if (words.length === 0) return escapeHtml(text);
  const pattern = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  // a capturing split keeps the matches, which land at the odd positions
  return text
    .split(new RegExp(`(${pattern})`, "gi"))
    .map((part, index) => (index % 2 === 1 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)))
    .join("");
}
