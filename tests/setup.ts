import "@testing-library/jest-dom/vitest";

/**
 * Setup file to polyfill localStorage for jsdom on Node 26
 * Node 26 has native localStorage requiring --localstorage-file, which conflicts with jsdom.
 * This polyfill ensures window.localStorage is available if jsdom didn't provide it.
 */

// Simple in-memory localStorage polyfill
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

// Polyfill window.localStorage and globalThis.localStorage if missing
if (typeof window !== "undefined" && typeof (window as unknown as { localStorage?: Storage }).localStorage === "undefined") {
  const polyfill = new MemoryStorage();
  Object.defineProperty(window, "localStorage", {
    value: polyfill,
    writable: true,
    configurable: true,
  });
}

if (typeof globalThis !== "undefined" && typeof (globalThis as unknown as { localStorage?: Storage }).localStorage === "undefined") {
  // Reuse window's polyfill if available, otherwise create new
  const polyfill =
    typeof window !== "undefined" && (window as unknown as { localStorage?: Storage }).localStorage
      ? (window as unknown as { localStorage: Storage }).localStorage
      : new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: polyfill,
    writable: true,
    configurable: true,
  });
}

// Also ensure global.localStorage for Node 26 native check
if (typeof global !== "undefined" && typeof (global as unknown as { localStorage?: Storage }).localStorage === "undefined") {
  const polyfill =
    typeof window !== "undefined" && (window as unknown as { localStorage?: Storage }).localStorage
      ? (window as unknown as { localStorage: Storage }).localStorage
      : new MemoryStorage();
  (global as unknown as { localStorage: Storage }).localStorage = polyfill;
}
