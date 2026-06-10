// ==============================================================================
// AI Launcher Pro - Storage Keys (canonical names)
// Single source of truth for every localStorage key the app reads/writes.
//
// IMPORTANT: these strings are the REAL keys verified across src/ (Grep of
// localStorage.getItem/setItem). Do NOT rename them — existing user data is
// keyed by these exact strings. New keys may be added here; renames require a
// migration in registry.ts.
//
// Naming conventions observed in the wild (3 historical styles, kept as-is for
// backward compat):
//   - legacy v0:  "ai-launcher-config", "ai-launcher-providers", "ai-launcher-presets"
//   - colon ns:   "ai-launcher:theme", "ai-launcher:accent", ...
//   - v15 ns:     "ai-launcher:v15:profiles", "ai-launcher:v15:budget", ...
// ==============================================================================

export const STORAGE_KEYS = {
  // --- Core config / providers (legacy v0 style) ---
  config: 'ai-launcher-config',
  providers: 'ai-launcher-providers',
  presets: 'ai-launcher-presets', // LEGACY presets (pre-v15 profiles). Still read by migration.

  // --- Profiles & workspaces (v15) ---
  profiles: 'ai-launcher:v15:profiles',
  profilesMigrated: 'ai-launcher:v15:migrated',
  workspaces: 'ai-launcher:v15:workspace',
  activeWorkspace: 'ai-launcher:v15:active-workspace',
  runbooks: 'ai-launcher:v15:runbooks',
  budget: 'ai-launcher:v15:budget',
  density: 'ai-launcher:v15:density',

  // --- Custom CLIs / IDEs / overrides ---
  customClis: 'ai-launcher:custom-clis',
  customIdes: 'ai-launcher:custom-ides',
  cliOverrides: 'ai-launcher:cli-overrides',
  ideOverrides: 'ai-launcher:ide-overrides',
  cliOrder: 'ai-launcher:cli-order',

  // --- Appearance / preferences ---
  theme: 'ai-launcher:theme',
  accent: 'ai-launcher:accent',
  accentCustom: 'ai-launcher:accent-custom',
  displayFont: 'ai-launcher:display-font',
  locale: 'ai-launcher:locale',
  notificationsEnabled: 'ai-launcher:notifications-enabled',
  adminMode: 'ai-launcher:admin-mode',

  // --- Onboarding ---
  onboardingDone: 'ai-launcher:onboarding-done',
  showOnboarding: 'ai-launcher:show-onboarding',

  // --- Directory memory ---
  lastDir: 'ai-launcher:last-dir',
  recentDirs: 'ai-launcher:recent-dirs',
} as const;

export type StorageKeyId = keyof typeof STORAGE_KEYS;
