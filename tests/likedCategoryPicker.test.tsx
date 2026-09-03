import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LikedCategoryPicker from "@/components/game/LikedCategoryPicker";
import { DEFAULT_LIKED_SCOPE_SELECTION } from "@/lib/constants";

describe("LikedCategoryPicker", () => {
  const artists = [
    { id: "bp", name: "BLACKPINK", likedCount: 3 },
    { id: "st", name: "Stromae", likedCount: 1 },
  ];
  const genres = [
    { name: "k-pop", likedCount: 3 },
    { name: "french pop", likedCount: 1 },
  ];

  const onSelectionChange = vi.fn();

  beforeEach(() => {
    onSelectionChange.mockReset();
  });

  it("renders scope tabs", () => {
    render(
      <LikedCategoryPicker
        selection={DEFAULT_LIKED_SCOPE_SELECTION}
        onSelectionChange={onSelectionChange}
        artists={artists}
        genres={genres}
        totalLiked={4}
        loading={false}
        error={null}
        poolSize={4}
        likedInPool={null}
        enrichedInPool={null}
        enrichWarning={null}
        poolLoading={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Tous mes titres" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Par artiste" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Par genre" })).toBeInTheDocument();
  });

  it("shows artist list and enrich checkbox when artist scope selected", () => {
    render(
      <LikedCategoryPicker
        selection={{ scope: "artist", artistId: "bp", genre: null, enrich: false }}
        onSelectionChange={onSelectionChange}
        artists={artists}
        genres={genres}
        totalLiked={4}
        loading={false}
        error={null}
        poolSize={3}
        likedInPool={3}
        enrichedInPool={0}
        enrichWarning={null}
        poolLoading={false}
      />,
    );
    expect(screen.getByText("BLACKPINK")).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Enrichir avec d'autres titres de BLACKPINK/i),
    ).toBeInTheDocument();
  });

  it("hides enrich checkbox for all scope", () => {
    render(
      <LikedCategoryPicker
        selection={DEFAULT_LIKED_SCOPE_SELECTION}
        onSelectionChange={onSelectionChange}
        artists={artists}
        genres={genres}
        totalLiked={4}
        loading={false}
        error={null}
        poolSize={4}
        likedInPool={null}
        enrichedInPool={null}
        enrichWarning={null}
        poolLoading={false}
      />,
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("calls onSelectionChange when artist is picked", () => {
    render(
      <LikedCategoryPicker
        selection={{ scope: "artist", artistId: null, genre: null, enrich: false }}
        onSelectionChange={onSelectionChange}
        artists={artists}
        genres={genres}
        totalLiked={4}
        loading={false}
        error={null}
        poolSize={null}
        likedInPool={null}
        enrichedInPool={null}
        enrichWarning={null}
        poolLoading={false}
      />,
    );
    fireEvent.click(screen.getByRole("option", { name: /BLACKPINK/i }));
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "artist", artistId: "bp", enrich: false }),
    );
  });

  it("calls onSelectionChange when enrich toggled", () => {
    render(
      <LikedCategoryPicker
        selection={{ scope: "artist", artistId: "bp", genre: null, enrich: false }}
        onSelectionChange={onSelectionChange}
        artists={artists}
        genres={genres}
        totalLiked={4}
        loading={false}
        error={null}
        poolSize={3}
        likedInPool={3}
        enrichedInPool={0}
        enrichWarning={null}
        poolLoading={false}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({ enrich: true }),
    );
  });

  it("shows enrich warning when enrichment adds no tracks", () => {
    render(
      <LikedCategoryPicker
        selection={{ scope: "genre", artistId: null, genre: "k-pop", enrich: true }}
        onSelectionChange={onSelectionChange}
        artists={artists}
        genres={genres}
        totalLiked={4}
        loading={false}
        error={null}
        poolSize={3}
        likedInPool={3}
        enrichedInPool={0}
        enrichWarning="Spotify n'a pas pu suggérer d'autres titres pour ce genre — seuls vos titres aimés seront utilisés."
        poolLoading={false}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Spotify n'a pas pu suggérer");
  });

  it("shows categories error with retry button", () => {
    const onRetry = vi.fn();
    render(
      <LikedCategoryPicker
        selection={DEFAULT_LIKED_SCOPE_SELECTION}
        onSelectionChange={onSelectionChange}
        artists={[]}
        genres={[]}
        totalLiked={null}
        loading={false}
        error="Erreur Spotify"
        onRetry={onRetry}
        poolSize={null}
        likedInPool={null}
        enrichedInPool={null}
        enrichWarning={null}
        poolLoading={false}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Erreur Spotify");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onRetry).toHaveBeenCalled();
  });
});
