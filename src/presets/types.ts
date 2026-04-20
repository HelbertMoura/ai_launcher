// ==============================================================================
// AI Launcher Pro - Launch Presets
// Combos reutilizáveis: cli + provider + directory + args.
// ==============================================================================

export interface LaunchPreset {
  id: string;
  name: string;
  cliKey: string;
  providerId?: string;      // só relevante pra claude
  directory: string;
  args: string;
  noPerms: boolean;
  color?: string;           // #RRGGBB opcional pra visual
  emoji?: string;           // atalho visual
  createdAt: string;
}
