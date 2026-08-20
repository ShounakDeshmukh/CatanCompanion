import type { RuleSection } from "./types";

// Summarized from the "Combining with Catan - Seafarers Expansion" section of
// Rules/Catan Cities and Knights 3_4.pdf.
export const combinedNotes: RuleSection[] = [
  {
    id: "seafarers-ck",
    title: "Seafarers + Cities & Knights",
    body: [
      "Prefer scenarios that don't hide large parts of the board (Heading for New Shores and Through the Desert work well; Fog Islands and Four Islands noticeably dilute the barbarian threat since so few cities exist early on).",
      "- Anything Cities & Knights says about roads also applies to ships (recruiting/moving/displacing knights along them, blocking, etc).\n- Place the pirate on the barbarian track's final space at setup; it doesn't enter play until after the first barbarian attack.\n- A barbarian attack hits every island at once - count all cities and all active knights on the whole board.\n- Gold fields only ever produce resources, never commodities, and the merchant can't be placed on one.\n- Knights may move along a continuous route of roads and ships, including ending on an empty sea-hex intersection.\n- The Taxation progress card can only move the robber, never the pirate; a knight on a sea intersection can chase the pirate away just like it chases the robber.\n- Add 2 VP to whatever the Seafarers scenario's normal target is.",
    ],
  },
];
