import type {
  Award,
  Card,
  EventDie,
  GameState,
  KnightAction,
  Payout,
  Player,
  Track,
} from "../../lib/gameState";

/** Wording and small formatting helpers shared by the Play page's panels. */

export const CARD_LABEL: Record<Card, string> = {
  brick: "Brick",
  wood: "Wood",
  wool: "Sheep",
  wheat: "Wheat",
  ore: "Ore",
  choice: "of their choice",
  paper: "Paper",
  cloth: "Cloth",
  coin: "Coin",
  clothToken: "Cloth token",
};

export const EVENT_LABEL: Record<EventDie, string> = {
  ship: "Ship",
  yellow: "Yellow gate",
  blue: "Blue gate",
  green: "Green gate",
};

export const TRACK_LABEL: Record<Track, string> = { science: "Science", trade: "Trade", politics: "Politics" };

export const KNIGHT_RANK = ["Basic", "Strong", "Mighty"] as const;

export const KNIGHT_ACTION_TEXT: Record<KnightAction, string> = {
  recruit: "recruits a knight",
  promote: "promotes a knight",
  activate: "activates a knight",
  move: "moves a knight",
  chase: "chases the robber off with a knight",
  rest: "stands a knight down",
  remove: "takes a knight off the board",
};

export const AWARD_LABEL: Record<Award, string> = {
  longestRoad: "Longest Road",
  largestArmy: "Largest Army",
};

export const TOTALS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const waysToRoll = (total: number) => 6 - Math.abs(7 - total);

export function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string
  );
}

export const drawnHtml = new WeakMap<HTMLElement, string>();

/**
 * Replaces an element's markup only when it has actually changed. Most taps alter one or two
 * panels, and leaving the rest alone also keeps the history list scrolled where it was.
 */
export function setHtml(element: HTMLElement, html: string): void {
  if (drawnHtml.get(element) === html) return;
  drawnHtml.set(element, html);
  element.innerHTML = html;
}

export function playerTag(player: Pick<Player, "name" | "color">): string {
  return `<span class="player-dot" style="--player-color: var(--player-${player.color})"></span>${escapeHtml(player.name)}`;
}

export function payoutText(payout: Payout): string {
  return (Object.entries(payout) as [Card, number][])
    .map(([card, count]) => `${count} ${CARD_LABEL[card]}`)
    .join(", ");
}

export function elapsed(since: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - since) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export const takings = (state: GameState, payouts: Payout[], verb: string): string[] =>
  payouts.flatMap((payout, i) =>
    Object.keys(payout).length > 0
      ? [`<li>${playerTag(state.players[i])} ${verb} <strong>${payoutText(payout)}</strong></li>`]
      : []
  );

const nameList = (state: GameState, seats: number[]) =>
  seats.map((seat) => escapeHtml(state.players[seat].name)).join(" and ");

export function barbarianOutcome(state: GameState, defended: boolean, seats: number[]): string {
  if (!defended) return `The barbarians win. ${nameList(state, seats)} ${seats.length === 1 ? "loses" : "each lose"} a city.`;
  if (seats.length === 0) return "Catan holds, though no knight was awake to defend it.";
  return seats.length === 1
    ? `Catan holds. ${nameList(state, seats)} is Defender of Catan and takes a victory point.`
    : `Catan holds. ${nameList(state, seats)} tie as defenders and each take a progress card.`;
}

export { nameList };
