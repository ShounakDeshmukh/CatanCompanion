/** How the Play page behaves on this device, as opposed to anything about a game. */
export interface Prefs {
  /** Dice, building and barbarian sounds, with a buzz on phones that can. */
  sound: boolean;
  /** Minutes into a turn at which the clock starts to nag, or 0 for never. */
  nudge: number;
}

/** The choices the nudge steps through, in minutes. */
export const NUDGE_STEPS = [0, 1, 2, 3, 5];

const DEFAULTS: Prefs = { sound: false, nudge: 0 };
const STORAGE_KEY = "catan-comp-prefs";

/** Keeps what is recognisable of some stored preferences and defaults the rest. */
export function parsePrefs(raw: unknown): Prefs {
  if (typeof raw !== "object" || raw === null) return DEFAULTS;
  const { sound, nudge } = raw as Record<string, unknown>;
  return {
    sound: sound === true,
    nudge: NUDGE_STEPS.includes(nudge as number) ? (nudge as number) : DEFAULTS.nudge,
  };
}

export function loadPrefs(): Prefs {
  try {
    return parsePrefs(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return DEFAULTS;
  }
}

export function savePrefs(prefs: Prefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
