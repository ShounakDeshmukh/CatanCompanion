import roadSvg from "./road.svg?raw";
import settlementSvg from "./settlement.svg?raw";
import citySvg from "./city.svg?raw";
import devCardSvg from "./dev-card.svg?raw";
import shipSvg from "./ship.svg?raw";
import cityWallSvg from "./city-wall.svg?raw";
import knightRecruitSvg from "./make_knight.svg?raw";
import knightPromoteSvg from "./upgrade-knight.svg?raw";
import knightActivateSvg from "./activate-knight.svg?raw";

import brickSvg from "./brick.svg?raw";
import woodSvg from "./wood.svg?raw";
import woolSvg from "./sheep.svg?raw";
import wheatSvg from "./wheat.svg?raw";
import oreSvg from "./stone.svg?raw";

import paperSvg from "./paper.svg?raw";
import clothSvg from "./cloth.svg?raw";
import coinSvg from "./coin.svg?raw";

/** Single-path vector icons (fill="currentColor") for the Cost Cards reference card. */
export const BUILDING_ICON_SVG: Record<string, string> = {
  road: roadSvg,
  settlement: settlementSvg,
  city: citySvg,
  "dev-card": devCardSvg,
  ship: shipSvg,
  "city-wall": cityWallSvg,
  "knight-recruit": knightRecruitSvg,
  "knight-promote": knightPromoteSvg,
  "knight-activate": knightActivateSvg,
};

export const RESOURCE_ICON_SVG: Record<"brick" | "wood" | "wool" | "wheat" | "ore", string> = {
  brick: brickSvg,
  wood: woodSvg,
  wool: woolSvg,
  wheat: wheatSvg,
  ore: oreSvg,
};

export const COMMODITY_ICON_SVG: Record<"paper" | "cloth" | "coin", string> = {
  paper: paperSvg,
  cloth: clothSvg,
  coin: coinSvg,
};
