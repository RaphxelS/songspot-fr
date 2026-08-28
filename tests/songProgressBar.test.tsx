import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SongProgressBar from "@/components/game/SongProgressBar";

describe("SongProgressBar", () => {
  it("renders with 0% when currentTime 0", () => {
    render(<SongProgressBar currentTime={0} duration={0.1} isPlaying={false} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toBeInTheDocument();
    expect(bar.style.width).toBe("0%");
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("0.1");
  });

  it("early stage 0.1s is capped to visual 8%: half -> 4%, full -> 8% (animates 0..8%)", () => {
    const { rerender } = render(<SongProgressBar currentTime={0.05} duration={0.1} isPlaying={true} />);
    let bar = screen.getByRole("progressbar");
    expect(bar.style.width).toBe("4%");
    rerender(<SongProgressBar currentTime={0.1} duration={0.1} />);
    bar = screen.getByRole("progressbar");
    expect(bar.style.width).toBe("8%");
  });

  it("final stage 15s fills 100%", () => {
    render(<SongProgressBar currentTime={15} duration={15} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.style.width).toBe("100%");
  });

  it("mid stages capped to visual: 8/8 -> 62% (stops at 8s tick, not 100%)", () => {
    render(<SongProgressBar currentTime={8} duration={8} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.style.width).toBe("62%");
  });

  it("full preview reveal mode (30s) scales linearly", () => {
    render(<SongProgressBar currentTime={15} duration={30} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.style.width).toBe("50%"); // 15/30 linear
    expect(bar.getAttribute("aria-valuemax")).toBe("30");
  });

  it("clamps to 100% when over duration", () => {
    render(<SongProgressBar currentTime={20} duration={15} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.style.width).toBe("100%");
  });

  it("formats time with comma for <1s", () => {
    render(<SongProgressBar currentTime={0.1} duration={0.5} />);
    expect(screen.getByText(/0,1s \/ 0,5s/)).toBeInTheDocument();
  });

  it("has group data-testid and aria-label progression", () => {
    render(<SongProgressBar currentTime={1} duration={2} />);
    expect(screen.getByTestId("song-progress-bar")).toBeInTheDocument();
    expect(screen.getByRole("progressbar").getAttribute("aria-label")).toBe("Progression de l'extrait");
  });

  it("shows Lecture when isPlaying true and En pause when false", () => {
    const { rerender } = render(<SongProgressBar currentTime={0} duration={1} isPlaying={true} />);
    expect(screen.getByText("Lecture")).toBeInTheDocument();
    rerender(<SongProgressBar currentTime={0} duration={1} isPlaying={false} />);
    expect(screen.getAllByText("En pause").length).toBeGreaterThanOrEqual(1);
  });

  it("starts at 0 before play and animates capped to visual 18% at half duration (0.25/0.5 -> 9%)", () => {
    const { rerender } = render(<SongProgressBar currentTime={0} duration={0.5} isPlaying={false} />);
    expect(screen.getByRole("progressbar").style.width).toBe("0%");
    rerender(<SongProgressBar currentTime={0.25} duration={0.5} isPlaying={true} />);
    expect(screen.getByRole("progressbar").style.width).toBe("9%");
  });

  it("stage labels are positioned at bottom with active highlight (marking restored)", () => {
    render(<SongProgressBar currentTime={0} duration={0.5} />);
    expect(screen.getByText("0,1s")).toBeInTheDocument();
    expect(screen.getByText("0,5s")).toBeInTheDocument();
    expect(screen.getByText("15,0s")).toBeInTheDocument();
    const active = screen.getByText("0,5s");
    expect(active.className).toMatch(/text-green-500/);
    expect(active.className).toMatch(/font-bold/);
    // also timer must be present
    expect(screen.getByText(/0,0s \/ 0,5s/)).toBeInTheDocument();
  });
});
