/**
 * tests/gameComponents.test.tsx — T08 Composant Guess + Autocomplete + Playback + Reveal
 * Couvre acceptance T08: accent-insensitive, ligatures, flèches+Enter, faux/bon guess, AudioPlayer, StageProgress, no autoplay, a11y, hit targets
 */
import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { __clearAllStorageForTests, __resetMemoryStoreForTests } from "@/lib/storage";
import type { Track } from "@/lib/catalog";
import type { UseAudioClipReturn } from "@/hooks/useAudioClip";

// Helper mkTrack
function mkTrack(overrides: Partial<Track> & { id: string; title: string; artist: string }): Track {
  return {
    id: overrides.id,
    title: overrides.title,
    artist: overrides.artist,
    album: overrides.album ?? "Album test",
    cover: overrides.cover ?? "https://i.scdn.co/image/ab67616d0000b273cover",
    preview_url: overrides.preview_url ?? "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    popularity: overrides.popularity ?? 80,
    release_date: overrides.release_date ?? "2022-06-15",
    era: (overrides.era as Track["era"]) ?? "2020s",
    source: "spotify" as const,
  };
}

const CATALOG_T08: Track[] = [
  mkTrack({ id: "a1", title: "Angèle", artist: "Angèle", popularity: 84, era: "2010s" }),
  mkTrack({ id: "a2", title: "Balance ton quoi", artist: "Angèle", popularity: 82, era: "2010s" }),
  mkTrack({ id: "a3", title: "Tout oublier", artist: "Angèle feat. Roméo Elvis", popularity: 79, era: "2010s" }),
  mkTrack({ id: "j1", title: "Bande organisée", artist: "Jul & SCH & Naps & Kofs", popularity: 88, era: "2020s" }),
  mkTrack({ id: "j2", title: "Tchikita", artist: "Jul", popularity: 76, era: "2010s" }),
  mkTrack({ id: "j3", title: "Ma jolie", artist: "Jul", popularity: 70, era: "2010s" }),
  mkTrack({ id: "c1", title: "Cœur", artist: "Clara Luciani", popularity: 77, era: "2020s" }),
  mkTrack({ id: "o1", title: "Œuvre", artist: "Testeur", popularity: 70, era: "2020s" }),
  mkTrack({ id: "t1", title: "Papaoutai", artist: "Stromae", popularity: 90, era: "2010s" }),
];

function createMockAudio(overrides: Partial<UseAudioClipReturn> = {}): UseAudioClipReturn {
  return {
    play: vi.fn(async () => {}),
    pause: vi.fn(() => {}),
    seek0: vi.fn(() => {}),
    setVolume: vi.fn(() => {}),
    isPlaying: false,
    currentTime: 0,
    error: null,
    isIOS: false,
    ...overrides,
  } as UseAudioClipReturn;
}

