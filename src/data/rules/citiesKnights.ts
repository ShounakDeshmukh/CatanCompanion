import type { Ruleset } from "./types";

// Summarized from Rules/Catan Cities and Knights 3_4.pdf and Catan Cities and Knights 5_6.pdf
// (2025, 6th edition).
export const citiesKnightsRules: Ruleset = {
  id: "citiesKnights",
  name: "Cities & Knights",
  tagline: "Progress cards, commodities, city improvements, and knights defending against barbarians. First to 13 VP wins.",
  sections: [
    {
      id: "overview",
      title: "Overview",
      body: [
        "Cities & Knights replaces development cards with progress cards (Science, Trade, Politics) and adds a second production track: cities now produce a commodity (paper, cloth, or coin) alongside their usual resources.",
        "There's no Largest Army in this expansion - instead, knights defend against periodic barbarian attacks, and the strongest defender each round earns a VP token.",
        "Win condition is 13+ VP instead of 10 (add 2 more if combined with a Seafarers scenario).",
      ],
    },
    {
      id: "turn",
      title: "Turn Structure",
      body: [
        "Roll Dice phase: optionally play an Alchemy progress card first, then roll all 3 dice together (2 production dice + 1 event die).",
        "- Ship event: the barbarian ship advances one space toward shore. When it reaches the final space, the barbarians attack (see below) and the robber activates for the first time, moving to the desert.\n- Science/Trade/Politics event: any player whose city-improvement cube on that track covers the red die's number draws a progress card, in turn order starting with the active player.",
        "Production phase: settlements produce as normal; cities produce both a resource and a matching commodity (2 brick / 1 paper+1 wood / 1 cloth+1 wool / 2 wheat / 1 coin+1 ore, depending on terrain). Hand limit for discarding on a 7 is resources + commodities combined (city walls raise it).",
        "Action phase: trade and build as usual, plus the new C&K actions below. You may play any number of progress cards except Alchemy (Roll Dice phase only) and Victory Point (play immediately on draw). Hand limit is 4 progress cards.",
      ],
    },
    {
      id: "city-improvements",
      title: "City Improvements",
      body: [
        "You need at least 1 city to buy improvements. Discard commodities to move your cube up a track one space at a time - level N costs N commodities of that track's type. Exact costs and every level's name/ability are on the Cost Cards page.",
        "Reaching level 3 on a track unlocks a permanent ability (letting you draw that track's progress cards, trade commodities 2:1, or promote strong knights to mighty). Reaching level 4 grants temporary control of that track's metropolis (first player only); level 5 makes it permanent.",
        "A metropolis is worth 2 extra VP and can't be pillaged by a barbarian attack.",
      ],
    },
    {
      id: "knights",
      title: "Knights",
      body: [
        "Each player has 6 knight pieces (2 of each strength). Recruiting a basic knight costs 1 wool + 1 ore, promoting to the next strength costs the same, and activating an inactive knight costs 1 wheat. Promoting to mighty (strength 3) requires level 3 on the Politics track.",
        "Knights sit on intersections like buildings, block roads/ships the same way, and break up an opponent's route for Longest Route purposes.",
        "An active knight may, once per turn: move along your roads, displace a weaker knight of yours or an opponent's along a connected route, or chase the robber away from an adjacent hex. Any of these makes the knight inactive again.",
      ],
    },
    {
      id: "barbarians",
      title: "Barbarian Attacks",
      body: [
        "When the barbarian ship reaches shore, compare the barbarians' strength (1 per city on the board, metropolises included) to the defenders' strength (sum of all active knights' strengths).",
        "If the barbarians win: the player(s) who contributed the least defense each have one city pillaged (downgraded to a settlement); metropolises can't be pillaged.",
        "If the defenders win: whoever contributed the most gets a 1 VP token (or everyone ties draws a progress card instead).",
        "Either way, the ship resets to the start of the track and all knights go inactive again.",
      ],
    },
    {
      id: "progress-cards",
      title: "Progress Cards",
      body: [
        "Science (18 cards): Alchemy x2 (set the production dice before rolling), Crane x2 (next city improvement costs 1 less commodity), Engineering x1 (free city wall), Invention x2 (swap 2 number discs, not 2/6/8/12), Irrigation x2 (2 wheat per field hex touching your buildings), Medicine x2 (upgrade a settlement to a city for just 1 wheat + 2 ore), Mining x2 (2 ore per mountain hex touching your buildings), Road Building x2 (2 free roads), Smithing x2 (promote up to 2 knights for free), Printing x1 (1 VP, play immediately).",
        "Trade (18 cards): Commercial Harbor x2 (offer a resource for a commodity), Guild Dues x2 (take 2 cards from a player with more VP than you), Merchant x6 (place the merchant piece for a 2:1 trade on its hex's resource, worth 1 VP while you control it), Merchant Fleet x2 (2:1 trades with the supply all turn for one chosen resource/commodity), Resource Monopoly x4 (everyone gives you 2 of one resource type), Trade Monopoly x2 (everyone gives you 1 of one commodity type).",
        "Politics (18 cards): Diplomacy x2 (remove an open road), Encouragement x2 (activate all your knights for free), Espionage x3 (take a card from another player's hand), Intrigue x2 (displace a knight without using one of yours), Sabotage x2 (players with as many VP as you discard half their cards), Taxation x2 (steal from everyone on the robber's new hex), Treason x2 (swap a knight off the board for one of another player's), Constitution x1 (1 VP, play immediately), Wedding x2 (players with more VP than you give you 2 cards each).",
      ],
    },
  ],
};
