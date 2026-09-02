import type { Ruleset } from "./types";

// Summarized from Rules/Catan Base 3_4.pdf and Catan Base 5_6.pdf (2025, 6th edition).
// Written as a plain-language walkthrough for someone who has never played before.
export const baseRules: Ruleset = {
  id: "base",
  name: "Catan",
  tagline: "The core game. First to 10 victory points wins.",
  sections: [
    {
      id: "goal",
      title: "The Goal",
      body: [
        "Catan is a race to 10 victory points. Whoever gets there first, on their own turn, wins on the spot - the game stops immediately, even mid-turn.",
        "- A settlement is worth 1 point.\n- A city (an upgraded settlement) is worth 2 points.\n- Being the first to build a road 5-or-more pieces long is worth 2 points (Longest Road).\n- Being the first to play 3 Knight cards is worth 2 points (Largest Army).\n- A Victory Point card is worth 1 point - keep it face down and secret until revealing it wins you the game.",
      ],
    },
    {
      id: "board",
      title: "The Board",
      body: [
        "The board is a grid of hexagon tiles. Each hex is one of 5 resource types - brick, wood, wool, wheat, or ore - except one hex, the desert, which produces nothing.",
        "Every hex except the desert has a number on it (2-12). That number decides when it produces, based on the dice roll each turn.",
        "You build settlements and cities on the corners where hexes meet, and roads along the edges connecting those corners. A single settlement can touch up to 3 hexes at once, collecting from all of them.",
      ],
    },
    {
      id: "starting",
      title: "Starting the Game",
      body: [
        "Before regular turns begin, every player places 2 settlements and 2 roads on the board, one at a time, spread out so nobody starts right on top of anyone else.",
        "For your second settlement only, immediately collect one resource card for every hex it touches - that's your starting hand, so where you place it matters.",
      ],
    },
    {
      id: "turn",
      title: "On Your Turn",
      body: [
        "Roll both dice. Whatever number comes up, every hex with that number produces its resource for every player with a building touching it - not just you: a settlement collects 1 card, a city collects 2.",
        "- Roll a 7? Nothing produces that turn. Instead, anyone holding more than 7 cards discards half (rounded down), then you move the robber onto any hex - it blocks that hex from producing until you move it again - and steal one random card from an opponent who has a building there.",
        "After the roll, trade and build as much as you can afford, in any order, for the rest of your turn.",
      ],
    },
    {
      id: "building",
      title: "Building",
      body: [
        "- Road - costs 1 brick + 1 wood. Extends your network; must connect to a road or building you already own.\n- Settlement - costs 1 brick + 1 wood + 1 wool + 1 wheat. Worth 1 point and produces resources from then on. Must connect to one of your roads, and sit at least two corners away from every other settlement or city.\n- City - costs 2 wheat + 3 ore. Upgrades one of your own settlements in place - it now produces double and is worth 2 points instead of 1.\n- Development card - costs 1 wool + 1 wheat + 1 ore. Draw a random card from the deck (see below).",
      ],
    },
    {
      id: "trading",
      title: "Trading",
      body: [
        "On your turn, you can trade with other players however you both agree - offer what you have for what you need.",
        "No takers? You can always trade 4 of one resource for 1 of another with the bank. If one of your settlements or cities sits on a harbor, that harbor gives you a better bank rate instead (3:1, or 2:1 for its specific resource).",
      ],
    },
    {
      id: "dev-cards",
      title: "Development Cards",
      body: [
        "- Knight - move the robber immediately, same as rolling a 7 (no discarding). Your 3rd Knight played also hands you the Largest Army points.\n- Road Building - place 2 roads for free.\n- Invention - take any 2 resource cards from the bank, free.\n- Monopoly - name one resource; every other player must hand over all of that resource they're holding.\n- Victory Point - worth 1 point, kept secret until it wins you the game.",
        "You can play at most one development card per turn, and never one you bought that same turn.",
      ],
    },
    {
      id: "winning",
      title: "Winning",
      body: [
        "Keep a running count of your points as you build and play cards. The instant you reach 10 on your own turn, you win - no need to wait for the turn to end.",
      ],
    },
  ],
};
