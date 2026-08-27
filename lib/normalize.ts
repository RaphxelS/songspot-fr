/**
 * Normalisation accent-insensitive pour recherche
 * - Map ligatures œ→oe, Œ→OE, æ→ae, Æ→AE
 * - NFD + strip diacritics
 * - Lowercase
 * - Trim
 */

const LIGATURE_MAP: Record<string, string> = {
  "œ": "oe",
  "Œ": "OE",
  "æ": "ae",
  "Æ": "AE",
};

const LIGATURE_RE = /[œŒæÆ]/g;

/**
 * Normalise une chaîne pour comparaison accent-insensitive.
 * @example normalize("Àngèle") === "angele"
 * @example normalize("Cœur") === "coeur"
 * @example normalize("Œuvre") === "oeuvre"
 * @example normalize("Été") === "ete"
 */
export function normalize(str: string): string {
  if (!str) return "";
  // 1. Map ligatures
  const mapped = str.replace(LIGATURE_RE, (m) => LIGATURE_MAP[m] ?? m);
  // 2. NFD decomposition + strip combining marks
  const nfd = mapped.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // 3. Lowercase
  return nfd.toLowerCase();
}

export default normalize;
