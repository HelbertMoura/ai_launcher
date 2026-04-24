import { useCallback, useEffect, useState } from "react";

export type Density = "comfortable" | "compact";

const STORAGE_KEY = "ai-launcher:v15:density";

function readSaved(): Density {
  if (typeof window === "undefined") return "comfortable";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "compact" ? "compact" : "comfortable";
}

function applyDensity(d: Density): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-density", d);
}

export function useDensity(): {
  density: Density;
  setDensity: (d: Density) => void;
  toggleDensity: () => void;
} {
  const [density, setDensityState] = useState<Density>(readSaved);

  // Apply the attribute on mount so SSR / first paint matches persisted state.
  useEffect(() => {
    applyDensity(density);
  }, [density]);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    applyDensity(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors (private mode)
    }
  }, []);

  const toggleDensity = useCallback(() => {
    setDensityState((prev) => {
      const next: Density = prev === "compact" ? "comfortable" : "compact";
      applyDensity(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  return { density, setDensity, toggleDensity };
}
