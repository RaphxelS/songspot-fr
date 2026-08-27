import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

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
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50`}
      >
        <a
          href="#contenu-principal"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded focus:outline-none focus:ring-2 focus:ring-zinc-900"
        >
          Aller au contenu principal
        </a>
        <ErrorBoundary>
          <Header />
          <main
            id="contenu-principal"
            tabIndex={-1}
            className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 focus:outline-none"
          >
            {children}
          </main>
          <div
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
            id="annonces-stage"
          />
          <Footer />
        </ErrorBoundary>
      </body>
    </html>
  );
}
