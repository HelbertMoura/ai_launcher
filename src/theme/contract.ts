// Theme contract — the canonical set of CSS custom properties every theme
// (every `[data-theme="..."]` block in src/theme/theme-*.css) must define.
//
// The dark default lives in tokens.css; non-dark themes override the
// background-dependent tokens. theme-contract.test.ts parses each theme CSS
// file and fails if a required variable is missing, or if a non-dark theme
// silently inherits the dark default for a surface/text token (the class of
// bug that left "amber" without its accent and the light themes with
// unreadable status colors).

/** CSS variables a complete theme block must declare. */
export const REQUIRED_THEME_VARS = [
  // surfaces
  "--bg",
  "--surface-1",
  "--surface-1-alpha",
  "--surface-2",
  "--surface-2-alpha",
  "--surface-hover",
  "--border",
  "--border-strong",
  // text
  "--text",
  "--text-muted",
  "--text-dim",
  // accent
  "--accent",
  "--accent-glow",
  "--accent-soft",
  "--accent-ink",
  // semantic
  "--ok",
  "--warn",
  "--err",
] as const;

export type RequiredThemeVar = (typeof REQUIRED_THEME_VARS)[number];

/** Every selectable theme id. Mirrors `Theme` in src/hooks/useTheme.ts. */
export const THEME_IDS = [
  "dark",
  "light",
  "amber",
  "glacier",
  "phosphor",
  "midnight",
  "high-contrast",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

/**
 * Themes that legitimately share the dark default surfaces (so the contract
 * test should not flag them for "inheriting dark"). "dark" is the base; the
 * other dark-family themes still define their own --bg, but this set documents
 * which themes use `color-scheme: dark`.
 */
export const DARK_FAMILY: ReadonlySet<ThemeId> = new Set([
  "dark",
  "amber",
  "phosphor",
  "midnight",
  "high-contrast",
]);

/** The dark default --bg value (from tokens.css). Used by the contract test
 *  to detect light themes that forgot to override the background. */
export const DARK_DEFAULT_BG = "#090a0c";
