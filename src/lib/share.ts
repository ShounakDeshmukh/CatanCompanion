import type { DataConnection } from "peerjs";
import { parseGame } from "./gameCodec";
import type { GameState } from "./gameState";

/** Everything a viewer needs to draw the host's screen. */
export interface Snapshot {
  state: GameState;
  /** The two faces behind the last total, when the app rolled it. */
  dice?: [number, number];
}

export interface Host {
  send(snapshot: Snapshot): void;
  close(): void;
}

/** Peer ids share one public namespace on the broker, so ours are prefixed. */
const PEER_PREFIX = "catan-companion-";
const RETRY_MS = 3000;
const ROOM_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function newRoomId(): string {
  const picks = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(picks, (pick) => ROOM_ALPHABET[pick % ROOM_ALPHABET.length]).join("");
}

export function watchUrl(room: string): string {
  return `${location.origin}${location.pathname}#watch=${room}`;
}

export function watchedRoom(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, "")).get("watch");
}

export async function qrSvg(text: string): Promise<string> {
  const { default: qrcode } = await import("qrcode-generator");
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();
  return code.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

/**
 * Opens a room that viewers connect to directly. The broker only introduces the two
 * browsers; game data then travels between them. Every viewer is sent the current game the
 * moment it joins, so nobody has to wait for the next tap.
 */
export async function hostRoom(
  room: string,
  latest: () => Snapshot,
  onStatus: (viewers: number, error?: string) => void
): Promise<Host> {
  const { Peer } = await import("peerjs");
  const peer = new Peer(PEER_PREFIX + room);
  const viewers = new Set<DataConnection>();

  peer.on("connection", (connection) => {
    const leave = () => {
      viewers.delete(connection);
      onStatus(viewers.size);
    };
    connection.on("open", () => {
      viewers.add(connection);
      connection.send(latest());
      onStatus(viewers.size);
    });
    connection.on("close", leave);
    connection.on("error", leave);
  });
  // the broker drops idle sockets; connected viewers carry on, but new ones need it back
  peer.on("disconnected", () => {
    if (!peer.destroyed) peer.reconnect();
  });
  peer.on("error", (error) => {
    onStatus(
      viewers.size,
      error.type === "unavailable-id"
        ? "This game is already being shared from another tab or device."
        : "Sharing lost its connection. Check the network and try again."
    );
  });

  return {
    send: (snapshot) => {
      for (const viewer of viewers) viewer.send(snapshot);
    },
    close: () => peer.destroy(),
  };
}

function parseSnapshot(data: unknown): Snapshot | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const { state: rawState, dice } = data as { state?: unknown; dice?: unknown };
  const state = parseGame(rawState);
  if (!state) return undefined;
  const isFace = (face: unknown) => Number.isInteger(face) && Number(face) >= 1 && Number(face) <= 6;
  const rolled = Array.isArray(dice) && dice.length === 2 && dice.every(isFace);
  return { state, dice: rolled ? (dice as [number, number]) : undefined };
}

/** Follows a host's room, reconnecting for as long as the page stays open. */
export async function watchRoom(
  room: string,
  onSnapshot: (snapshot: Snapshot) => void,
  onStatus: (status: string) => void
): Promise<void> {
  const { Peer } = await import("peerjs");
  const peer = new Peer();
  let retry: ReturnType<typeof setTimeout> | undefined;

  const connect = (): void => {
    retry = undefined;
    const connection = peer.connect(PEER_PREFIX + room, { reliable: true, serialization: "json" });
    connection.on("open", () => onStatus("Live"));
    connection.on("data", (data) => {
      const snapshot = parseSnapshot(data);
      if (snapshot) onSnapshot(snapshot);
    });
    connection.on("close", () => retryLater("The host went away. Reconnecting…"));
  };
  const retryLater = (status: string): void => {
    onStatus(status);
    retry ??= setTimeout(connect, RETRY_MS);
  };

  peer.on("open", connect);
  peer.on("disconnected", () => {
    if (!peer.destroyed) peer.reconnect();
  });
  // peer-unavailable just means the host is not sharing yet, or has locked their phone
  peer.on("error", (error) =>
    retryLater(
      error.type === "peer-unavailable" ? "Waiting for the host…" : "Connection trouble. Retrying…"
    )
  );
}
