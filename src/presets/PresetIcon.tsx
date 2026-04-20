// ==============================================================================
// AI Launcher Pro - PresetIcon
// Monogramas SVG cross-platform (Win10/11 consistente). Substitui emojis
// nativos que renderizavam inconsistente entre versões do Windows.
// Mantém backward-compat: presets legados com emoji ainda renderizam.
// ==============================================================================

import type { JSX } from 'react';

interface PresetIconProps {
  /** ID do ícone (ex: 'bolt') ou emoji legado (ex: '⚡'). */
  id: string;
  /** Tamanho em px (default 16). */
  size?: number;
  /** Título acessível. */
  title?: string;
}

const PATHS: Record<string, JSX.Element> = {
  bolt: <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />,
  flame: <path d="M12 2c3 4 5 7 5 11a5 5 0 01-10 0c0-2 1-3 2-4-1 3 1 5 3 5 2 0 3-1 3-3 0-3-2-5-3-9z" />,
  flask: (
    <g>
      <path d="M9 3v6L4 19a2 2 0 002 3h12a2 2 0 002-3l-5-10V3" />
      <path d="M8 3h8" />
      <path d="M6 14h12" />
    </g>
  ),
  brain: (
    <g>
      <path d="M9 5a3 3 0 00-3 3v1a3 3 0 00-2 3 3 3 0 002 3v1a3 3 0 003 3h1V5H9z" />
      <path d="M15 5a3 3 0 013 3v1a3 3 0 012 3 3 3 0 01-2 3v1a3 3 0 01-3 3h-1V5h1z" />
    </g>
  ),
  pencil: (
    <g>
      <path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" />
      <path d="M13 5l3 3" />
    </g>
  ),
  wrench: <path d="M14 4a4 4 0 103 7l6 6-3 3-6-6a4 4 0 01-7-3 4 4 0 013-4l2 2-2 2 3 3 2-2-2-2z" />,
  target: (
    <g>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </g>
  ),
  rocket: (
    <g>
      <path d="M12 3c4 2 7 6 7 11l-3 2-8 0-3-2c0-5 3-9 7-11z" />
      <path d="M9 16l-3 5 5-3M15 16l3 5-5-3" />
      <circle cx="12" cy="11" r="2" />
    </g>
  ),
  bug: (
    <g>
      <ellipse cx="12" cy="13" rx="5" ry="6" />
      <path d="M12 7V4M9 5l-2-1M15 5l2-1M7 13H4M17 13h3M8 18l-2 2M16 18l2 2" />
    </g>
  ),
  palette: (
    <g>
      <path d="M12 3a9 9 0 100 18h1a2 2 0 002-2 2 2 0 012-2h1a4 4 0 004-4 9 9 0 00-10-10z" />
      <circle cx="7" cy="12" r="1.2" fill="currentColor" />
      <circle cx="9" cy="7" r="1.2" fill="currentColor" />
      <circle cx="14" cy="6" r="1.2" fill="currentColor" />
      <circle cx="17" cy="10" r="1.2" fill="currentColor" />
    </g>
  ),
  chart: (
    <g>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-5M12 16v-8M16 16v-3" />
    </g>
  ),
  toolbox: (
    <g>
      <rect x="3" y="8" width="18" height="12" rx="1.5" />
      <path d="M8 8V5a2 2 0 012-2h4a2 2 0 012 2v3" />
      <path d="M3 13h18" />
      <rect x="10" y="11" width="4" height="4" />
    </g>
  ),
};

/** Mapeia emojis legados (de presets salvos antes da v5.1) para IDs SVG. */
const LEGACY_EMOJI_MAP: Record<string, string> = {
  '⚡': 'bolt',
  '🔥': 'flame',
  '🧪': 'flask',
  '🧠': 'brain',
  '📝': 'pencil',
  '🔧': 'wrench',
  '🎯': 'target',
  '🚀': 'rocket',
  '🐛': 'bug',
  '🎨': 'palette',
  '📊': 'chart',
  '🧰': 'toolbox',
};

export const PRESET_ICON_IDS: ReadonlyArray<string> = Object.keys(PATHS);

/** Resolve ID legado/novo para um ID canônico, ou null se não reconhecer. */
export function resolveIconId(input: string): string | null {
  if (PATHS[input]) return input;
  if (LEGACY_EMOJI_MAP[input]) return LEGACY_EMOJI_MAP[input];
  return null;
}

export function PresetIcon({ id, size = 16, title }: PresetIconProps) {
  const resolved = resolveIconId(id);
  if (!resolved) {
    // Fallback para strings desconhecidas — renderiza como texto
    return <span aria-label={title} style={{ fontSize: size }}>{id}</span>;
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {PATHS[resolved]}
    </svg>
  );
}
