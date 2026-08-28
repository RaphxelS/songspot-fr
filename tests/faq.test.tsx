/**
 * tests/faq.test.tsx — T12 Page FAQ FR + audit copy 100% FR
 * Vérifie /faq 200 + French copy + metadata FR + Header/Footer liens + audit anglais vide
 */
import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

(globalThis as unknown as Record<string, unknown>).React = React;

const ROOT = path.resolve(__dirname, "..");

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

function grepCount(pattern: RegExp, dir: string, exts = [".tsx", ".ts"]): number {
  let count = 0;
  function walk(p: string) {
    const entries = fs.readdirSync(p, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === "node_modules" || e.name === ".next" || e.name === ".git") continue;
      const full = path.join(p, e.name);
      if (e.isDirectory()) walk(full);
      else if (exts.some((ext) => e.name.endsWith(ext))) {
        const content = fs.readFileSync(full, "utf-8");
        const m = content.match(pattern);
        if (m) count += m.length;
      }
    }
  }
  walk(path.join(ROOT, dir));
  return count;
}

function grepFiles(pattern: RegExp, dir: string, exts = [".tsx", ".ts"]): string[] {
  const hits: string[] = [];
  function walk(p: string) {
    const entries = fs.readdirSync(p, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === "node_modules" || e.name === ".next" || e.name === ".git") continue;
      const full = path.join(p, e.name);
      if (e.isDirectory()) walk(full);
      else if (exts.some((ext) => e.name.endsWith(ext))) {
        const content = fs.readFileSync(full, "utf-8");
        if (pattern.test(content)) hits.push(path.relative(ROOT, full));
      }
    }
  }
  walk(path.join(ROOT, dir));
  return hits;
}

