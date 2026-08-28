import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeybinds } from "@/hooks/useKeybinds";
import type { Keybinds } from "@/lib/keybinds";

describe("useKeybinds — hook", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("calls onPlay when Space pressed outside input", () => {
    const onPlay = vi.fn();
    const onSkip = vi.fn();
    const keybinds: Keybinds = { play: " ", skip: "s" };
    renderHook(() => useKeybinds({ onPlay, onSkip }, keybinds, { enabled: true }));
    const event = new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true });
    window.dispatchEvent(event);
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("calls onSkip when S pressed", () => {
    const onPlay = vi.fn();
    const onSkip = vi.fn();
    const keybinds: Keybinds = { play: " ", skip: "s" };
    renderHook(() => useKeybinds({ onPlay, onSkip }, keybinds, { enabled: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", bubbles: true }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "S", bubbles: true }));
    expect(onSkip).toHaveBeenCalledTimes(2);
  });

  it("ignores when focus in input", () => {
    const onPlay = vi.fn();
    const onSkip = vi.fn();
    const keybinds: Keybinds = { play: " ", skip: "s" };
    renderHook(() => useKeybinds({ onPlay, onSkip }, keybinds, { enabled: true }));
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(onPlay).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("ignores with Ctrl modifier", () => {
    const onPlay = vi.fn();
    const onSkip = vi.fn();
    const keybinds: Keybinds = { play: " ", skip: "s" };
    renderHook(() => useKeybinds({ onPlay, onSkip }, keybinds, { enabled: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, ctrlKey: true }));
    expect(onPlay).not.toHaveBeenCalled();
  });

  it("disabled flag prevents handling", () => {
    const onPlay = vi.fn();
    const onSkip = vi.fn();
    const keybinds: Keybinds = { play: " ", skip: "s" };
    renderHook(() => useKeybinds({ onPlay, onSkip }, keybinds, { enabled: false }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(onPlay).not.toHaveBeenCalled();
  });
});
