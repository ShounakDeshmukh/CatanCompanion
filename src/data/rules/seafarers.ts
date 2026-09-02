import type { Ruleset } from "./types";

// Summarized from Rules/Catan Seafarers 3_4.pdf and Catan Seafarers 5_6.pdf (2025, 6th edition).
// Written as a plain-language walkthrough for players who already know base Catan.
export const seafarersRules: Ruleset = {
  id: "seafarers",
  name: "Seafarers",
  tagline: "Set sail across a series of island scenarios. Uses Catan's rules plus ships, gold fields, and the pirate.",
  sections: [
    {
      id: "overview",
      title: "Overview",
      body: [
        "Seafarers keeps every rule from base Catan and adds three new things: ships for crossing open water, gold field hexes, and a pirate ship.",
        "There's no single Seafarers board - it's played as scenarios, each with a different island layout and its own victory point target, often more than 10.",
      ],
    },
    {
      id: "ships",
      title: "Ships",
      body: [
        "A ship costs 1 wood + 1 wool - the same total cost as a road - and is built on an empty edge of a sea hex. It must connect to one of your existing ships or buildings (roads don't count), and can't be built on an edge the pirate is sitting on.",
        "Once per turn, instead of building, you may move one ship - but only if one end of it is \"open\" (not touching one of your ships or buildings) and it isn't already sitting between two of your own buildings.",
        "Longest Road counts roads and ships together - any 5+ connected pieces, in any mix of the two, claims the 2 points.",
      ],
    },
    {
      id: "gold-fields",
      title: "Gold Fields",
      body: [
        "A gold field hex produces like any other resource hex, except it doesn't have a fixed resource. When it produces, a settlement there lets you pick any 1 resource you want, and a city lets you pick any 2 (same type or different).",
      ],
    },
    {
      id: "pirate",
      title: "The Pirate",
      body: [
        "When you roll a 7, you can move the pirate instead of the robber. Move it to any sea hex, then steal a random card from one player who has a ship there.",
        "Unlike the robber, the pirate doesn't stop a land hex from producing - it's only a threat to ships passing through its hex.",
      ],
    },
  ],
};
