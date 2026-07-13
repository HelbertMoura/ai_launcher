import { useCallback, useEffect, useState } from "react";
import { readKey, writeKey } from "../lib/storage";

export type Density = "comfortable" | "compact";

function readSaved(): Density {
  if (typeof window === "undefined") return "comfortable";
  const v = readKey("density");
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
    writeKey("density", next);
  }, []);

  const toggleDensity = useCallback(() => {
    setDensityState((prev) => {
      const next: Density = prev === "compact" ? "comfortable" : "compact";
      applyDensity(next);
      writeKey("density", next);
      return next;
    });
  }, []);

  return { density, setDensity, toggleDensity };
}
