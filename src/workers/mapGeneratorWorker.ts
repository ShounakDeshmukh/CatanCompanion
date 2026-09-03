import type { CatanBoard, Hex } from "../data/boards/types";
import { buildBoard } from "../lib/boardFactory";
import { getBoardEntry } from "../data/boards/registry";
import { generateBoard, type ShuffleConstraints } from "../lib/shuffle";

type MapGenerationRequest = {
  generationId: number;
  boardId: string;
  seed: number;
  constraints: ShuffleConstraints;
};

type MapGenerationSuccess = {
  generationId: number;
  ok: true;
  boardId: string;
  seed: number;
  constraints: ShuffleConstraints;
  board: CatanBoard;
  hexes: Hex[];
};

type MapGenerationFailure = {
  generationId: number;
  ok: false;
  name: string;
  error: string;
};

type WorkerScope = typeof globalThis & {
  onmessage: ((event: MessageEvent<MapGenerationRequest>) => void) | null;
  postMessage(message: MapGenerationSuccess | MapGenerationFailure): void;
};

const workerScope = self as WorkerScope;

workerScope.onmessage = (event) => {
  const { generationId, boardId, seed, constraints } = event.data;

  try {
    const entry = getBoardEntry(boardId);
    if (!entry) {
      throw new Error(`Unknown board: ${boardId}`);
    }

    const board = buildBoard(entry.template);
    const { hexes, seed: usedSeed } = generateBoard(board, constraints, seed);

    workerScope.postMessage({
      generationId,
      ok: true,
      boardId,
      seed: usedSeed,
      constraints,
      board,
      hexes,
    });
  } catch (error) {
    workerScope.postMessage({
      generationId,
      ok: false,
      name: error instanceof Error ? error.name : "Error",
      error:
        error instanceof Error ? error.message : "Unknown map generation error",
    });
  }
};