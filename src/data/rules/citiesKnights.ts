import type { Ruleset } from "./types";

// Summarized from Rules/Catan Cities and Knights 3_4.pdf and Catan Cities and Knights 5_6.pdf
// (2025, 6th edition).
// Written as a plain-language walkthrough for players who already know base Catan. The
// commodities/city-improvements section is deliberately the most detailed one here - it's
// consistently the part new C&K players take longest to click with.
export const citiesKnightsRules: Ruleset = {
  id: "citiesKnights",
  name: "Cities & Knights",
  tagline: "Progress cards, commodities, city improvements, and knights defending against barbarians. First to 13 VP wins.",
  sections: [
    {
      id: "overview",
      title: "Overview",
      body: [
        "Cities & Knights keeps base Catan's rules and adds three linked systems: commodities (a second resource your cities can produce), city improvements (spending commodities to level up), and knights (pieces that defend your cities from barbarian raids).",
        "There's no Largest Army here - instead, knights earn you points by successfully defending against barbarian attacks (see below).",
        "The target is 13 victory points instead of 10.",
      ],
    },
    {
      id: "turn",
      title: "On Your Turn",
      body: [
        "Roll all 3 dice together: two production dice (add them together like normal) and one event die (a ship symbol, plus two faces each for Science, Trade, and Politics).",
        "- Ship symbol: the barbarian ship advances one space toward the coast. When it finally arrives, a barbarian attack happens immediately (see below) - and the very first time this occurs, the robber also enters play, starting on the desert.\n- Science, Trade, or Politics symbol: every player whose matching city-improvement track has already reached that number draws one progress card from that track's deck, in turn order starting with whoever rolled.",
        "Production works like the base game, except cities also produce a commodity on top of their usual resource - see Commodities & City Improvements below for exactly which hexes do this.",
        "Roll a 7 and your hand limit is your resources and commodities added together (a city wall raises your personal limit by 2).",
        "In your action phase you can play any number of progress cards, with two exceptions: Alchemy can only be played before rolling, and Victory Point must be played the instant you draw it. You can hold at most 4 progress cards at once.",
      ],
    },
    {
      id: "commodities",
      title: "Commodities & City Improvements",
      body: [
        "Commodities are a second currency, completely separate from resources. There are three: paper, cloth, and coin. You can never spend commodities on roads, settlements, or cities, and you can never spend resources on improvements - the two currencies don't mix.",
        "Only cities produce commodities, and only on certain terrain: a city on a forest hex produces 1 wood + 1 paper, a city on a pasture hex produces 1 wool + 1 cloth, and a city on a mountains hex produces 1 ore + 1 coin. A city on a hills or fields hex just produces double brick or double wheat, exactly like in the base game - no commodity either way.",
        "You need at least one city before you can buy any improvement. Each improvement is a level (1 through 5) on one of three tracks that match the commodities above - Science (paper), Trade (cloth), and Politics (coin). Move your marker up one level at a time by discarding commodities of that track's matching type: moving to level N costs N commodities, so level 2 to level 3 costs 3 commodities, not 1.",
        "What each level actually gets you:",
        "- Science (paper): 1 School, 2 Library, 3 Aqueduct (once owned: if a roll gives you nothing, take 1 resource of your choice - just not on a 7), 4 Theater, 5 University.\n- Trade (cloth): 1 Market, 2 Trading House, 3 Merchant Guild (once owned: trade commodities 2:1 with the bank), 4 Bank, 5 Great Exchange.\n- Politics (coin): 1 Town Hall, 2 Embassy, 3 Fortress (once owned: you may promote your strong knights all the way to mighty), 4 Courthouse, 5 High Assembly.",
        "Reaching level 3 on a track is what unlocks its listed power above, and it's also what lets that track's number start drawing you progress cards on the event die (see On Your Turn). Reaching level 4 first gives you temporary control of that track's metropolis; reaching level 5 first makes that control permanent. A metropolis sits on top of one of your cities, is worth 2 extra victory points, and can never be pillaged by a barbarian attack.",
      ],
    },
    {
      id: "knights",
      title: "Knights",
      body: [
        "Each player has 6 knight pieces, in pairs of three strengths (basic, strong, mighty). Recruiting a new basic knight costs 1 wool + 1 ore, promoting one to the next strength costs the same, and waking up an inactive knight costs 1 wheat. Promoting all the way to mighty needs level 3 on your Politics track.",
        "A knight sits on an intersection like a settlement or city, blocks roads and ships the same way a building does, and can cut an opponent's route for Longest Road purposes.",
        "Once per turn, an active knight can do one of: move along your roads to a new intersection, displace a weaker knight (yours or an opponent's) along a connected route, or chase the robber off a hex it's touching. Any of those uses it up - it goes inactive until you spend 1 wheat to activate it again.",
      ],
    },
    {
      id: "barbarians",
      title: "Barbarian Attacks",
      body: [
        "When the barbarian ship finally reaches the coast, compare two numbers: the barbarians' strength (1 for every city on the board, metropolises included) against your group's defense (the total strength of every active knight).",
        "If the barbarians are stronger, whichever player(s) contributed the least defense each have one city downgraded back to a settlement - metropolises are safe from this.",
        "If the defenders win, whoever contributed the most gets 1 victory point (or, if there's a tie for most, everyone tied draws a progress card instead).",
        "Either way, the barbarian ship resets to the start of its track and every knight goes back to inactive.",
      ],
    },
    {
      id: "progress-cards",
      title: "Progress Cards",
      body: [
        "Progress cards replace development cards. You don't buy them - you draw them for free when the event die matches a track you've improved to level 3+ (see Commodities & City Improvements). There are three 18-card decks, one per track:",
        "Science deck:",
        "- Alchemy x2 - set the production dice to whatever you want before rolling.\n- Crane x2 - your next city improvement costs 1 less commodity.\n- Engineering x1 - get a free city wall.\n- Invention x2 - swap two number discs on the board (not 2, 6, 8, or 12).\n- Irrigation x2 - collect 2 wheat for every fields hex your buildings touch.\n- Medicine x2 - upgrade a settlement to a city for just 1 wheat + 2 ore.\n- Mining x2 - collect 2 ore for every mountains hex your buildings touch.\n- Road Building x2 - place 2 roads for free.\n- Smithing x2 - promote up to 2 knights for free.\n- Printing x1 - worth 1 VP, play it the moment you draw it.",
        "Trade deck:",
        "- Commercial Harbor x2 - trade a resource for a commodity with the bank.\n- Guild Dues x2 - take 2 cards from a player with more VP than you.\n- Merchant x6 - place the merchant on a resource hex for a 2:1 trade there; worth 1 VP while you hold it.\n- Merchant Fleet x2 - trade 2:1 with the bank all turn for one chosen resource or commodity.\n- Resource Monopoly x4 - everyone gives you 2 of one resource type.\n- Trade Monopoly x2 - everyone gives you 1 of one commodity type.",
        "Politics deck:",
        "- Diplomacy x2 - remove an open road from the board.\n- Encouragement x2 - activate all your knights for free.\n- Espionage x3 - take a card from another player's hand.\n- Intrigue x2 - displace a knight without needing one of your own there.\n- Sabotage x2 - players with as many VP as you discard half their cards.\n- Taxation x2 - steal a card from everyone on the robber's new hex.\n- Treason x2 - swap a knight off the board for one of another player's.\n- Constitution x1 - worth 1 VP, play it the moment you draw it.\n- Wedding x2 - players with more VP than you each give you 2 cards.",
      ],
    },
  ],
};
