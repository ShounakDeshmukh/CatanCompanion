import type { HexType, Orientation } from "../../data/boards/types";
import desert from "./desert.webp";
import desertSide from "./desert-side.webp";
import fields from "./fields.webp";
import fieldsSide from "./fields-side.webp";
import fog from "./fog.webp";
import fogSide from "./fog-side.webp";
import forest from "./forest.webp";
import forestSide from "./forest-side.webp";
import gold from "./gold.webp";
import goldSide from "./gold-side.webp";
import hills from "./hills.webp";
import hillsSide from "./hills-side.webp";
import mountains from "./mountains.webp";
import mountainsSide from "./mountains-side.webp";
import pasture from "./pasture.webp";
import pastureSide from "./pasture-side.webp";
import sea from "./sea.webp";
import seaSide from "./sea-side.webp";
import village from "./village.webp";
import villageSide from "./village-side.webp";
import harbor0 from "./harbor-0.webp";
import harbor0Side from "./harbor-0-side.webp";
import harbor60 from "./harbor-60.webp";
import harbor60Side from "./harbor-60-side.webp";
import harbor120 from "./harbor-120.webp";
import harbor120Side from "./harbor-120-side.webp";
import harbor180 from "./harbor-180.webp";
import harbor180Side from "./harbor-180-side.webp";
import harbor240 from "./harbor-240.webp";
import harbor240Side from "./harbor-240-side.webp";
import harbor300 from "./harbor-300.webp";
import harbor300Side from "./harbor-300-side.webp";

/**
 * Terrain artwork. The tiles are drawn as SVG with heavy texture filters, which browsers
 * repaint far too slowly to use directly on a board of a hundred hexes, so they are shipped
 * as images rendered from those SVGs.
 */
export const HEX_ART: Record<HexType, string> = {
  desert,
  fields,
  fog,
  forest,
  gold,
  hills,
  mountains,
  pasture,
  sea,
  village,
};

/**
 * The same tiles with the scene turned a quarter anticlockwise, for boards drawn rotated a
 * quarter clockwise. Left as they were, every
 * tree and house on a Seafarers map would lie on its side.
 */
export const HEX_ART_SIDEWAYS: Record<HexType, string> = {
  desert: desertSide,
  fields: fieldsSide,
  fog: fogSide,
  forest: forestSide,
  gold: goldSide,
  hills: hillsSide,
  mountains: mountainsSide,
  pasture: pastureSide,
  sea: seaSide,
  village: villageSide,
};

/**
 * A sea hex with a harbor, one picture per edge the harbor can serve: the coast runs along
 * that edge and the two piers stand by the corners it trades from. Keyed by the port's
 * orientation.
 */
export const HARBOR_ART: Record<Orientation, string> = {
  0: harbor0,
  60: harbor60,
  120: harbor120,
  180: harbor180,
  240: harbor240,
  300: harbor300,
};

export const HARBOR_ART_SIDEWAYS: Record<Orientation, string> = {
  0: harbor0Side,
  60: harbor60Side,
  120: harbor120Side,
  180: harbor180Side,
  240: harbor240Side,
  300: harbor300Side,
};