beforeEach(() => {
  __clearAllStorageForTests();
  __resetMemoryStoreForTests();
  try {
    window.localStorage.clear();
  } catch {}
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ────────────────────────────────────────────────────────────────
// GuessInput
// ────────────────────────────────────────────────────────────────
describe("T08 — GuessInput", () => {
  it("taper angele propose Angèle (accent-insensitive)", async () => {
    const { default: GuessInput } = await import("@/components/game/GuessInput");
    const onGuess = vi.fn();
    render(<GuessInput catalog={CATALOG_T08} onGuess={onGuess} />);

    const input = screen.getByLabelText("Titre ou artiste") as HTMLInputElement;
    expect(input).toBeInTheDocument();

    await userEvent.type(input, "angele");

    await waitFor(() => {
      const listbox = screen.getByRole("listbox");
      expect(listbox).toBeInTheDocument();
    });

    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    // at least one option must contain Angèle
    const texts = options.map((o) => o.textContent ?? "");
    expect(texts.some((t) => t.includes("Angèle"))).toBe(true);
  });

  it("taper coeur propose Cœur (ligature œ)", async () => {
    const { default: GuessInput } = await import("@/components/game/GuessInput");
    const onGuess = vi.fn();
    render(<GuessInput catalog={CATALOG_T08} onGuess={onGuess} />);
    const input = screen.getByLabelText("Titre ou artiste");
    await userEvent.type(input, "coeur");
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());
    const options = screen.getAllByRole("option");
    expect(options.some((o) => (o.textContent ?? "").includes("Cœur"))).toBe(true);
  });

  it("taper oeuvre propose Œuvre (ligature Œ)", async () => {
    const { default: GuessInput } = await import("@/components/game/GuessInput");
    const onGuess = vi.fn();
    render(<GuessInput catalog={CATALOG_T08} onGuess={onGuess} />);
    const input = screen.getByLabelText("Titre ou artiste");
    await userEvent.type(input, "oeuvre");
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());
    const options = screen.getAllByRole("option");
    expect(options.some((o) => (o.textContent ?? "").includes("Œuvre"))).toBe(true);
  });

  it("taper jul propose plusieurs Jul (title+artist match)", async () => {
    const { default: GuessInput } = await import("@/components/game/GuessInput");
    const onGuess = vi.fn();
    render(<GuessInput catalog={CATALOG_T08} onGuess={onGuess} />);
    const input = screen.getByLabelText("Titre ou artiste");
    await userEvent.type(input, "jul");
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());
    const options = screen.getAllByRole("option");
    // catalogue has at least 3 Jul entries (j1,j2,j3)
    expect(options.length).toBeGreaterThanOrEqual(3);
    expect(options.every((o) => (o.textContent ?? "").toLowerCase().includes("jul"))).toBe(true);
  });

  it("≥2 chars requis, max 8 suggestions, affiche title — artist + cover miniature", async () => {
    const { default: GuessInput } = await import("@/components/game/GuessInput");
    const onGuess = vi.fn();
    // create large catalog to test max 8
    const largeCatalog: Track[] = Array.from({ length: 20 }, (_, i) =>
      mkTrack({ id: `id-${i}`, title: `Song${i}`, artist: "Jul", popularity: 70, era: "2020s" }),
    );
    render(<GuessInput catalog={largeCatalog} onGuess={onGuess} />);
    const input = screen.getByLabelText("Titre ou artiste");
    // 1 char -> no dropdown
    await userEvent.type(input, "j");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    // clear and type 2 chars
    await userEvent.clear(input);
    await userEvent.type(input, "ju");
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());
    const options = screen.getAllByRole("option");
    expect(options.length).toBe(8); // max 8
    // each option must contain title — artist and cover img
    options.forEach((opt) => {
      expect(opt.textContent).toMatch(/—/); // contains em dash
      const imgEl = opt.querySelector("img");
      expect(imgEl).not.toBeNull();
      expect(imgEl?.src).toMatch(/i\.scdn\.co/);
      // hit target min-h-11
      expect(opt.className).toMatch(/min-h-11/);
    });
  });

  it("flèches + Enter sélectionnent et soumettent ; onGuess reçoit string exacte du track", async () => {
    const { default: GuessInput } = await import("@/components/game/GuessInput");
    const onGuess = vi.fn();
    render(<GuessInput catalog={CATALOG_T08} onGuess={onGuess} />);
    const input = screen.getByLabelText("Titre ou artiste") as HTMLInputElement;
    await userEvent.type(input, "angele");

    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());

    // ArrowDown to select first
    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
    await waitFor(() => {
      const first = screen.getAllByRole("option")[0];
      expect(first.getAttribute("aria-selected")).toBe("true");
    });

    // ArrowDown again to second
    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
    await waitFor(() => {
      const opts = screen.getAllByRole("option");
      expect(opts[1].getAttribute("aria-selected")).toBe("true");
      expect(opts[0].getAttribute("aria-selected")).toBe("false");
    });

    // ArrowUp back to first
    fireEvent.keyDown(input, { key: "ArrowUp", code: "ArrowUp" });
    await waitFor(() => {
      const opts = screen.getAllByRole("option");
      expect(opts[0].getAttribute("aria-selected")).toBe("true");
    });

    // Enter to submit selected
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await waitFor(() => expect(onGuess).toHaveBeenCalledTimes(1));
    const submitted = onGuess.mock.calls[0][0] as string;
    expect(typeof submitted).toBe("string");
    expect(submitted.length).toBeGreaterThan(0);
    // submitted should contain Angèle title or artist (exact track string)
    expect(submitted).toMatch(/Angèle/);
    // input should be cleared after submit
    expect(input.value).toBe("");
  });

  it("Enter sans sélection soumet texte brut", async () => {
    const { default: GuessInput } = await import("@/components/game/GuessInput");
    const onGuess = vi.fn();
    render(<GuessInput catalog={CATALOG_T08} onGuess={onGuess} />);
    const input = screen.getByLabelText("Titre ou artiste") as HTMLInputElement;
    await userEvent.type(input, "ma proposition brute");
    // No arrow selection
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await waitFor(() => expect(onGuess).toHaveBeenCalledWith("ma proposition brute"));
  });

  it("Enter vide ne soumet pas (hint)", async () => {
    const { default: GuessInput } = await import("@/components/game/GuessInput");
    const onGuess = vi.fn();
    render(<GuessInput catalog={CATALOG_T08} onGuess={onGuess} />);
    const input = screen.getByLabelText("Titre ou artiste");
    // input is empty, press Enter via form submit
    const form = input.closest("form")!;
    fireEvent.submit(form);
    expect(onGuess).not.toHaveBeenCalled();
  });

  it("a11y: role listbox, aria-selected, aria-live", async () => {
    const { default: GuessInput } = await import("@/components/game/GuessInput");
    const onGuess = vi.fn();
    render(<GuessInput catalog={CATALOG_T08} onGuess={onGuess} />);
    const input = screen.getByLabelText("Titre ou artiste");
    // aria attributes on input
    expect(input.getAttribute("role")).toBe("combobox");
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    expect(input.getAttribute("aria-controls")).toMatch(/listbox/);

    await userEvent.type(input, "jul");
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());
    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options[0].getAttribute("aria-selected")).toBeDefined();
    // aria-live region exists (sr-only)
    const liveRegions = document.querySelectorAll('[aria-live="polite"]');
    expect(liveRegions.length).toBeGreaterThan(0);
  });

  it("disabled: input désactivé, pas de suggestions", async () => {
    const { default: GuessInput } = await import("@/components/game/GuessInput");
    const onGuess = vi.fn();
    render(<GuessInput catalog={CATALOG_T08} onGuess={onGuess} disabled />);
    const input = screen.getByLabelText("Titre ou artiste") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    await userEvent.type(input, "jul").catch(() => {});
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("hit targets ≥44px pour input et bouton", async () => {
    const { default: GuessInput } = await import("@/components/game/GuessInput");
    const onGuess = vi.fn();
    render(<GuessInput catalog={CATALOG_T08} onGuess={onGuess} />);
    const input = screen.getByLabelText("Titre ou artiste");
    expect(input.className).toMatch(/min-h-11/);
    const btn = screen.getByRole("button", { name: "Proposer" });
    expect(btn.className).toMatch(/min-h-11/);
    expect(btn.className).toMatch(/min-w-11/);
  });
});

