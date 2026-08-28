"use client";

import * as React from "react";
import { normalize } from "@/lib/normalize";
import type { Track } from "@/lib/catalog";

export type GuessInputProps = {
  catalog: Track[];
  onGuess: (guess: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
};

export default function GuessInput({
  catalog,
  onGuess,
  disabled = false,
  placeholder = "Devine le titre ou l’artiste…",
  id = "guess-input",
}: GuessInputProps) {
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const [isOpen, setIsOpen] = React.useState(false);
  const [announce, setAnnounce] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listboxId = `${id}-listbox`;

  const normalizedQuery = normalize(query.trim());

  const suggestions = React.useMemo(() => {
    if (disabled) return [];
    if (normalizedQuery.length < 2) return [];
    const filtered = catalog.filter((t) => {
      const hay = normalize(`${t.title} ${t.artist}`);
      return hay.includes(normalizedQuery);
    });
    return filtered.slice(0, 8);
  }, [catalog, normalizedQuery, disabled]);

  const showDropdown = isOpen && suggestions.length > 0 && !disabled;

  // Announce suggestions count for aria-live
  React.useEffect(() => {
    if (!isOpen) {
      setAnnounce("");
      return;
    }
    if (normalizedQuery.length < 2) {
      setAnnounce("");
      return;
    }
    if (suggestions.length === 0) {
      setAnnounce("Aucune suggestion");
    } else {
      setAnnounce(`${suggestions.length} suggestion${suggestions.length > 1 ? "s" : ""} disponible${suggestions.length > 1 ? "s" : ""}`);
    }
  }, [suggestions.length, isOpen, normalizedQuery.length]);

  // Reset selection when query changes
  React.useEffect(() => {
    setSelectedIndex(-1);
    if (normalizedQuery.length >= 2 && suggestions.length > 0) {
      setIsOpen(true);
    } else if (normalizedQuery.length < 2) {
      setIsOpen(false);
    }
  }, [normalizedQuery, suggestions.length]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const submit = React.useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        setAnnounce("Veuillez saisir une proposition");
        return;
      }
      onGuess(trimmed);
      setQuery("");
      setSelectedIndex(-1);
      setIsOpen(false);
      // keep focus on input after submit for next guess
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [onGuess],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen && suggestions.length > 0) {
        setIsOpen(true);
        setSelectedIndex(0);
        return;
      }
      if (suggestions.length === 0) return;
      setSelectedIndex((prev) => {
        const next = prev + 1;
        if (next >= suggestions.length) return 0;
        return next;
      });
      setIsOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setSelectedIndex((prev) => {
        const next = prev - 1;
        if (next < 0) return suggestions.length - 1;
        return next;
      });
      setIsOpen(true);
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        e.preventDefault();
        const sel = suggestions[selectedIndex];
        // submit exact track string "title — artist" to satisfy isCorrectGuess combined match
        submit(`${sel.title} — ${sel.artist}`);
      } else {
        // if dropdown open and we press enter, submit raw query (if not empty)
        // allow form submit handler to handle; but prevent double
        if (isOpen && query.trim().length > 0) {
          e.preventDefault();
          submit(query);
        }
        // else let form handle empty hint
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      const sel = suggestions[selectedIndex];
      submit(`${sel.title} — ${sel.artist}`);
    } else {
      submit(query);
    }
  };

  const handleFocus = () => {
    if (normalizedQuery.length >= 2 && suggestions.length > 0 && !disabled) {
      setIsOpen(true);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // delay close to allow click on suggestion
    const related = e.relatedTarget as HTMLElement | null;
    if (related && related.closest(`#${listboxId}`)) {
      return;
    }
    // use timeout to allow click event to fire before closing
    setTimeout(() => setIsOpen(false), 150);
  };

  // Close on outside click
  React.useEffect(() => {
    const onClickOutside = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement;
      const container = document.getElementById(`${id}-container`);
      if (container && !container.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [id]);

  const activeDescendant =
    selectedIndex >= 0 ? `${id}-option-${selectedIndex}` : undefined;

  return (
    <div id={`${id}-container`} className="relative w-full">
      {/* aria-live announcement */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2" aria-label="Formulaire de proposition">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            id={id}
            type="text"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={disabled}
            placeholder={placeholder}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={showDropdown}
            aria-activedescendant={activeDescendant}
            aria-label="Titre ou artiste"
            className="w-full min-h-11 rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-zinc-500 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-400"
          />

          {showDropdown && (
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Suggestions"
              className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
            >
              {suggestions.map((track, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <li
                    key={track.id}
                    id={`${id}-option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onMouseDown={(e) => {
                      // prevent blur before click
                      e.preventDefault();
                    }}
                    onClick={() => {
                      submit(`${track.title} — ${track.artist}`);
                    }}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm ${isSelected ? "bg-zinc-100 dark:bg-zinc-800" : "bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={track.cover}
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 flex-shrink-0 rounded object-cover"
                    />
                    <span className="flex-1 truncate">
                      <span className="font-medium">{track.title}</span>
                      <span className="text-zinc-500 dark:text-zinc-400"> — {track.artist}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <button
          type="submit"
          disabled={disabled}
          aria-label="Proposer"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Proposer
        </button>
      </form>

      {/* Hint when empty and trying to submit */}
      <p className="sr-only" aria-live="polite">
        {query.trim().length === 0 && !disabled ? "Saisis au moins 2 caractères pour voir les suggestions" : ""}
      </p>
    </div>
  );
}
