import { useCallback, useState } from "react";

export type Accent = "red" | "amber" | "green" | "blue" | "violet";

export const ACCENTS: Accent[] = ["red", "amber", "green", "blue", "violet"];

const STORAGE_KEY = "ai-launcher:accent";

function readSaved(): Accent {
  if (typeof window === "undefined") return "red";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return ACCENTS.includes(v as Accent) ? (v as Accent) : "red";
}

export function useAccent(): { accent: Accent; setAccent: (a: Accent) => void } {
  const [accent, setAccentState] = useState<Accent>(readSaved);

  const setAccent = useCallback((next: Accent) => {
    setAccentState(next);
    document.documentElement.setAttribute("data-accent", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  return { accent, setAccent };
}