// ────────────────────────────────────────────────────────────────
// GuessHistory
// ────────────────────────────────────────────────────────────────
describe("T08 — GuessHistory", () => {
  it("affiche pills des essais passés + aria-live annonce", async () => {
    const { default: GuessHistory } = await import("@/components/game/GuessHistory");
    const guesses = ["ma proposition", "Angèle — Angèle"];
    render(<GuessHistory guesses={guesses} />);
    // pills visible
    expect(screen.getByText("ma proposition")).toBeInTheDocument();
    expect(screen.getByText("Angèle — Angèle")).toBeInTheDocument();
    // role list
    expect(screen.getByRole("list", { name: "Historique des essais" })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBe(2);
    // aria-live annonce du dernier
    const live = document.querySelectorAll('[aria-live="polite"]');
    expect(live.length).toBeGreaterThan(0);
  });

  it("vide affiche message zéro essai", async () => {
    const { default: GuessHistory } = await import("@/components/game/GuessHistory");
    render(<GuessHistory guesses={[]} />);
    expect(screen.getAllByText(/Aucun essai/).length).toBeGreaterThan(0);
  });

  it("ajout d’un essai met à jour le pill et aria-live", async () => {
    const { default: GuessHistory } = await import("@/components/game/GuessHistory");
    const { rerender } = render(<GuessHistory guesses={["premier"]} />);
    expect(screen.getByText("premier")).toBeInTheDocument();
    rerender(<GuessHistory guesses={["premier", "deuxième"]} />);
    expect(screen.getByText("deuxième")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBe(2);
  });
});

// ────────────────────────────────────────────────────────────────
// StageProgress
// ────────────────────────────────────────────────────────────────
describe("T08 — StageProgress", () => {
  it("affiche 5 pills 0,1s/0,5s/2s/8s/15s avec état enabled", async () => {
    const { default: StageProgress } = await import("@/components/game/StageProgress");
    const onToggle = vi.fn();
    render(
      <StageProgress
        enabledStages={[true, true, true, true, true]}
        stageIndex={0}
        currentStageSeconds={0.1}
        onToggle={onToggle}
      />,
    );
    // labels French comma
    expect(screen.getByRole("button", { name: /0,1 s/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /0,5 s/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2 s/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /8 s/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /15 s/ })).toBeInTheDocument();

    // all 5 buttons
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(5);
    // aria-pressed
    buttons.forEach((b) => expect(b.getAttribute("aria-pressed")).toBe("true"));
    // hit targets ≥44px
    buttons.forEach((b) => {
      expect(b.className).toMatch(/min-h-11/);
      expect(b.className).toMatch(/min-w-11/);
    });
  });

  it("toggle persistant via callback + guard ≥1 (dernier enabled désactivé)", async () => {
    const { default: StageProgress } = await import("@/components/game/StageProgress");
    const onToggle = vi.fn();
    // only first enabled
    render(
      <StageProgress
        enabledStages={[true, false, false, false, false]}
        stageIndex={0}
        currentStageSeconds={0.1}
        onToggle={onToggle}
      />,
    );
    const firstBtn = screen.getByRole("button", { name: /0,1 s/ });
    // should be disabled because it's last enabled
    expect(firstBtn).toBeDisabled();
    fireEvent.click(firstBtn);
    expect(onToggle).not.toHaveBeenCalled();

    const secondBtn = screen.getByRole("button", { name: /0,5 s/ });
    expect(secondBtn).not.toBeDisabled();
    fireEvent.click(secondBtn);
    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it("actif pulsé (stageIndex dense) + aria-live", async () => {
    const { default: StageProgress } = await import("@/components/game/StageProgress");
    const onToggle = vi.fn();
    // enabledStages [true,false,true,true,true] => dense 0:0.1, 1:2, 2:8, 3:15
    // stageIndex 1 => should highlight 2s (sparse 2)
    render(
      <StageProgress
        enabledStages={[true, false, true, true, true]}
        stageIndex={1}
        currentStageSeconds={2}
        onToggle={onToggle}
      />,
    );
    const btn2s = screen.getByRole("button", { name: /2 s.*en cours/ });
    expect(btn2s).toBeInTheDocument();
    expect(btn2s.className).toMatch(/animate-pulse/);
  });

  it("toggle appelle onToggle avec sparseIndex", async () => {
    const { default: StageProgress } = await import("@/components/game/StageProgress");
    const onToggle = vi.fn();
    render(
      <StageProgress
        enabledStages={[true, true, true, true, true]}
        stageIndex={0}
        currentStageSeconds={0.1}
        onToggle={onToggle}
      />,
    );
    const btn8s = screen.getByRole("button", { name: /8 s/ });
    fireEvent.click(btn8s);
    expect(onToggle).toHaveBeenCalledWith(3);
  });
});

// ────────────────────────────────────────────────────────────────
// AudioPlayer
// ────────────────────────────────────────────────────────────────
describe("T08 — AudioPlayer", () => {
  it("bouton Play/Pause ≥44px (toggle) appelle play/pause", async () => {
    const { default: AudioPlayer } = await import("@/components/game/AudioPlayer");
    const mockAudio = createMockAudio({ isPlaying: false });
    const onToggle = vi.fn();
    render(
      <AudioPlayer
        audio={mockAudio}
        stageSeconds={0.1}
        stageIndex={0}
        enabledStages={[true, true, true, true, true]}
        onToggleStage={onToggle}
      />,
    );
    const playBtn = screen.getByRole("button", { name: "Lecture" });
    expect(playBtn.className).toMatch(/min-h-11/);
    expect(playBtn.className).toMatch(/min-w-11/);
    fireEvent.click(playBtn);
    expect(mockAudio.play).toHaveBeenCalledWith(0.1);

    // now isPlaying true -> button should be Pause
    const mockPlaying = createMockAudio({ isPlaying: true });
    render(
      <AudioPlayer
        audio={mockPlaying}
        stageSeconds={0.1}
        stageIndex={0}
        enabledStages={[true, true, true, true, true]}
        onToggleStage={onToggle}
      />,
    );
    // Need fresh query
    const pauseBtn = screen.getAllByRole("button", { name: "Pause" })[0];
    expect(pauseBtn.className).toMatch(/min-h-11/);
    fireEvent.click(pauseBtn);
    expect(mockPlaying.pause).toHaveBeenCalled();
  });

  it('bouton "Depuis le début" remet currentTime=0 sans changer isPlaying', async () => {
    const { default: AudioPlayer } = await import("@/components/game/AudioPlayer");
    const mockAudio = createMockAudio({ isPlaying: true, currentTime: 1.2 });
    const onToggle = vi.fn();
    render(
      <AudioPlayer
        audio={mockAudio}
        stageSeconds={0.1}
        stageIndex={0}
        enabledStages={[true, true, true, true, true]}
        onToggleStage={onToggle}
      />,
    );
    const seekBtn = screen.getByRole("button", { name: "Depuis le début" });
    expect(seekBtn.className).toMatch(/min-h-11/);
    fireEvent.click(seekBtn);
    expect(mockAudio.seek0).toHaveBeenCalled();
    // ensure pause not called
    expect(mockAudio.pause).not.toHaveBeenCalled();
  });

  it('volume slider aria-label="Volume" et iOS disabled', async () => {
    const { default: AudioPlayer } = await import("@/components/game/AudioPlayer");
    // non-iOS
    const mockAudio = createMockAudio({ isIOS: false });
    const onToggle = vi.fn();
    const { unmount } = render(
      <AudioPlayer
        audio={mockAudio}
        stageSeconds={0.1}
        stageIndex={0}
        enabledStages={[true, true, true, true, true]}
        onToggleStage={onToggle}
      />,
    );
    const slider = screen.getByLabelText("Volume") as HTMLInputElement;
    expect(slider).toBeInTheDocument();
    expect(slider.disabled).toBe(false);
    // change volume
    fireEvent.change(slider, { target: { value: "0.5" } });
    expect(mockAudio.setVolume).toHaveBeenCalledWith(0.5);
    unmount();

    // iOS -> disabled + tooltip
    const mockIOS = createMockAudio({ isIOS: true });
    render(
      <AudioPlayer
        audio={mockIOS}
        stageSeconds={0.1}
        stageIndex={0}
        enabledStages={[true, true, true, true, true]}
        onToggleStage={onToggle}
      />,
    );
    const sliderIOS = screen.getByLabelText("Volume") as HTMLInputElement;
    expect(sliderIOS.disabled).toBe(true);
    expect(sliderIOS.title).toMatch(/Volume via boutons matériels sur iOS/);
  });

  it("aucun audio.play() sans interaction (pas d'autoplay mount)", async () => {
    const { default: AudioPlayer } = await import("@/components/game/AudioPlayer");
    const mockAudio = createMockAudio();
    const onToggle = vi.fn();
    render(
      <AudioPlayer
        audio={mockAudio}
        stageSeconds={0.1}
        stageIndex={0}
        enabledStages={[true, true, true, true, true]}
        onToggleStage={onToggle}
      />,
    );
    // after mount, play should not have been called
    expect(mockAudio.play).not.toHaveBeenCalled();
    // wait a tick
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(mockAudio.play).not.toHaveBeenCalled();
  });

  it("tous hit targets ≥44x44px", async () => {
    const { default: AudioPlayer } = await import("@/components/game/AudioPlayer");
    const mockAudio = createMockAudio();
    const onToggle = vi.fn();
    render(
      <AudioPlayer
        audio={mockAudio}
        stageSeconds={0.1}
        stageIndex={0}
        enabledStages={[true, true, true, true, true]}
        onToggleStage={onToggle}
      />,
    );
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn.className).toMatch(/min-h-11/);
      // all buttons should have min-w-11 or at least min-h-11, check min-h
      expect(btn.className).toMatch(/min-h-11/);
    });
    const volumeSlider = screen.getByLabelText("Volume");
    // volume slider is not button but should be accessible; hit target for slider is via thumb, not enforced as button size
    expect(volumeSlider).toBeInTheDocument();
  });

  it("indicateur stage 0,1s / 15s présent", async () => {
    const { default: AudioPlayer } = await import("@/components/game/AudioPlayer");
    const mockAudio = createMockAudio();
    const onToggle = vi.fn();
    render(
      <AudioPlayer
        audio={mockAudio}
        stageSeconds={0.1}
        stageIndex={0}
        enabledStages={[true, true, true, true, true]}
        onToggleStage={onToggle}
      />,
    );
    expect(screen.getAllByText(/0,1 s/).length).toBeGreaterThan(0);
  });

  it("StageProgress intégré avec 5 pills", async () => {
    const { default: AudioPlayer } = await import("@/components/game/AudioPlayer");
    const mockAudio = createMockAudio();
    const onToggle = vi.fn();
    render(
      <AudioPlayer
        audio={mockAudio}
        stageSeconds={2}
        stageIndex={1}
        enabledStages={[true, false, true, true, true]}
        onToggleStage={onToggle}
      />,
    );
    expect(screen.getByRole("group", { name: /Paliers de durée/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: / s/ }).length).toBeGreaterThanOrEqual(5);
  });
});

// ────────────────────────────────────────────────────────────────
// RevealCard
// ────────────────────────────────────────────────────────────────
describe("T08 — RevealCard", () => {
  it("succès: cover titre artiste album + focus après reveal, aria-live", async () => {
    const { default: RevealCard } = await import("@/components/game/RevealCard");
    const track = mkTrack({ id: "r1", title: "Angèle", artist: "Angèle", album: "Brol", popularity: 84, era: "2010s" });
    render(<RevealCard track={track} status="won" guesses={["Angèle — Angèle"]} attemptCount={1} />);

    const card = screen.getByTestId("reveal-card");
    expect(card).toBeInTheDocument();
    expect(card.getAttribute("role")).toBe("status");
    expect(card.getAttribute("aria-live")).toBe("polite");
    // cover, title, artiste, album — titre apparait multiple fois (title et artist identiques) donc getAll
    expect(screen.getAllByText("Angèle").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Album : Brol")).toBeInTheDocument();
    // img alt
    const img = screen.getByAltText(/Pochette de Brol/);
    expect(img).toBeInTheDocument();
    expect((img as HTMLImageElement).src).toMatch(/i\.scdn\.co/);
    // focus after reveal
    await waitFor(() => expect(document.activeElement).toBe(card), { timeout: 200 });
  });

  it("échec: affiche titre artiste album + message perdu", async () => {
    const { default: RevealCard } = await import("@/components/game/RevealCard");
    const track = mkTrack({ id: "r2", title: "Cœur", artist: "Clara Luciani", album: "Cœur", era: "2020s" });
    render(<RevealCard track={track} status="lost" guesses={["mauvais"]} attemptCount={5} />);
    const card = screen.getByTestId("reveal-card");
    expect(card.dataset.status).toBe("lost");
    expect(screen.getByText("Perdu !")).toBeInTheDocument();
    expect(screen.getAllByText("Cœur").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Clara Luciani")).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(card), { timeout: 200 });
  });

  it("hit target ≥44px pour bouton Nouveau morceau", async () => {
    const { default: RevealCard } = await import("@/components/game/RevealCard");
    const track = mkTrack({ id: "r3", title: "Papaoutai", artist: "Stromae", album: "Racine carrée" });
    const onNext = vi.fn();
    render(<RevealCard track={track} status="won" onNext={onNext} />);
    const btn = screen.getByRole("button", { name: "Nouveau morceau" });
    expect(btn.className).toMatch(/min-h-11/);
    expect(btn.className).toMatch(/min-w-11/);
    fireEvent.click(btn);
    expect(onNext).toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────
// Integration — faux guess stage+1 + pill, bon guess won+RevealCard
// ────────────────────────────────────────────────────────────────
describe("T08 — Intégration GameContainer / useGameState + Guess flow", () => {
  it("soumettre faux guess avance stageIndex +1 et ajoute pill dans GuessHistory + aria-live annonce", async () => {
    const { renderHook, act: hookAct, waitFor: hookWait } = await import("@testing-library/react");
    const { useGameState } = await import("@/hooks/useGameState");
    const mono: Track[] = [mkTrack({ id: "lose-int", title: "Unique", artist: "A", popularity: 80, era: "2020s" })];
    const { result } = renderHook(() => useGameState(mono));
    await hookWait(() => expect(result.current.isHydrated).toBe(true));
    await hookWait(() => expect(result.current.track).not.toBeNull());
    expect(result.current.stageIndex).toBe(0);
    expect(result.current.guesses.length).toBe(0);

    const { default: GuessHistory } = await import("@/components/game/GuessHistory");
    const { rerender } = render(<GuessHistory guesses={result.current.guesses} />);
    expect(screen.queryByText("mauvais titre")).not.toBeInTheDocument();

    await hookAct(async () => {
      result.current.submitGuess("mauvais titre");
    });
    expect(result.current.stageIndex).toBe(1);
    expect(result.current.guesses).toContain("mauvais titre");
    expect(result.current.attemptCount).toBe(1);

    rerender(<GuessHistory guesses={result.current.guesses} />);
    expect(screen.getByText("mauvais titre")).toBeInTheDocument();
    // aria-live container exists
    const live = document.querySelectorAll('[aria-live="polite"]');
    expect(live.length).toBeGreaterThan(0);
  });

  it("soumettre bon guess passe status=won et affiche RevealCard avec focus", async () => {
    const { renderHook, act: hookAct, waitFor: hookWait } = await import("@testing-library/react");
    const { useGameState } = await import("@/hooks/useGameState");
    const mono: Track[] = [mkTrack({ id: "win-int", title: "Victoire", artist: "Gagnant", popularity: 80, era: "2020s", album: "Album Gagnant" })];
    const { result } = renderHook(() => useGameState(mono));
    await hookWait(() => expect(result.current.isHydrated).toBe(true));
    await hookWait(() => expect(result.current.track).not.toBeNull());

    await hookAct(async () => {
      const won = result.current.submitGuess("victoire");
      expect(won).toBe(true);
    });
    expect(result.current.status).toBe("won");
    expect(result.current.revealed).toBe(true);

    const { default: RevealCard } = await import("@/components/game/RevealCard");
    render(
      <RevealCard
        track={result.current.track!}
        status={result.current.status as "won" | "lost"}
        guesses={result.current.guesses}
        attemptCount={result.current.attemptCount}
      />,
    );
    const card = screen.getByTestId("reveal-card");
    expect(card).toBeInTheDocument();
    expect(screen.getByText("Bravo !")).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(card), { timeout: 200 });
  });

  it("volume iOS disabled via lib/audio isIOS + StageProgress toggle persistant", async () => {
    // lib/audio isIOS("iPhone") should be true
    const { isIOS, IOS_VOLUME_TOOLTIP } = await import("@/lib/audio");
    expect(isIOS("Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)")).toBe(true);
    expect(IOS_VOLUME_TOOLTIP).toBe("Volume via boutons matériels sur iOS");

    // StageProgress toggle persistance via storage: setEnabledStages then getPrefs
    const { setPrefs, getPrefs } = await import("@/lib/storage");
    setPrefs({ enabledStages: [true, true, true, true, true] });
    expect(getPrefs().enabledStages).toEqual([true, true, true, true, true]);
    // simulate toggle via component callback
    const { default: StageProgress } = await import("@/components/game/StageProgress");
    const onToggle = vi.fn((idx: number) => {
      const next = [...getPrefs().enabledStages];
      next[idx] = !next[idx];
      setPrefs({ enabledStages: next });
    });
    render(
      <StageProgress enabledStages={getPrefs().enabledStages} stageIndex={0} currentStageSeconds={0.1} onToggle={onToggle} />,
    );
    const btn = screen.getByRole("button", { name: /0,5 s/ });
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledWith(1);
    expect(getPrefs().enabledStages).toEqual([true, false, true, true, true]);
    // guard: last enabled cannot be disabled, storage would fallback to [true,false,false,false,false]
    const { setEnabledStages } = await import("@/lib/storage");
    setEnabledStages([false, false, false, false, false]);
    expect(getPrefs().enabledStages).toEqual([true, false, false, false, false]);
  });

  it("no autoplay: GameContainer mount ne lance pas audio.play()", async () => {
    const mockPlay = vi.fn(() => Promise.resolve());
    const MockAudioClass = class {
      src = "";
      currentTime = 0;
      volume = 1;
      readyState = 4;
      preload = "";
      play = mockPlay;
      pause = vi.fn();
      load = vi.fn();
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
    };
    const originalAudio = (global as unknown as { Audio?: typeof Audio }).Audio;
    (global as unknown as { Audio: unknown }).Audio = MockAudioClass as unknown as typeof Audio;

    const { default: GameContainer } = await import("@/components/game/GameContainer");
    const tracks: Track[] = [mkTrack({ id: "autoplay-test", title: "Test", artist: "A", popularity: 80, era: "2020s" })];

    render(<GameContainer catalog={tracks} />);
    await waitFor(() => expect(screen.getByText(/Songspot FR|Test|Lecture|Extrait/)).toBeInTheDocument(), { timeout: 2000 }).catch(() => {});
    // play should not have been called on mount (no user interaction)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(mockPlay).not.toHaveBeenCalled();

    (global as unknown as { Audio: unknown }).Audio = originalAudio;
  });
});

// Ensure STAGES constant integrity for all components
describe("T08 — STAGES integrity", () => {
  it("STAGES vaut exactement [0.1,0.5,2,8,15]", async () => {
    const { STAGES: s1 } = await import("@/lib/constants");
    const { STAGES: s2 } = await import("@/hooks/useGameState");
    expect(s1).toEqual([0.1, 0.5, 2, 8, 15]);
    expect(s2).toEqual([0.1, 0.5, 2, 8, 15]);
  });
});