describe("T12 — Page FAQ FR + audit copy", () => {
  it("app/faq/page.tsx existe et exporte metadata FR title FAQ — Songspot FR", () => {
    const p = path.join(ROOT, "app/faq/page.tsx");
    expect(fs.existsSync(p)).toBe(true);
    const content = readFile("app/faq/page.tsx");
    expect(content).toMatch(/export const metadata/);
    expect(content).toMatch(/FAQ — Songspot FR/);
    // description FR doit contenir français
    expect(content).toMatch(/description/);
    expect(content).toMatch(/Questions fréquentes|comment jouer/i);
  });

  it("/faq contient Comment jouer, Difficulté, Spotify en français (fichier source)", () => {
    const content = readFile("app/faq/page.tsx");
    expect(content).toMatch(/Comment jouer/);
    // Difficulté au singulier et Difficultés au pluriel — on vérifie la racine
    expect(content).toMatch(/Difficulté/);
    expect(content).toMatch(/Spotify/);
  });

  it("/faq rendu contient Comment jouer, Difficulté, Spotify", async () => {
    const { default: FAQPage } = await import("@/app/faq/page");
    const { container, unmount } = render(React.createElement(FAQPage));
    const text = container.textContent || "";
    expect(text).toMatch(/Comment jouer/);
    expect(text).toMatch(/Difficulté/);
    expect(text).toMatch(/Spotify/);
    // Vérifie présence des sections structurantes
    expect(text).toMatch(/Pourquoi commencer à 0,1/);
    expect(text).toMatch(/Attribution Spotify/);
    expect(screen.getByRole("heading", { name: /Foire aux questions/i })).toBeInTheDocument();
    unmount();
  });

  it("FAQ page contient navigation retour Accueil + lien FAQ Footer/Header cohérent", async () => {
    const { default: FAQPage } = await import("@/app/faq/page");
    const { container, unmount } = render(React.createElement(FAQPage));
    // lien Retour au jeu href="/"
    const backLink = container.querySelector('a[href="/"]');
    expect(backLink).not.toBeNull();
    expect(backLink!.textContent).toMatch(/Retour au jeu|Accueil/);
    // lien FAQ dans le footer de la page (2 liens: Accueil + FAQ)
    const faqLinks = Array.from(container.querySelectorAll('a[href="/faq"]'));
    expect(faqLinks.length).toBeGreaterThanOrEqual(1);
    // Header doit pointer vers /faq
    const header = readFile("components/layout/Header.tsx");
    expect(header).toMatch(/href="\/faq"/);
    expect(header).toMatch(/FAQ/);
    // Footer doit pointer vers /faq et Foire aux questions
    const footer = readFile("components/layout/Footer.tsx");
    expect(footer).toMatch(/href="\/faq"/);
    expect(footer).toMatch(/Foire aux questions/);
    unmount();
  });

  it("Header → FAQ navigue vers /faq et retour (present dans layout)", () => {
    const header = readFile("components/layout/Header.tsx");
    // Header desktop nav contains FAQ → /faq
    expect(header).toMatch(/<Link[^>]*href="\/faq"/);
    // MobileMenu also contains FAQ and Accueil
    const mobile = readFile("components/layout/MobileMenu.tsx");
    expect(mobile).toMatch(/href="\/faq"/);
    expect(mobile).toMatch(/href="\/"/);
    // FAQ page itself has retour link to "/"
    const faq = readFile("app/faq/page.tsx");
    expect(faq).toMatch(/href="\/"/);
  });

  it("metadata FAQ description est en français (pas d'anglais)", () => {
    const content = readFile("app/faq/page.tsx");
    // description line should be FR and contain français, difficulté, Spotify
    expect(content).toMatch(/Questions fréquentes/);
    // Le fichier ne doit pas contenir de phrase anglaise type Guess the song
    expect(content).not.toMatch(/Guess the song/i);
  });

  it("audit copy 100% FR : grep Guess the song vide dans app/components", () => {
    const hits = [...grepFiles(/Guess the song/i, "app"), ...grepFiles(/Guess the song/i, "components")];
    expect(hits, `Guess the song trouvé dans ${hits.join(", ")}`).toEqual([]);
  });

  it("audit copy 100% FR : pas de texte UI anglais Play/Skip/Share isolé (hors identifiants code)", () => {
    // On scanne les contenus JSX text nodes anglais potentiels
    // Identifiants comme AudioPlayer, ShareButton sont ok, mais texte UI type >Play< ou >Skip< doit être FR
    const appTextFiles = ["app/faq/page.tsx", "components/layout/Header.tsx", "components/layout/Footer.tsx"];
    for (const rel of appTextFiles) {
      const c = readFile(rel);
      // Cherche >Play<, >Skip<, >Share< comme texte UI isolé (pas dans import/type)
      // On vérifie qu'il n'y a pas de >Play< exactement entre balises
      expect(c, `${rel} contient texte UI anglais >Play<`).not.toMatch(/>\s*Play\s*</);
      expect(c, `${rel} contient texte UI anglais >Skip<`).not.toMatch(/>\s*Skip\s*</);
      expect(c, `${rel} contient texte UI anglais >Share<`).not.toMatch(/>\s*Share\s*</);
      expect(c, `${rel} contient Guess the song`).not.toMatch(/Guess the song/i);
    }
  });

  it("app/layout.tsx <html lang=fr> global toujours présent", () => {
    const layout = readFile("app/layout.tsx");
    expect(layout).toMatch(/<html lang="fr">/);
    expect(layout).toMatch(/next\/font\/google/);
  });

  it("FAQ page tous textes FR : vérifie absence d'anglais UI dans app/faq", () => {
    const faq = readFile("app/faq/page.tsx");
    // Section titles FR
    expect(faq).toMatch(/Comment jouer/);
    expect(faq).toMatch(/D'où viennent les extraits|D&apos;où viennent/);
    expect(faq).toMatch(/Pourquoi commencer/);
    expect(faq).toMatch(/Niveaux de difficulté|Difficulté/);
    expect(faq).toMatch(/Attribution Spotify/);
    // Pas de phrases anglaises résiduelles
    const englishPhrases = ["How to play", "Where do clips", "Why 0.1s", "Difficulty levels", "Share with friends"];
    for (const phrase of englishPhrases) {
      expect(faq, `FAQ contient phrase anglaise ${phrase}`).not.toMatch(new RegExp(phrase, "i"));
    }
  });

  it("FAQ page hit targets et accessible: heading h1 + h2 + footer links min-h-11", () => {
    const faq = readFile("app/faq/page.tsx");
    expect(faq).toMatch(/<h1/);
    expect(faq).toMatch(/<h2/);
    // Retour button has min-h-11
    expect(faq).toMatch(/min-h-11/);
    // aria-labelledby on sections
    expect(faq).toMatch(/aria-labelledby/);
  });

  it("grep -ri Comment jouer present au moins dans app/faq", () => {
    const cnt = grepCount(/Comment jouer/g, "app");
    expect(cnt).toBeGreaterThanOrEqual(1);
    const hits = grepFiles(/Comment jouer/, "app");
    const normalized = hits.map((h) => h.replace(/\\/g, "/"));
    expect(normalized).toContain("app/faq/page.tsx");
  });
});
