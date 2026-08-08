import { createContext, useContext } from "react";

/**
 * Session-only theme preference (`docs/PHASE_44.md` T13): never persisted, so
 * every load starts from the shipped `.dark` default in
 * `src/routes/__root.tsx` and `ThemeProvider`'s matching initial state.
 */
export type Theme = "light" | "dark";

export type ThemeContextValue = Readonly<{
  theme: Theme;
  toggleTheme: () => void;
}>;

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
