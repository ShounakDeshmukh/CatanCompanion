import type { Ruleset } from "./types";

// Summarized from Rules/Catan Base 3_4.pdf and Catan Base 5_6.pdf (2025, 6th edition).
export const baseRules: Ruleset = {
  id: "base",
  name: "Catan",
  tagline: "The core game. First to 10 victory points wins.",
  sections: [
    {
      id: "overview",
      title: "Overview",
      body: [
        "Settle the island of Catan by building settlements and cities, gathering resources from adjacent terrain hexes, and trading with other players.",
        "The first player to reach 10 victory points on their own turn wins immediately.",
        "- Settlement = 1 VP\n- City = 2 VP (replaces a settlement, does not stack with it)\n- Longest Route (5+ continuous roads) = 2 VP\n- Largest Army (3+ knight cards played) = 2 VP\n- Each Victory Point development card = 1 VP",
      ],
    },
    {
      id: "setup",
      title: "Setup",
      body: [
        "Fixed Setup uses the recommended beginner layout printed in the rulebook - good for a first game or a quick, known-quantity board.",
        "Variable Setup places the 19 terrain hexes randomly, then lays the shuffled number discs in order around the board (skipping the desert). Harbor positions are part of the frame and are never randomized, in either setup.",
        "That's exactly what this site's Map Generator automates for you, with an optional \"no 6/8 touching\" toggle if your group prefers a fairer variant - note that constraint isn't part of the official rules.",
        "Each player places 2 settlements and 2 roads during setup (second placement in reverse turn order), then collects one resource card for each hex touching their second settlement.",
        "The 5-6 Player Extension swells the board to 30 hexes and 28 number discs, and splits each turn into a Player 1 / Player 2 pair - see Turn Structure below.",
      ],
    },
    {
      id: "turn",
      title: "Turn Structure",
      body: [
        "Production phase: optionally play one development card, roll both dice, then collect resources - every player with a settlement or city on a hex matching the roll gets resources (2x for a city).",
        "Rolling a 7: every player with more than 7 cards discards half (rounded down), then the active player moves the robber to a new hex and steals one random card from an opponent with a building there. A hex with the robber on it produces nothing.",
        "Action phase: trade and build in any order, as many times as you can afford. You may play at most one development card per turn (not one you built this turn), before or after rolling.",
        "5-6 players: each turn is a Player 1 / Player 2 pair. Player 1 plays a full normal turn (production + action). If they haven't won, Player 2 then takes an action phase only - trading with the supply but not with other players.",
      ],
    },
    {
      id: "trading-building",
      title: "Trading & Building",
      body: [
        "Trade with other players freely (announce what you want and offer), trade 4:1 with the supply, or trade 3:1/2:1 through a harbor you have a building on.",
        "Building costs (roads, settlements, cities, development cards) are on the Cost Cards page.",
        "A new road or ship must connect to one of your existing roads or buildings, and can't be built past an opponent's building. Settlements must be at least two edges from every other building (the Distance Rule) and connect to one of your roads.",
      ],
    },
    {
      id: "special",
      title: "Special Rules",
      body: [
        "Longest Route: first to 5+ continuous roads takes the 2 VP tile; it transfers immediately if someone builds a longer route, and returns to the supply if a route is broken below 5.",
        "Largest Army: first to play 3 Knight development cards takes the 2 VP tile, transferring the same way if overtaken.",
        "Development cards: Knight (move the robber), Road Building (2 free roads), Invention (take 2 resources from the supply), Monopoly (everyone hands over all of one resource type), and Victory Point (reveal to win, otherwise kept hidden).",
      ],
    },
  ],
};
