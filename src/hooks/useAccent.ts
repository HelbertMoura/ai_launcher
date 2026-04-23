import { useCallback, useEffect, useRef, useState } from "react";

export type Accent = "red" | "amber" | "green" | "blue" | "violet" | "custom";

export const ACCENTS: Accent[] = ["red", "amber", "green", "blue", "violet"];

const STORAGE_KEY = "ai-launcher:accent";
const CUSTOM_KEY = "ai-launcher:accent-custom";
const DEFAULT_CUSTOM = "#9d4edd";

function readSaved(): Accent {
  if (typeof window === "undefined") return "red";
  const v = window.localStorage.getItem(STORAGE_KEY);
  const valid: Accent[] = [...ACCENTS, "custom"];
  return valid.includes(v as Accent) ? (v as Accent) : "red";
}

function readCustomHex(): string {
  if (typeof window === "undefined") return DEFAULT_CUSTOM;
  const v = window.localStorage.getItem(CUSTOM_KEY);
  return /^#[0-9a-f]{6}$/i.test(v ?? "") ? (v as string) : DEFAULT_CUSTOM;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function applyCustomAccent(hex: string): void {
  const el = document.documentElement;
  el.style.setProperty("--accent", hex);
  el.style.setProperty("--accent-glow", hexToRgba(hex, 0.4));
  el.style.setProperty("--accent-soft", hexToRgba(hex, 0.12));
}

function clearCustomAccent(): void {
  const el = document.documentElement;
  el.style.removeProperty("--accent");
  el.style.removeProperty("--accent-glow");
  el.style.removeProperty("--accent-soft");
}

export function useAccent(): {
  accent: Accent;
  setAccent: (a: Accent) => void;
  customHex: string;
  setCustomHex: (hex: string) => void;
} {
  const [accent, setAccentState] = useState<Accent>(readSaved);
  const [customHex, setCustomHexState] = useState<string>(readCustomHex);
  const customHexRef = useRef<string>(customHex);
  const accentRef = useRef<Accent>(accent);

  useEffect(() => {
    customHexRef.current = customHex;
  }, [customHex]);

  useEffect(() => {
    accentRef.current = accent;
  }, [accent]);

  useEffect(() => {
    document.documentElement.setAttribute("data-accent", accent);
    if (accent === "custom") applyCustomAccent(customHex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAccent = useCallback((next: Accent) => {
    setAccentState(next);
    accentRef.current = next;
    document.documentElement.setAttribute("data-accent", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    if (next === "custom") {
      applyCustomAccent(customHexRef.current);
    } else {
      clearCustomAccent();
    }
  }, []);

  const setCustomHex = useCallback((hex: string) => {
    const normalized = hex.trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(normalized)) return;
    setCustomHexState(normalized);
    customHexRef.current = normalized;
    try {
      window.localStorage.setItem(CUSTOM_KEY, normalized);
    } catch {
      // ignore
    }
    if (accentRef.current === "custom") {
      applyCustomAccent(normalized);
    }
  }, []);

  return { accent, setAccent, customHex, setCustomHex };
}
