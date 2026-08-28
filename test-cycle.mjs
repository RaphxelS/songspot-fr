import { getNextDifficulty, DIFFICULTY_LABELS } from "./lib/difficulty.ts";
console.log("labels", DIFFICULTY_LABELS);
for (const d of [...DIFFICULTY_LABELS, "Toutes", "invalid", ""]) {
  try {
    const next = getNextDifficulty(d);
    console.log(`${d} -> ${next}`);
  } catch(e) { console.log("err", e.message)}
}
