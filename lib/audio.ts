/**
 * Helpers audio — iOS detection, clamp volume, messages
 * Co-localisé avec hooks/useAudioClip (T05)
 */

// Messages FR exacts — utilisés par hook + tests
export const AUDIO_ERROR_MESSAGE = "Extrait indisponible, nouveau morceau";

export const AUDIO_ERRORS = {
  previewUnavailable: "Extrait indisponible, nouveau morceau",
  playBlocked: "Lecture bloquée par le navigateur",
  playAborted: "Lecture interrompue",
  notSupported: "Format audio non supporté",
} as const;

export const AUDIO_LOAD_TIMEOUT_MS = 5000;

export const IOS_VOLUME_TOOLTIP = "Volume via boutons matériels sur iOS";

/**
 * Clamp volume 0–1.
 * - NaN / non-number => 0 (pour matcher tests : clampVolume(NaN) === 0)
 * - Infinity => 1 / 0
 */
export function clampVolume(volume: number): number {
  if (typeof volume !== "number" || Number.isNaN(volume)) return 0;
  if (!Number.isFinite(volume)) return volume > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, volume));
}

/**
 * Détection iOS via userAgent (iPad|iPhone|iPod).
 * Utilisé pour désactiver le slider volume (contrôle matériel obligatoire sur iOS).
 * Signature supporte param optionnel pour tests unitaires : isIOS("Mozilla/5.0 (iPhone...)")
 * Si param fourni, teste uniquement ce string ; sinon utilise navigator.
 */
export function isIOS(userAgent?: string): boolean {
  // Si string explicite fournie (tests)
  if (typeof userAgent === "string") {
    return /iPad|iPhone|iPod/.test(userAgent);
  }
  if (typeof navigator === "undefined") return false;
  const ua: string =
    (navigator as unknown as { userAgent?: string }).userAgent ??
    (typeof window !== "undefined" ? window.navigator.userAgent : "") ??
    "";
  // Fallback via userAgentData.platform si disponible (Chrome 101+)
  const platform: string =
    (navigator as unknown as { platform?: string }).platform ??
    (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    "";
  const source = `${ua} ${platform}`;
  return /iPad|iPhone|iPod/.test(source);
}

/**
 * Totale détection "volume slider doit être désactivé" :
 * - iOS userAgent détecté
 * - OU audio.volume est read-only (iOS volume verrouillé)
 * Sur iOS, audio.volume est non modifiable par JS (contrôle matériel).
 */
export function isVolumeSliderDisabled(audio?: HTMLAudioElement | null): boolean {
  if (isIOS()) return true;
  if (!audio) return false;
  try {
    const desc =
      Object.getOwnPropertyDescriptor(audio, "volume") ??
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(audio), "volume");
    if (desc && desc.set === undefined && desc.writable === false) return true;
    const original = audio.volume;
    const testVal = original === 0.5 ? 0.51 : 0.5;
    audio.volume = testVal;
    const after = audio.volume;
    audio.volume = original;
    if (after !== testVal && after === original) return true;
  } catch {
    return true;
  }
  return false;
}

/**
 * Mappe les erreurs audio.play() vers message utilisateur FR.
 * - NotAllowedError : autoplay bloqué sans geste utilisateur -> playBlocked
 * - AbortError : interruption (pause avant play) -> playAborted
 * - NotSupportedError : format non supporté -> previewUnavailable
 */
export function mapPlayError(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { name?: string; message?: string; code?: number };
  const name = e.name ?? "";
  if (name === "NotAllowedError") return AUDIO_ERRORS.playBlocked;
  if (name === "AbortError") return AUDIO_ERRORS.playAborted;
  if (name === "NotSupportedError") return AUDIO_ERRORS.previewUnavailable;
  // Pour autres erreurs connues, retour null (laisser hook décider)
  return null;
}

// Re-export pour compatibilité hook ancienne version qui importait AUDIO_ERROR_MESSAGE
// (déjà défini plus haut)

/**
 * Récupère le volume stocké depuis localStorage (songspot-fr:prefs).
 * Clamp 0–1, fallback 0.8 si absent/corrupt.
 * Tolérant : try/catch JSON, fallback mémoire si localStorage indisponible (Safari privé).
 */
export function getStoredVolume(fallback = 0.8): number {
  try {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return clampVolume(fallback);
    const raw = window.localStorage.getItem("songspot-fr:prefs");
    if (!raw) return clampVolume(fallback);
    const parsed = JSON.parse(raw) as { volume?: unknown };
    if (typeof parsed.volume === "number") return clampVolume(parsed.volume);
    return clampVolume(fallback);
  } catch {
    return clampVolume(fallback);
  }
}

/**
 * Persiste le volume dans localStorage prefs (merge).
 * Try/catch + fallback silencieux (Safari privé).
 */
export function setStoredVolume(volume: number): void {
  try {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
    const clamped = clampVolume(volume);
    const raw = window.localStorage.getItem("songspot-fr:prefs");
    let prefs: Record<string, unknown> = {};
    if (raw) {
      try {
        prefs = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        prefs = {};
      }
    }
    prefs.volume = clamped;
    window.localStorage.setItem("songspot-fr:prefs", JSON.stringify(prefs));
  } catch {
    // silencieux Safari privé quota
  }
}
