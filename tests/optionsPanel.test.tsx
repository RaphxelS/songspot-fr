import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OptionsPanel from "@/components/game/OptionsPanel";
import type { Keybinds } from "@/lib/keybinds";

describe("OptionsPanel — keybinds OPTIONS UI", () => {
  it("displays current keybinds formatted (Espace/S)", () => {
    const keybinds: Keybinds = { play: " ", skip: "s" };
    render(<OptionsPanel keybinds={keybinds} onChange={vi.fn()} />);
    expect(screen.getByTestId("keybind-play").textContent).toBe("Espace");
    expect(screen.getByTestId("keybind-skip").textContent).toBe("S");
    expect(screen.getByText("RACCOURCIS")).toBeInTheDocument();
  });

  it("clicking play button shows capturing state", async () => {
    const user = userEvent.setup();
    const keybinds: Keybinds = { play: " ", skip: "s" };
    render(<OptionsPanel keybinds={keybinds} onChange={vi.fn()} />);
    const btn = screen.getByTestId("keybind-play");
    await user.click(btn);
    expect(btn.textContent).toBe("Appuyez sur une touche…");
  });

  it("pressing new key calls onChange with new bind", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const keybinds: Keybinds = { play: " ", skip: "s" };
    render(<OptionsPanel keybinds={keybinds} onChange={onChange} />);
    const btn = screen.getByTestId("keybind-play");
    await user.click(btn);
    // simulate keydown p
    fireEvent.keyDown(window, { key: "p", code: "KeyP" });
    expect(onChange).toHaveBeenCalledWith({ play: "p", skip: "s" });
  });

  it("Escape cancels capturing without calling onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const keybinds: Keybinds = { play: " ", skip: "s" };
    render(<OptionsPanel keybinds={keybinds} onChange={onChange} />);
    const btn = screen.getByTestId("keybind-play");
    await user.click(btn);
    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
    // should return to displaying Espace
    expect(btn.textContent).toBe("Espace");
  });

  it("reset button calls onChange with defaults", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const keybinds: Keybinds = { play: "p", skip: "k" };
    render(<OptionsPanel keybinds={keybinds} onChange={onChange} />);
    await user.click(screen.getByTestId("keybind-reset"));
    expect(onChange).toHaveBeenCalledWith({ play: " ", skip: "s" });
  });

  it("aria-labels correct", () => {
    const keybinds: Keybinds = { play: " ", skip: "s" };
    render(<OptionsPanel keybinds={keybinds} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Changer raccourci Lecture")).toBeInTheDocument();
    expect(screen.getByLabelText("Changer raccourci Passer")).toBeInTheDocument();
  });
});
