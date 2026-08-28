import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import AppDifficultyProvider from "./DifficultyProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Songspot FR — Devine la chanson française",
  description:
    "Devine la chanson française en 0,1 seconde ! Écoute l'extrait et retrouve le titre. Catalogue Top 50 France et Top Titres France.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col bg-[#0a0a0a] text-zinc-50`}
      >
        <a
          href="#contenu-principal"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          Aller au contenu principal
        </a>
        <ErrorBoundary>
          <AppDifficultyProvider>
            <Header />
            <main
              id="contenu-principal"
              tabIndex={-1}
              className="flex-1 w-full px-4 sm:px-6 focus:outline-none"
            >
              {children}
            </main>
            <div
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
              id="annonces-stage"
            />
            {/* Footer minimal */}
            <footer className="w-full border-t border-zinc-800/50 py-4 text-center text-xs text-zinc-600">
              <a href="/faq" className="hover:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded px-2 py-1">
                FAQ
              </a>
              <span className="mx-2">·</span>
              <span>Catalogue Top 50 France · Spotify</span>
            </footer>
          </AppDifficultyProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
