import type { BoardTemplate } from "./types";
import { catanBoard3to4, catanBoard5to6 } from "./base";
import { headingForNewShores3p, headingForNewShores4p } from "./seafarers/headingForNewShores";
import { fourIslands3p, fourIslands4p } from "./seafarers/fourIslands";
import { fogIslands3p, fogIslands4p } from "./seafarers/fogIslands";
import { throughTheDesert3p, throughTheDesert4p } from "./seafarers/throughTheDesert";
import { forgottenTribe } from "./seafarers/forgottenTribe";
import { clothForCatan } from "./seafarers/clothForCatan";
import { pirateIslands } from "./seafarers/pirateIslands";
import { wondersOfCatan } from "./seafarers/wondersOfCatan";
import { newWorld } from "./seafarers/newWorld";

export interface BoardEntry {
  id: string;
  label: string;
  template: BoardTemplate;
}

// More Seafarers scenario entries are added here as they're built.
export const BOARD_REGISTRY: BoardEntry[] = [
  { id: "catan-3-4", label: "Catan (3-4 players)", template: catanBoard3to4 },
  { id: "catan-5-6", label: "Catan: 5-6 Player Extension", template: catanBoard5to6 },
  // Cities & Knights uses the same board as Catan - only the rules differ.
  { id: "ck-3-4", label: "Cities & Knights (3-4 players)", template: catanBoard3to4 },
  { id: "ck-5-6", label: "Cities & Knights (5-6 players)", template: catanBoard5to6 },
  { id: "sf-heading-3p", label: "Seafarers: Heading for New Shores (3p)", template: headingForNewShores3p },
  { id: "sf-heading-4p", label: "Seafarers: Heading for New Shores (4p)", template: headingForNewShores4p },
  { id: "sf-four-islands-3p", label: "Seafarers: The Four Islands (3p)", template: fourIslands3p },
  { id: "sf-four-islands-4p", label: "Seafarers: The Four Islands (4p)", template: fourIslands4p },
  { id: "sf-fog-islands-3p", label: "Seafarers: The Fog Islands (3p)", template: fogIslands3p },
  { id: "sf-fog-islands-4p", label: "Seafarers: The Fog Islands (4p)", template: fogIslands4p },
  { id: "sf-through-desert-3p", label: "Seafarers: Through the Desert (3p)", template: throughTheDesert3p },
  { id: "sf-through-desert-4p", label: "Seafarers: Through the Desert (4p)", template: throughTheDesert4p },
  { id: "sf-forgotten-tribe", label: "Seafarers: The Forgotten Tribe", template: forgottenTribe },
  { id: "sf-cloth-for-catan", label: "Seafarers: Cloth for Catan", template: clothForCatan },
  { id: "sf-pirate-islands", label: "Seafarers: The Pirate Islands", template: pirateIslands },
  { id: "sf-wonders-of-catan", label: "Seafarers: The Wonders of Catan", template: wondersOfCatan },
  { id: "sf-new-world", label: "Seafarers: New World", template: newWorld },
];

export function getBoardEntry(id: string): BoardEntry | undefined {
  return BOARD_REGISTRY.find((entry) => entry.id === id);
}
