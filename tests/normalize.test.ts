import { describe, it, expect } from "vitest";
import { normalize } from "@/lib/normalize";

describe("normalize", () => {
  it('normalize("Àngèle") === "angele"', () => {
    expect(normalize("Àngèle")).toBe("angele");
  });

  it('normalize("Cœur") === "coeur"', () => {
    expect(normalize("Cœur")).toBe("coeur");
  });

  it('normalize("Œuvre") === "oeuvre"', () => {
    expect(normalize("Œuvre")).toBe("oeuvre");
  });

  it('normalize("Été") === "ete"', () => {
    expect(normalize("Été")).toBe("ete");
  });

  it("gère les ligatures minuscules et majuscules", () => {
    expect(normalize("œ")).toBe("oe");
    expect(normalize("Œ")).toBe("oe");
    expect(normalize("æ")).toBe("ae");
    expect(normalize("Æ")).toBe("ae");
    expect(normalize("cœur et æther")).toBe("coeur et aether");
  });

  it("supprime les accents via NFD", () => {
    expect(normalize("Élève")).toBe("eleve");
    expect(normalize("À la française")).toBe("a la francaise");
    expect(normalize("CAFÉ")).toBe("cafe");
  });

  it("est case-insensitive", () => {
    expect(normalize("ANGÈLE")).toBe("angele");
    expect(normalize("Angèle")).toBe("angele");
  });

  it("gère les chaînes vides", () => {
    expect(normalize("")).toBe("");
  });
});
