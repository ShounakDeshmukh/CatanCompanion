import type { Ruleset } from "./types";

// Summarized from Rules/Catan Seafarers 3_4.pdf and Catan Seafarers 5_6.pdf (2025, 6th edition).
export const seafarersRules: Ruleset = {
  id: "seafarers",
  name: "Seafarers",
  tagline: "Set sail across a series of island scenarios. Uses Catan's rules plus ships, gold fields, and the pirate.",
  sections: [
    {
      id: "overview",
      title: "Overview",
      body: [
        "Seafarers isn't one board - it's a campaign of scenarios, each with its own map, setup, and victory condition (often more than 10 VP). The Map Generator lists every scenario this site supports.",
        "It adds three things to the base rules: gold field hexes, the pirate, and ships for expanding across open water.",
      ],
    },
    {
      id: "ships",
      title: "Ships",
      body: [
        "Ships cost 1 wood + 1 wool - the same as a road - and are built on empty sea edges. A new ship must connect to one of your existing ships or buildings (not roads), and can't be placed on an edge occupied by the pirate.",
        "You may move one ship per turn, but only if one of its ends is \"open\" (not next to one of your ships or buildings) and it isn't part of a continuous line already connecting two of your buildings.",
        "Longest Route counts roads and ships together - 5+ continuous segments of either (or both) claims the tile.",
      ],
    },
    {
      id: "gold-fields",
      title: "Gold Fields",
      body: [
        "A gold field is a resource-producing hex like any other, except a settlement on it lets you pick any 1 resource when it produces (2 of your choice for a city), rather than always producing the same type.",
      ],
    },
    {
      id: "pirate",
      title: "The Pirate",
      body: [
        "When you roll a 7, you may move the pirate instead of the robber. Move it to any sea hex; if you do, pick one player with a ship there and steal a random card from them.",
        "Unlike the robber, the pirate doesn't block hex production - it only threatens ships passing through its hex.",
      ],
    },
    {
      id: "scenarios",
      title: "Scenarios",
      body: [
        "The first four scenarios teach the basics: Heading for New Shores, The Four Islands, The Fog Islands, and Through the Desert.",
        "The next four add scenario-specific rules: The Forgotten Tribe, Cloth for Catan, The Pirate Islands, and The Wonders of Catan.",
        "New World is a fully open-ended variant for building your own island layouts once you know the ropes.",
        "Each scenario has its own victory point target (often 13-14+) and its own fixed or variable setup instructions, generated for you on the Map Generator page.",
      ],
    },
  ],
};
