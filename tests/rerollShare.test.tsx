/**
 * tests/rerollShare.test.tsx — T10 RerollButton + ShareButton
 */
import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RerollButton from "@/components/game/RerollButton";
import ShareButton from "@/components/game/ShareButton";

describe("RerollButton", () => {
  it("affiche Nouveau morceau et appelle onReroll", async () => {
    const onReroll = vi.fn();
    render(<RerollButton onReroll={onReroll} />);
    const btn = screen.getByRole("button", { name: "Nouveau morceau" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-label", "Nouveau morceau");
    // hit target >=44px via min-h-11
    expect(btn.className).toContain("min-h-11");
    await fireEvent.click(btn);
    expect(onReroll).toHaveBeenCalledTimes(1);
  });

  it("disabled ne call pas", () => {
    const onReroll = vi.fn();
    render(<RerollButton onReroll={onReroll} disabled />);
    const btn = screen.getByRole("button", { name: "Nouveau morceau" });
    expect(btn).toBeDisabled();
  });
});

describe("ShareButton", () => {
  beforeEach(() => {
    Object.defineProperty(window, "navigator", {
      value: { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }, userAgent: "test" },
      writable: true,
      configurable: true,
    });
    // window.location kept as jsdom http://localhost for isolation
  });

  it("affiche Défier un ami avec aria-label et copie URL + toast Lien copié !", async () => {
    const mockWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockWrite },
      writable: true,
      configurable: true,
    });
    render(<ShareButton trackId="abc123" difficulty="Expert" />);
    const btn = screen.getByRole("button", { name: "Défier un ami" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-label", "Défier un ami");
    expect(btn.textContent).toContain("Défier un ami");

    await fireEvent.click(btn);

    await waitFor(() => expect(mockWrite).toHaveBeenCalledTimes(1));
    const url = mockWrite.mock.calls[0][0] as string;
    expect(url).toContain("track=abc123");
    expect(url).toContain("difficulty=Expert");
    expect(url).not.toContain("stage");

    // toast Lien copié ! doit apparaitre (2 elements: status + sr-only)
    await waitFor(() => expect(screen.getAllByText("Lien copié !").length).toBeGreaterThanOrEqual(1));
    expect(screen.getByRole("status").textContent).toContain("Lien copié !");
  });

  it("stage omis dans URL copiee", async () => {
    const mockWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockWrite },
      writable: true,
      configurable: true,
    });
    render(<ShareButton trackId="xyz" difficulty="Facile" />);
    const btn = screen.getByRole("button", { name: "Défier un ami" });
    await fireEvent.click(btn);
    await waitFor(() => expect(mockWrite).toHaveBeenCalled());
    const url = mockWrite.mock.calls[0][0] as string;
    expect(url).not.toMatch(/stage/);
  });
});
