import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { DifficultyProvider, useDifficulty } from "@/components/game/DifficultyContext";
import DifficultySelector from "@/components/game/DifficultySelector";
import EraFilter from "@/components/game/EraFilter";
import { __clearAllStorageForTests, __resetMemoryStoreForTests } from "@/lib/storage";

function Consumer() {
  const { difficulty, era, setDifficulty, setEra } = useDifficulty();
  return (
    <div>
      <span data-testid="diff">{difficulty}</span>
      <span data-testid="era">{era}</span>
      <button onClick={() => setDifficulty("Facile")}>setFacile</button>
      <button onClick={() => setEra("2020s")}>set2020s</button>
    </div>
  );
}

describe("DifficultyContext — Provider + Header ↔ GameContainer sync", () => {
  beforeEach(() => {
    __clearAllStorageForTests();
    __resetMemoryStoreForTests();
    try { window.localStorage.clear(); } catch {}
  });

  it("provider default Facile, setDifficulty persists via storage", async () => {
    render(
      <DifficultyProvider>
        <Consumer />
      </DifficultyProvider>
    );
    expect(screen.getByTestId("diff").textContent).toBe("Facile");
    fireEvent.click(screen.getByText("setFacile"));
    expect(screen.getByTestId("diff").textContent).toBe("Facile");
  });

  it("setEra updates context and persists", async () => {
    render(
      <DifficultyProvider>
        <Consumer />
      </DifficultyProvider>
    );
    expect(screen.getByTestId("era").textContent).toBe("Toutes");
    fireEvent.click(screen.getByText("set2020s"));
    expect(screen.getByTestId("era").textContent).toBe("2020s");
  });

  it("DifficultySelector renders 5 buttons with aria-pressed", async () => {
    const onChange = () => {};
    render(<DifficultySelector value="Facile" onChange={onChange} />);
    const buttons = screen.getAllByRole("button");
    // 5 buttons: 5 tiers (Toutes removed)
    expect(buttons.length).toBe(5);
    const facile = screen.getByTestId("difficulty-Facile");
    expect(facile.getAttribute("aria-pressed")).toBe("true");
    const impossible = screen.getByTestId("difficulty-Impossible");
    expect(impossible.getAttribute("aria-pressed")).toBe("false");
  });

  it("EraFilter renders 5 buttons with aria-pressed", async () => {
    const onChange = () => {};
    render(<EraFilter value="2020s" onChange={onChange} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(5);
    const era2020s = screen.getByTestId("era-2020s");
    expect(era2020s.getAttribute("aria-pressed")).toBe("true");
  });

  it("DifficultySelector onChange called with correct value", async () => {
    let val = "";
    const onChange = (v: string) => { val = v; };
    render(<DifficultySelector value="Facile" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("difficulty-Expert"));
    expect(val).toBe("Expert");
  });
});
