import type { BoardTemplate } from "./types";
import { catanBoard3to4, catanBoard5to6 } from "./base";

export interface BoardEntry {
  id: string;
  label: string;
  template: BoardTemplate;
}

// More entries (Cities & Knights, Seafarers scenarios) are added here as they're built.
export const BOARD_REGISTRY: BoardEntry[] = [
  { id: "catan-3-4", label: "Catan (3-4 players)", template: catanBoard3to4 },
  { id: "catan-5-6", label: "Catan: 5-6 Player Extension", template: catanBoard5to6 },
];

export function getBoardEntry(id: string): BoardEntry | undefined {
  return BOARD_REGISTRY.find((entry) => entry.id === id);
}
