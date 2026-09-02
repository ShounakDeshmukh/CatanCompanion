import "../styles/theme.css";
import "../styles/home.css";
import { renderNav } from "../lib/nav";
import { HEX_ART } from "../assets/hexes/index";
import type { HexType } from "../data/boards/types";

renderNav("home");

/**
 * A small cluster of hexes behind the hero, laid out on the same doubled-width grid the
 * boards use: two columns per hex, each row offset half a hex.
 */
const CLUSTER: { row: number; col: number; type: HexType }[] = [
  { row: 0, col: 2, type: "forest" },
  { row: 0, col: 4, type: "fields" },
  { row: 1, col: 1, type: "pasture" },
  { row: 1, col: 3, type: "mountains" },
  { row: 1, col: 5, type: "hills" },
  { row: 2, col: 0, type: "sea" },
  { row: 2, col: 2, type: "gold" },
  { row: 2, col: 4, type: "desert" },
  { row: 2, col: 6, type: "sea" },
  { row: 3, col: 1, type: "hills" },
  { row: 3, col: 3, type: "forest" },
  { row: 3, col: 5, type: "pasture" },
];

const art = document.getElementById("hero-art");
if (art) {
  for (const { row, col, type } of CLUSTER) {
    const hex = document.createElement("div");
    hex.className = "hero-hex";
    hex.style.gridArea = `${1 + row * 2} / ${1 + col} / ${4 + row * 2} / ${3 + col}`;
    hex.style.backgroundImage = `url("${HEX_ART[type]}")`;
    art.appendChild(hex);
  }
}
