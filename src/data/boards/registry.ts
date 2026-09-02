import type { CatanBoardTemplate } from "./types";
import { BOARD_TEMPLATES } from "./expansions";
import { BOARD_TEMPLATES_5_6 } from "./expansions56";

export interface BoardEntry {
  id: string;
  label: string;
  /** Heading this board sits under in the picker. */
  group: string;
  template: CatanBoardTemplate;
}

export const BOARD_REGISTRY: BoardEntry[] = [
  { id: "catan-3-4", label: "Catan (3-4 players)", group: "Base game",
    template: BOARD_TEMPLATES["catan-3-4"] },
  { id: "catan-5-6", label: "Catan: 5-6 Player Extension", group: "Base game",
    template: BOARD_TEMPLATES["catan-5-6"] },
  { id: "ck-3-4", label: "Cities & Knights (3-4 players)", group: "Base game",
    template: BOARD_TEMPLATES["ck-3-4"] },
  { id: "ck-5-6", label: "Cities & Knights (5-6 players)", group: "Base game",
    template: BOARD_TEMPLATES["ck-5-6"] },
  { id: "sf-heading-3p", label: "Seafarers: Heading for New Shores (3p)", group: "Seafarers (3-4 players)",
    template: BOARD_TEMPLATES["sf-heading-3p"] },
  { id: "sf-heading-4p", label: "Seafarers: Heading for New Shores (4p)", group: "Seafarers (3-4 players)",
    template: BOARD_TEMPLATES["sf-heading-4p"] },
  { id: "sf-four-islands-3p", label: "Seafarers: The Four Islands (3p)", group: "Seafarers (3-4 players)",
    template: BOARD_TEMPLATES["sf-four-islands-3p"] },
  { id: "sf-four-islands-4p", label: "Seafarers: The Four Islands (4p)", group: "Seafarers (3-4 players)",
    template: BOARD_TEMPLATES["sf-four-islands-4p"] },
  { id: "sf-fog-islands-3p", label: "Seafarers: The Fog Islands (3p)", group: "Seafarers (3-4 players)",
    template: BOARD_TEMPLATES["sf-fog-islands-3p"] },
  { id: "sf-fog-islands-4p", label: "Seafarers: The Fog Islands (4p)", group: "Seafarers (3-4 players)",
    template: BOARD_TEMPLATES["sf-fog-islands-4p"] },
  { id: "sf-through-desert-3p", label: "Seafarers: Through the Desert (3p)", group: "Seafarers (3-4 players)",
    template: BOARD_TEMPLATES["sf-through-desert-3p"] },
  { id: "sf-through-desert-4p", label: "Seafarers: Through the Desert (4p)", group: "Seafarers (3-4 players)",
    template: BOARD_TEMPLATES["sf-through-desert-4p"] },
  { id: "sf-forgotten-tribe", label: "Seafarers: The Forgotten Tribe", group: "Seafarers (3-4 players)",
    template: BOARD_TEMPLATES["sf-forgotten-tribe"] },
  { id: "sf-cloth-for-catan", label: "Seafarers: Cloth for Catan", group: "Seafarers (3-4 players)",
    template: BOARD_TEMPLATES["sf-cloth-for-catan"] },
  { id: "sf-pirate-islands", label: "Seafarers: The Pirate Islands", group: "Seafarers (3-4 players)",
    template: BOARD_TEMPLATES["sf-pirate-islands"] },
  { id: "sf-wonders-of-catan", label: "Seafarers: The Wonders of Catan", group: "Seafarers (3-4 players)",
    template: BOARD_TEMPLATES["sf-wonders-of-catan"] },
  { id: "sf-new-world", label: "Seafarers: New World", group: "Seafarers (3-4 players)",
    template: BOARD_TEMPLATES["sf-new-world"] },
  { id: "sf56-heading", label: "Seafarers 5-6: Heading for New Shores", group: "Seafarers (5-6 players)",
    template: BOARD_TEMPLATES_5_6["sf56-heading"] },
  { id: "sf56-six-islands", label: "Seafarers 5-6: The Six Islands", group: "Seafarers (5-6 players)",
    template: BOARD_TEMPLATES_5_6["sf56-six-islands"] },
  { id: "sf56-fog-islands", label: "Seafarers 5-6: The Fog Islands", group: "Seafarers (5-6 players)",
    template: BOARD_TEMPLATES_5_6["sf56-fog-islands"] },
  { id: "sf56-through-desert", label: "Seafarers 5-6: Through the Desert", group: "Seafarers (5-6 players)",
    template: BOARD_TEMPLATES_5_6["sf56-through-desert"] },
  { id: "sf56-forgotten-tribe", label: "Seafarers 5-6: The Forgotten Tribe", group: "Seafarers (5-6 players)",
    template: BOARD_TEMPLATES_5_6["sf56-forgotten-tribe"] },
  { id: "sf56-cloth-for-catan", label: "Seafarers 5-6: Cloth for Catan", group: "Seafarers (5-6 players)",
    template: BOARD_TEMPLATES_5_6["sf56-cloth-for-catan"] },
  { id: "sf56-pirate-islands", label: "Seafarers 5-6: The Pirate Islands", group: "Seafarers (5-6 players)",
    template: BOARD_TEMPLATES_5_6["sf56-pirate-islands"] },
  { id: "sf56-wonders-of-catan", label: "Seafarers 5-6: The Wonders of Catan", group: "Seafarers (5-6 players)",
    template: BOARD_TEMPLATES_5_6["sf56-wonders-of-catan"] },
  { id: "sf56-new-world", label: "Seafarers 5-6: New World", group: "Seafarers (5-6 players)",
    template: BOARD_TEMPLATES_5_6["sf56-new-world"] },
];

export function getBoardEntry(id: string): BoardEntry | undefined {
  return BOARD_REGISTRY.find((entry) => entry.id === id);
}
