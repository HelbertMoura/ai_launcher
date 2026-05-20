import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light" | "amber" | "glacier";

export const THEMES: readonly Theme[] = ["dark", "light", "amber", "glacier"] as const;

const STORAGE_KEY = "ai-launcher:theme";

function isTheme(value: unknown): value is Theme {
  return (
    value === "dark" || value === "light" || value === "amber" || value === "glacier"
  );
}

function readSaved(): Theme {
  if (typeof window === "undefined") return "dark";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return isTheme(v) ? v : "dark";
}

export function nextTheme(current: Theme): Theme {
  const idx = THEMES.indexOf(current);
  const next = THEMES[(idx + 1) % THEMES.length];
  return next;
}

export function useTheme(): {
  theme: Theme;
  setTheme: (t: Theme) => void;
  cycleTheme: () => void;
} {
  const [theme, setThemeState] = useState<Theme>(readSaved);

  // Aplica o tema no DOM no mount inicial — sem isso, o tema salvo no
  // localStorage só é refletido visualmente quando o usuário clica em mudar.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors (private mode)
    }
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = nextTheme(current);
      document.documentElement.setAttribute("data-theme", next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  return { theme, setTheme, cycleTheme };
}
