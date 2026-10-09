import { GIFEncoder, applyPalette, quantize, type Palette } from "gifenc";

/**
 * Turns the replay's frames into a GIF away from the page, which only has to draw them. One
 * worker makes one GIF: it is sent a sample to take the palette from, then every frame in
 * order, then asked to finish.
 */
export type GifRequest =
  | { kind: "palette"; sample: Uint8ClampedArray }
  | { kind: "frame"; pixels: Uint8ClampedArray; width: number; height: number; delay: number }
  | { kind: "finish" };

/** Every request is answered once it has been dealt with; only the last answer is the file. */
export type GifReply = Uint8Array<ArrayBuffer> | null;

type WorkerScope = typeof globalThis & {
  onmessage: ((event: MessageEvent<GifRequest>) => void) | null;
  postMessage(message: GifReply): void;
};

const workerScope = self as WorkerScope;
const gif = GIFEncoder();
let colors: Palette = [];
let shown: Uint8Array | undefined;

/**
 * Each frame after the first carries only the pixels that changed, so the film costs little
 * more than its opening picture however long the game ran.
 */
function addFrame({ pixels, width, height, delay }: GifRequest & { kind: "frame" }): void {
  const frame = applyPalette(pixels, colors);
  const before = shown;
  // one more entry than the pictures use, to stand for "as the frame before"
  const unchanged = colors.length;
  gif.writeFrame(
    before ? frame.map((color, pixel) => (color === before[pixel] ? unchanged : color)) : frame,
    width,
    height,
    {
      palette: before ? undefined : [...colors, [0, 0, 0]],
      delay,
      transparent: before !== undefined,
      transparentIndex: unchanged,
      dispose: 1,
    }
  );
  shown = frame;
}

workerScope.onmessage = ({ data }) => {
  switch (data.kind) {
    case "palette":
      colors = quantize(data.sample, 255);
      break;
    case "frame":
      addFrame(data);
      break;
    case "finish":
      gif.finish();
      workerScope.postMessage(gif.bytes());
      return;
  }
  workerScope.postMessage(null);
};
