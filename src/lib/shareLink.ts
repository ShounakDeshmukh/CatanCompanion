export interface ShareState {
  boardId: string;
  seed: number;
}

export function encodeShareHash(state: ShareState): string {
  return `#board=${encodeURIComponent(state.boardId)}&seed=${state.seed}`;
}

export function decodeShareHash(hash: string): ShareState | undefined {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const boardId = params.get("board");
  const seedParam = params.get("seed");
  if (!boardId || seedParam === null) return undefined;

  const seed = Number(seedParam);
  if (!Number.isFinite(seed)) return undefined;

  return { boardId, seed };
}
