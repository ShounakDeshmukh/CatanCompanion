import { summarize, type GameRecord } from "../../lib/gameHistory";
import type { Moment } from "../../lib/replay";
import type { GifReply, GifRequest } from "../../workers/gifWorker";
import { cardCanvas, drawResultCard, finalScene, type CardArt, type Scene } from "./resultCard";

/** The replay is half the picture's size, which keeps a long game to a megabyte or two. */
const SCALE = 0.5;
/** How long the game takes to play back, within what each frame is allowed. */
const PLAYBACK_MS = 12_000;
const SLOWEST_FRAME_MS = 450;
/** Short enough that the longest games still fit the playback time, and no browser rounds it up. */
const FASTEST_FRAME_MS = 50;
const HOLD_MS = 3500;
/** The opening frame, which says what the game was played to before anything is placed. */
const TITLE_MS = 1400;
/** A piece arrives over one short frame at part strength, then stands solid. */
const ARRIVAL_MS = 40;
const ARRIVAL_OPACITY = 0.45;

interface Frame {
  scene: Scene;
  delay: number;
}

/** The card as it stood at one moment: the turn and its roll where the winner will be named. */
function sceneAt({ state, changed }: Moment, record: GameRecord): Scene {
  const standing = summarize(state, record.board, record.endedAt).players;
  const rolled = state.rolls.at(-1);
  return {
    headline: rolled ? `Turn ${state.rolls.length} · rolled ${rolled.total}` : "Opening placements",
    view: state,
    mark: changed === undefined ? undefined : { site: changed },
    // rows stay where the game will leave them, so only the numbers move
    players: record.players.map(
      ({ seat }) => standing.find((player) => player.seat === seat) ?? standing[0]
    ),
  };
}

/**
 * The frames of the replay and how long each is shown. The game's moments are fitted into
 * the playback time; between them, each piece put on the board gets a short frame of its own
 * to fade in on.
 */
function framesOf(moments: Moment[], record: GameRecord): Frame[] {
  const ending = moments[moments.length - 1].state;
  const scenes = moments.slice(0, -1).map((moment) => sceneAt(moment, record));
  const arrivals = scenes.filter((scene) => typeof scene.mark?.site === "string").length;
  const pace = (PLAYBACK_MS - arrivals * ARRIVAL_MS) / moments.length;
  const delay = Math.min(SLOWEST_FRAME_MS, Math.max(FASTEST_FRAME_MS, pace));

  const frames = scenes.flatMap((scene, step): Frame[] => {
    if (step === 0) {
      return [{ scene: { ...scene, headline: `First to ${record.target}` }, delay: TITLE_MS }];
    }
    const { mark } = scene;
    const arrival =
      typeof mark?.site === "string"
        ? [{ scene: { ...scene, mark: { ...mark, opacity: ARRIVAL_OPACITY } }, delay: ARRIVAL_MS }]
        : [];
    return [...arrival, { scene, delay }];
  });
  return [...frames, { scene: finalScene(record, ending), delay: HOLD_MS }];
}

/**
 * The result card as an animation: the board is built up a piece at a time with the dice and
 * the scores running beside it, and the winner is named on the last frame, which is then
 * held. The frames are drawn here and encoded by a worker, so the page stays free while a
 * long game is put together, and waiting on the worker is not slowed in a background tab the
 * way a timer would be.
 */
export async function replayGif(
  record: GameRecord,
  art: CardArt,
  moments: Moment[]
): Promise<Blob> {
  const { canvas, draw } = cardCanvas(SCALE);
  const frames = framesOf(moments, record);
  const last = frames.length - 1;
  const pixels = (scene: Scene) => {
    drawResultCard(draw, record, art, scene, true);
    return draw.getImageData(0, 0, canvas.width, canvas.height).data;
  };

  const worker = new Worker(new URL("../../workers/gifWorker.ts", import.meta.url), {
    type: "module",
  });
  const ask = (request: GifRequest, transfer: Transferable[] = []) =>
    new Promise<GifReply>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<GifReply>) => resolve(event.data);
      worker.onerror = () => reject(new Error("The replay could not be put together"));
      worker.postMessage(request, transfer);
    });

  try {
    // one palette for the whole film, taken from its emptiest, middle and fullest frames
    const samples = [0, last >> 1, last].map((step) => pixels(frames[step].scene));
    const sample = new Uint8ClampedArray(samples[0].length * samples.length);
    samples.forEach((frame, index) => sample.set(frame, index * frame.length));
    await ask({ kind: "palette", sample }, [sample.buffer]);

    for (const { scene, delay } of frames) {
      const frame = pixels(scene);
      await ask(
        { kind: "frame", pixels: frame, width: canvas.width, height: canvas.height, delay },
        [frame.buffer]
      );
    }
    const bytes = await ask({ kind: "finish" });
    if (!bytes) throw new Error("The replay came back empty");
    return new Blob([bytes], { type: "image/gif" });
  } finally {
    worker.terminate();
  }
}
