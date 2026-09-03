import type { LikedScopeSelection } from "@/lib/constants";

export function isValidScopedSelection(
  selection: LikedScopeSelection,
  artists: { id: string }[],
  genres: { name: string }[],
): boolean {
  if (selection.scope === "all") return true;
  if (selection.scope === "artist") {
    if (selection.artistId === null) return true;
    return artists.some((a) => a.id === selection.artistId);
  }
  if (selection.scope === "genre") {
    if (selection.genre === null) return true;
    return genres.some((g) => g.name === selection.genre);
  }
  return false;
}
