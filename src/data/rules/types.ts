export interface RuleSection {
  id: string;
  title: string;
  /** Paragraphs; a paragraph starting with "- " renders as a bullet. */
  body: string[];
}

export interface Ruleset {
  id: string;
  name: string;
  tagline: string;
  sections: RuleSection[];
}
