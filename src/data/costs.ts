export type Expansion = "base" | "seafarers" | "citiesKnights";

export interface ResourceCost {
  brick?: number;
  wood?: number;
  wool?: number;
  wheat?: number;
  ore?: number;
}

export interface BuildingCost {
  id: string;
  label: string;
  expansion: Expansion;
  cost: ResourceCost;
  note?: string;
}

// Verified against Rules/Catan Base 3_4.pdf, Catan Seafarers 3_4.pdf, and
// Catan Cities and Knights 3_4.pdf.
export const BUILDING_COSTS: BuildingCost[] = [
  { id: "road", label: "Road", expansion: "base", cost: { brick: 1, wood: 1 } },
  {
    id: "settlement",
    label: "Settlement",
    expansion: "base",
    cost: { brick: 1, wood: 1, wool: 1, wheat: 1 },
    note: "1 VP",
  },
  { id: "city", label: "City", expansion: "base", cost: { wheat: 2, ore: 3 }, note: "2 VP, replaces a settlement" },
  { id: "dev-card", label: "Development Card", expansion: "base", cost: { wool: 1, wheat: 1, ore: 1 } },
  { id: "ship", label: "Ship", expansion: "seafarers", cost: { wood: 1, wool: 1 } },
  { id: "city-wall", label: "City Wall", expansion: "citiesKnights", cost: { brick: 2 }, note: "+2 hand-size limit" },
  {
    id: "knight-recruit",
    label: "Recruit a Knight (Basic)",
    expansion: "citiesKnights",
    cost: { wool: 1, ore: 1 },
  },
  {
    id: "knight-promote",
    label: "Promote a Knight",
    expansion: "citiesKnights",
    cost: { wool: 1, ore: 1 },
  },
  {
    id: "knight-activate",
    label: "Activate a Knight",
    expansion: "citiesKnights",
    cost: { wheat: 1 },
  },
];

export type Commodity = "paper" | "cloth" | "coin";

export interface ImprovementLevel {
  level: 1 | 2 | 3 | 4 | 5;
  name: string;
  /** Commodities of this track's type required to reach this level (cumulative cost = level number). */
  cost: number;
  ability?: string;
}

export interface ImprovementTrack {
  id: string;
  name: string;
  commodity: Commodity;
  levels: ImprovementLevel[];
}

// Each level N costs N commodities of the track's type. Reaching level 4 grants temporary
// metropolis control (first player only); level 5 grants it permanently. Verified against
// Rules/Catan Cities and Knights 3_4.pdf.
export const IMPROVEMENT_TRACKS: ImprovementTrack[] = [
  {
    id: "science",
    name: "Science",
    commodity: "paper",
    levels: [
      { level: 1, name: "School", cost: 1 },
      { level: 2, name: "Library", cost: 2 },
      {
        level: 3,
        name: "Aqueduct",
        cost: 3,
        ability: "If you receive no cards during Production, take 1 resource of your choice (not on a 7).",
      },
      { level: 4, name: "Theater", cost: 4, ability: "First to reach: temporary control of the Science metropolis." },
      { level: 5, name: "University", cost: 5, ability: "First to reach: permanent control of the Science metropolis." },
    ],
  },
  {
    id: "trade",
    name: "Trade",
    commodity: "cloth",
    levels: [
      { level: 1, name: "Market", cost: 1 },
      { level: 2, name: "Trading House", cost: 2 },
      { level: 3, name: "Merchant Guild", cost: 3, ability: "Trade commodities 2:1 for resources or other commodities." },
      { level: 4, name: "Bank", cost: 4, ability: "First to reach: temporary control of the Trade metropolis." },
      { level: 5, name: "Great Exchange", cost: 5, ability: "First to reach: permanent control of the Trade metropolis." },
    ],
  },
  {
    id: "politics",
    name: "Politics",
    commodity: "coin",
    levels: [
      { level: 1, name: "Town Hall", cost: 1 },
      { level: 2, name: "Embassy", cost: 2 },
      { level: 3, name: "Fortress", cost: 3, ability: "You may promote strong knights (2) to mighty knights (3)." },
      { level: 4, name: "Courthouse", cost: 4, ability: "First to reach: temporary control of the Politics metropolis." },
      { level: 5, name: "High Assembly", cost: 5, ability: "First to reach: permanent control of the Politics metropolis." },
    ],
  },
];
