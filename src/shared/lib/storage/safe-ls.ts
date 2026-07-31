/**
 * Single entry point for `window.localStorage` (`docs/FRONTEND_CONVENTIONS.md`
 * §6.1) — never call `window.localStorage` directly elsewhere. Guards SSR
 * (TanStack Start renders on the server first, where `window` doesn't exist)
 * and swallows storage errors (quota exceeded, disabled/private-mode storage)
 * instead of throwing, since losing a persisted preference is an acceptable
 * degradation, not a crash.
 */
export const safeLs = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage full or unavailable — degrade silently.
    }
  },

  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // See setItem.
    }
  },
};
