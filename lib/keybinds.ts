/**
 * lib/keybinds.ts — raccourcis configurables pour Lecture / Passer
 * - DEFAULT_KEYBINDS : Espace = Lecture, S = Passer
 * - normalizeKey / formatKey / isTypingTarget helpers
 */

export type Keybinds = {
  play: string;
  skip: string;
};

export const DEFAULT_KEYBINDS: Keybinds = {
  play: " ",
  skip: "s",
} as const;

/**
 * Normalizes event.key to storage form.
 * - " " stays " " (Espace)
 * - single char : lowercased ("S" -> "s", "s" -> "s")
 * - fallback : as-is lowercased
 */
export function normalizeKey(rawKey: string): string {
  if (rawKey === " " || rawKey === "Spacebar" || rawKey === "Space") return " ";
  if (typeof rawKey !== "string" || rawKey.length === 0) return "";
  // For single char keys, lower case
  if (rawKey.length === 1) return rawKey.toLowerCase();
  // For named keys like "Enter", keep as-is lowercased?
  return rawKey.toLowerCase();
}

/**
 * Format stored key for display UI.
 * " " -> "Espace", "s" -> "S", otherwise upper/keep
 */
export function formatKey(key: string): string {
  if (key === " " || key === "") return "Espace";
  if (key.length === 1) return key.toUpperCase();
  // capitalize first letter for named keys
  return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
}

/**
 * Validate that a key can be used as keybind (single char or space, not modifier)
 */
export function isValidKeybindKey(key: string): boolean {
  if (key === " ") return true;
  if (typeof key !== "string" || key.length !== 1) return false;
  // allow letters, digits, space already handled; block empty
  return key.trim().length === 1 || key === " ";
}

/**
 * Returns true if the event target is a typing field where keybinds should be ignored.
 */
export function isTypingTarget(element: Element | null): boolean {
  if (!element) return false;
  const tag = element.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((element as HTMLElement).isContentEditable) return true;
  const editable = element.getAttribute?.("contenteditable");
  if (editable === "true" || editable === "") return true;
  // Also check closest contenteditable ancestor
  if (typeof element.closest === "function") {
    const nearEditable = element.closest('[contenteditable="true"], [contenteditable=""]');
    if (nearEditable) return true;
  }
  return false;
}

/**
 * Totales? No — ensure stored keybinds have fallback defaults
 */
export function normalizeKeybinds(raw: unknown): Keybinds {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_KEYBINDS };
  const obj = raw as Record<string, unknown>;
  let play = typeof obj.play === "string" ? normalizeKey(obj.play) : DEFAULT_KEYBINDS.play;
  let skip = typeof obj.skip === "string" ? normalizeKey(obj.skip) : DEFAULT_KEYBINDS.skip;
  // Validate single char or space, fallback on invalid
  if (!isValidKeybindKey(play) && play !== " ") play = DEFAULT_KEYBINDS.play;
  if (!isValidKeybindKey(skip) && skip !== " ") skip = DEFAULT_KEYBINDS.skip;
  // play and skip shouldn't be same; if same, fallback skip
  if (play === skip) {
    // keep play, reset skip to default if conflict
    if (skip === DEFAULT_KEYBINDS.skip) play = DEFAULT_KEYBINDS.play;
    else skip = DEFAULT_KEYBINDS.skip;
  }
  return { play, skip };
}
