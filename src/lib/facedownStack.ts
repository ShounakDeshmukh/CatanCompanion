import type { FacedownStack, HexType, NumberChitValue } from "../data/boards/types";

const HEX_LABEL: Partial<Record<HexType, string>> = {
  hills: "Hills",
  forest: "Forest",
  pasture: "Pasture",
  fields: "Fields",
  mountains: "Mountains",
  gold: "Gold field",
  desert: "Desert",
  sea: "Sea",
};

function total(counts: Record<string, number | undefined>): number {
  return Object.values(counts).reduce((sum: number, n) => sum + (n ?? 0), 0);
}

/**
 * The pile behind The Fog Islands' unknown hexes. Those positions are not dealt out here -
 * the host stacks them face down and turns one over as it is explored - so the board marks
 * them "?" and this lists what goes in the pile.
 */
export function renderFacedownStack(stack: FacedownStack): HTMLElement {
  const section = document.createElement("section");
  section.className = "facedown-stack";

  const hexes = Object.entries(stack.terrain) as [HexType, number][];
  const chits = Object.entries(stack.chits)
    .map(([value, count]) => [Number(value) as NumberChitValue, count as number] as const)
    .sort((a, b) => a[0] - b[0]);

  section.innerHTML = `
    <h2>Facedown stack</h2>
    <p class="facedown-stack__note">
      The ${total(stack.terrain)} hexes marked <strong>?</strong> are not set out in advance.
      Shuffle these face down beside the board and turn one over as each is explored, then
      place a disc from the facedown pile on it if it produces.
    </p>
    <div class="facedown-stack__tables">
      <table>
        <caption>Hexes</caption>
        <tbody>
          ${hexes
            .map(
              ([type, count]) =>
                `<tr><th scope="row">${HEX_LABEL[type] ?? type}</th><td>${count}</td></tr>`
            )
            .join("")}
          <tr class="facedown-stack__total">
            <th scope="row">Total</th><td>${total(stack.terrain)}</td>
          </tr>
        </tbody>
      </table>
      <table>
        <caption>Number discs</caption>
        <tbody>
          ${chits
            .map(([value, count]) => `<tr><th scope="row">${value}</th><td>${count}</td></tr>`)
            .join("")}
          <tr class="facedown-stack__total">
            <th scope="row">Total</th><td>${total(stack.chits)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
  return section;
}
