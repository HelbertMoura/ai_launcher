import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  REQUIRED_THEME_VARS,
  THEME_IDS,
  DARK_DEFAULT_BG,
  type ThemeId,
} from "./contract";

// This test runs in Node (vitest), so it reads the stylesheets straight from
// disk. We resolve paths relative to this file via import.meta.url. (Vite's
// `?raw` import returns empty under the test transform, hence fs here.)
const THEME_DIR = dirname(fileURLToPath(import.meta.url));

function loadCss(file: string): string {
  return readFileSync(join(THEME_DIR, file), "utf8");
}

// dark is backed by tokens.css (the :root default), not a theme-dark override.
const CSS_BY_THEME: Record<ThemeId, string> = {
  dark: loadCss("tokens.css"),
  light: loadCss("theme-light.css"),
  amber: loadCss("theme-amber.css"),
  glacier: loadCss("theme-glacier.css"),
  phosphor: loadCss("theme-phosphor.css"),
  midnight: loadCss("theme-midnight.css"),
  "high-contrast": loadCss("theme-high-contrast.css"),
};

// Themes whose surfaces are intentionally light — they MUST override --bg
// away from the dark default, otherwise text contrast breaks.
const LIGHT_THEMES: ReadonlySet<ThemeId> = new Set(["light", "glacier"]);

function readThemeVars(id: ThemeId): Map<string, string> {
  const css = CSS_BY_THEME[id] ?? "";
  const vars = new Map<string, string>();
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    vars.set(m[1].trim(), m[2].trim());
  }
  return vars;
}

describe("theme contract", () => {
  it("registers at least the 7 expected themes", () => {
    expect(THEME_IDS.length).toBeGreaterThanOrEqual(7);
  });

  for (const id of THEME_IDS) {
    describe(`theme "${id}"`, () => {
      const vars = readThemeVars(id);

      it("loaded the stylesheet (non-empty)", () => {
        expect(vars.size, `no CSS vars parsed for "${id}"`).toBeGreaterThan(0);
      });

      it("defines all required contract variables", () => {
        const missing = REQUIRED_THEME_VARS.filter((v) => !vars.has(v));
        expect(missing, `missing in theme "${id}": ${missing.join(", ")}`).toEqual([]);
      });

      if (LIGHT_THEMES.has(id)) {
        it("does not silently inherit the dark default --bg", () => {
          const bg = vars.get("--bg");
          expect(bg, `light theme "${id}" must override --bg`).toBeDefined();
          expect(bg).not.toBe(DARK_DEFAULT_BG);
        });
      }

      if (id !== "dark") {
        it("overrides the accent (no dead accent like the old amber bug)", () => {
          expect(vars.get("--accent")).toBeDefined();
        });
      }
    });
  }
});
