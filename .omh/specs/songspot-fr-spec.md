---
version: "1.0"
status: confirmed
created: "2026-08-27T23:52:00Z"
interview_id: "di-20260827-songspot-fr"
project_name: "songspot-fr"
type: greenfield
coverage:
  goal: CLEAR
  constraints: CLEAR
  success_criteria: CLEAR
  existing_context: N/A
rounds_completed: 0
---

# songspot-fr — Requirements Specification

## Goal

Build **Songspot FR** — a French clone of [Songspot](https://songspot.net/) (guess-the-song from a short audio clip). The player hears a fragment starting at 0.1s and can guess the title; on wrong guess / skip the clip length grows (0.1s → 0.5s → 2s → 8s → 15s). The catalogue is **French only**, sourced from Spotify's **Top 50 France** and **Top Titres France / Top Hits France** playlists (merged + deduplicated, ~100 tracks). The UI and copy are fully in French. Features parity with Songspot: 5 difficulty tiers (by Spotify popularity/stream count), eras/filters, search-autocomplete for guesses, reroll, session no-repeat, friend-challenge link, mobile-responsive layout, simple/arcade styles, wide/tight layout, volume + playback options, and timed reveal.

Target audience: French music fans, casual web game's players. The app runs entirely in the browser (static frontend + thin server proxy for Spotify token/preview fetching). No login required.

## Constraints

- **Technical**:
  - Web app, runs in modern browsers (Chrome, Firefox, Safari, mobile Safari/Chrome). No native app.
  - Frontend stack: Next.js 15 (App Router) + React 19 + Tailwind CSS + TypeScript (or Vite+React if simpler). Chosen for SEO, routing, and Spotify server actions.
  - Audio: HTMLAudioElement; precise clip windowing (start at 0, stop at stage duration). Handle preview_url = null by skipping track or using Deezer fallback preview where available.
  - Spotify data: Use Spotify Web API Client Credentials flow (server-only) to fetch playlists `37i9dQZEVXbIP3c3fqVrJY` (Top 50 France) + `37i9dQZEVXbIP2pEthxaOT` (Top 50 France duplicate? verify) and `Top Titres France` via search `Top Hits France` / curator `Spotify France`. Provide fallback static JSON snapshot (checked into `data/catalog.fr.json`) for dev/offline and when token missing.
  - No heavy backend DB; session state in localStorage; optional server cache for Spotify responses (in-memory + file).
  - All UI copy in French; routes/metadata in French; `<html lang="fr">`.
- **Resources**: Single developer, no paid APIs beyond free Spotify quota. Previews are 30s mp3 (`preview_url`) — clip is taken from start of preview; document limitation.
- **Compatibility**: Must work without Spotify login (client credentials). Provide `.env.example` for `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`. Without creds, app falls back to static catalogue and still playable.
- **Timeline**: MVP in one autopilot run; polish pass after.
- **Regulatory**: Audio previews are Spotify-provided short previews under fair-use preview terms; no full-track download; attribution to Spotify. No PII stored.
- **Design parity**: Replicate Songspot UX: difficulty selector (Facile/Moyen/Difficile/Expert/Impossible mapped to popularity buckets), era filters (Toutes / Classique / 2000s / 2010s / 2020s mapped to release year), stages toggle, playback « depuis le début », volume slider, spotlight/arcade style, reroll button, skip button, guess-after pills.

## Success Criteria

1. **Catalogue FR** — App loads merged French catalogue (Top 50 France + Top Titres France) ≥ 80 tracks with `title`, `artist`, `album`, `cover`, `preview_url`, `popularity`, `release_date`. Unit test asserts catalog length ≥ 50 and no duplicates by `spotifyId`. When `SPOTIFY_CLIENT_ID` is set, server route refreshes catalog from Spotify; otherwise static fallback loads.
2. **5 stages** — Stages are exactly [0.1, 0.5, 2, 8, 15] seconds, default all enabled. Toggling a stage persists and skips it during play. Verification: play timer stops audio at correct duration ±50ms (mocked audio test).
3. **Guess flow** — Typing in search shows filtered suggestions from current catalogue (title+artist match, accent-insensitive). Selecting a suggestion submits guess; Enter without selection shows hint. Wrong guess advances to next enabled stage; correct guess shows success and reveals full 15s preview; skip button also advances. Max stage reached reveals answer.
4. **Play/pause & volume** — Play button starts clip from 0, pauses on second click, auto-stops at stage limit. Volume slider controls audio element; from-start toggle respected.
5. **Difficulté** — Five buttons: Facile / Moyen / Difficile / Expert / Impossible map to popularity quintiles (e.g., ≥85 easy, 70-85 medium, etc.). Selecting changes the pool from which next random track is drawn (era + difficulty filter). Existing round unchanged until reroll.
6. **Reroll & no-repeat** — "Nouveau morceau" picks a random track not in `sessionPlayedIds` (localStorage). When pool exhausted, pool resets. Session test: 10 rerolls never repeat until pool size exceeded.
7. **Partage / Challenge** — On solved/failed round, "Défier un ami" copies URL with `?track=<id>&difficulty=<tier>&stage=<stage>`; loading that URL reproduces same track/difficulty and shows score comparison banner. Verifiable via e2e (Playwright or manual) that link round-trips.
8. **Responsive & styles** — Mobile layout (≤640px) collapses controls into hamburger, touch-friendly hit targets ≥44px, no horizontal scroll. Two layout toggles (wide/tight) and two style toggles (simple/arcade) persist to localStorage. Visual regression via manual screenshot.
9. **French copy** — All user-facing strings in French; `npm run lint` with custom check or manual review shows no English leftovers (except code identifiers). FAQ page in French mirrors Songspot FAQ.
10. **Build & deploy** — `npm run build` succeeds, `npm run start` serves production, `npm run lint` passes, no TypeScript errors (`tsc --noEmit`). Static export fallback works if no server.

## Existing Context

Greenfield project at `C:/Users/Raphael/Documents/CODE/Songspot-fr` — empty directory (fresh init). No existing codebase to integrate. Reference: https://songspot.net/ + https://songspot.net/faq . Spotify Web API docs for playlists/tracks/preview_url.

## Assumptions

- Spotify `preview_url` still populated for most French chart tracks (~70%+). For null previews, app filters them out or uses Deezer preview API `https://api.deezer.com/search?q=...` as fallback (best-effort, no auth). Assumption validated by manual curl during dev.
- "Top Titres France" corresponds to Spotify playlist "Top Hits France" (id `37i9dQZEVXb5AvMoO2SKHg`) or similar; if id changes, code searches by name fallback. Provide override via env `SPOTIFY_PLAYLIST_IDS`.
- Audio clip from start of 30s preview is acceptable; original Songspot also uses Spotify previews from start.
- No auth required for MVP; future could add account/OAuth for persistent stats.

## Open Questions

- Which exact Spotify playlist ID to canonically use for "Top Titres France" — affects: catalogue, impact: wrong pool; mitigation: search+fallback and env override.
- Should difficulty tiers strictly use Spotify `popularity` or roll own scoring (streams)? Affects: tiers; impact: mapping shift; default: use popularity quintiles, document in FAQ.
- Do we need daily challenge mode like Heardle? Affects: scope, impact: extra route; deferred to v2 (reroll-unlimited is P0).
- Deezer fallback licensing? Affects: constraints; impact: may need to gate behind feature flag.
