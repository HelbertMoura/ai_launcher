import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LEGACY_TAB_TARGETS,
  MAINTENANCE_SECTION_I18N_KEYS,
  TAB_I18N_KEYS,
  TAB_KEYS,
  type MaintenanceSection,
  type TabId,
} from "../../app/layout/TabId";
import { PINNABLE_SURFACES, useSidebarNav } from "../../app/layout/sidebarNav";
import { ACCENTS, type Accent } from "../../hooks/useAccent";
import { THEMES, type Theme } from "../../hooks/useTheme";
import type { HistoryItem } from "../history/useHistory";
import "./CommandPalette.css";

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: TabId, section?: MaintenanceSection) => void;
  theme: Theme;
  onToggleTheme: () => void;
  onSetTheme?: (theme: Theme) => void;
  accent: Accent;
  onSetAccent: (accent: Accent) => void;
  onCycleAccent?: () => void;
  recentSessions?: HistoryItem[];
  onRelaunchSession?: (item: HistoryItem) => void;
  onCheckUpdates?: () => void;
  onNewRunbook?: () => void;
  onNewProfile?: () => void;
}

type CommandKind =
  | { kind: "navigate"; tab: TabId }
  | { kind: "action" }
  | { kind: "recent"; item: HistoryItem }
  | { kind: "theme"; theme: Theme }
  | { kind: "accent"; accent: Accent };

interface CommandRow {
  id: string;
  section: string;
  icon: string;
  label: string;
  description?: string;
  shortcut?: string;
  searchText: string;
  run: () => void;
  meta: CommandKind;
}

const TAB_ICONS: Record<TabId, string> = {
  "command-center": "⌂",
  launcher: "▶",
  tools: "⚙",
  mcp: "◇",
  history: "⟲",
  costs: "$",
  workspace: "⌂",
  maintenance: "✚",
  admin: "⚡",
  help: "?",
};

/** v22 palette skipped help ("?" shortcut exists) and prereqs (absorbed). */
const NAV_TABS: TabId[] = [
  "command-center",
  "launcher",
  "tools",
  "workspace",
  "mcp",
  "history",
  "costs",
  "maintenance",
  "admin",
];

/** Palette section per surface, mirroring the sidebar groups. */
const TAB_SECTIONS: Record<TabId, { key: string; titleKey: string }> = {
  "command-center": { key: "home", titleKey: "nav.home" },
  launcher: { key: "run", titleKey: "nav.groupRun" },
  tools: { key: "run", titleKey: "nav.groupRun" },
  workspace: { key: "run", titleKey: "nav.groupRun" },
  history: { key: "observe", titleKey: "nav.groupObserve" },
  costs: { key: "observe", titleKey: "nav.groupObserve" },
  mcp: { key: "connect", titleKey: "nav.groupConnect" },
  maintenance: { key: "system", titleKey: "nav.groupSystem" },
  admin: { key: "system", titleKey: "nav.groupSystem" },
  help: { key: "system", titleKey: "nav.groupSystem" },
};

/** Legacy surface labels (kept in locales for the alias rows). */
const LEGACY_LABEL_KEYS: Record<string, string> = {
  doctor: "nav.doctor",
  prereqs: "nav.prereqs",
  updates: "nav.updates",
};

const THEME_ICONS: Record<Theme, string> = {
  dark: "◐",
  light: "◑",
  amber: "◉",
  glacier: "◎",
  phosphor: "▣",
  midnight: "✦",
  "high-contrast": "◧",
};

const ACCENT_ICON = "●";

/**
 * Simple subsequence fuzzy match (case-insensitive).
 * Returns null if the query is not a subsequence of the haystack.
 * Otherwise returns the set of matched indices in the haystack.
 */
function fuzzyMatch(haystack: string, needle: string): number[] | null {
  if (!needle) return [];
  const hay = haystack.toLowerCase();
  const ndl = needle.toLowerCase();
  const indices: number[] = [];
  let hi = 0;
  for (let ni = 0; ni < ndl.length; ni += 1) {
    const ch = ndl[ni];
    if (ch === " ") continue;
    let found = -1;
    while (hi < hay.length) {
      if (hay[hi] === ch) {
        found = hi;
        hi += 1;
        break;
      }
      hi += 1;
    }
    if (found === -1) return null;
    indices.push(found);
  }
  return indices;
}

/** Tighter matches (smaller spread) score higher; prefix matches boosted. */
function scoreMatch(indices: number[]): number {
  if (indices.length === 0) return 0;
  const first = indices[0];
  const last = indices[indices.length - 1];
  const spread = last - first;
  const prefixBoost = first === 0 ? 1000 : 0;
  return prefixBoost + 500 - spread - first * 2;
}

interface HighlightProps {
  text: string;
  indices: number[];
}

function Highlight({ text, indices }: HighlightProps) {
  if (indices.length === 0) return <>{text}</>;
  const hit = new Set(indices.filter((i) => i >= 0 && i < text.length));
  return (
    <>
      {text.split("").map((ch, i) =>
        hit.has(i) ? (
          <mark key={i} className="cd-cmd__match">
            {ch}
          </mark>
        ) : (
          <span key={i}>{ch}</span>
        ),
      )}
    </>
  );
}

function formatRecentLabel(item: HistoryItem): string {
  const base = item.cli || item.cliKey || "session";
  const dir = item.directory
    ? item.directory.split(/[\\/]/).filter(Boolean).pop() ?? item.directory
    : "";
  return dir ? `${base} · ${dir}` : base;
}

function formatRecentDescription(item: HistoryItem): string | undefined {
  if (!item.timestamp) return undefined;
  try {
    const d = new Date(item.timestamp);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toLocaleString();
  } catch {
    return undefined;
  }
}

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  theme,
  onToggleTheme,
  onSetTheme,
  accent,
  onSetAccent,
  onCycleAccent,
  recentSessions,
  onRelaunchSession,
  onCheckUpdates,
  onNewRunbook,
  onNewProfile,
}: CommandPaletteProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Reset query/selection when palette opens, then focus input; restore focus
  // to the invoking element when it closes (ARIA combobox dialog pattern).
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus?.();
      previousFocusRef.current = null;
    }
  }, [open]);

  const close = (): void => {
    onClose();
  };

  const runAndClose = (fn: () => void): void => {
    fn();
    close();
  };

  const { pinned, togglePin } = useSidebarNav();

  const allRows: CommandRow[] = useMemo(() => {
    const rows: CommandRow[] = [];

    // --- Navigate (grouped like the sidebar: Home, Executar, Observar, ...) ---
    for (const tab of NAV_TABS) {
      const label = t(TAB_I18N_KEYS[tab]);
      const shortcut = TAB_KEYS[tab];
      rows.push({
        id: `nav-${tab}`,
        section: TAB_SECTIONS[tab].key,
        icon: TAB_ICONS[tab],
        label,
        shortcut,
        searchText: `${label} ${tab} navigate ${shortcut ?? ""}`,
        run: () => runAndClose(() => onNavigate(tab)),
        meta: { kind: "navigate", tab },
      });
    }

    // --- Pin/unpin actions (any surface except Home) ---
    for (const tab of PINNABLE_SURFACES) {
      const label = t(TAB_I18N_KEYS[tab]);
      const isPinned = pinned.includes(tab);
      rows.push({
        id: `action-pin-${tab}`,
        section: "actions",
        icon: isPinned ? "★" : "☆",
        label: t(isPinned ? "palette.actionUnpin" : "palette.actionPin", { target: label }),
        searchText: `pin unpin ${label} ${t(isPinned ? "palette.actionUnpin" : "palette.actionPin", { target: label })}`,
        run: () => runAndClose(() => togglePin(tab)),
        meta: { kind: "action" },
      });
    }

    // --- Legacy surface names (v22), only while searching, marked as such ---
    const q = query.trim();
    if (q) {
      for (const [legacyId, target] of Object.entries(LEGACY_TAB_TARGETS)) {
        const label = t(LEGACY_LABEL_KEYS[legacyId] ?? legacyId);
        const destination = target.section
          ? `${t("nav.maintenance")} · ${t(MAINTENANCE_SECTION_I18N_KEYS[target.section])}`
          : t(TAB_I18N_KEYS[target.tab]);
        rows.push({
          id: `alias-${legacyId}`,
          section: TAB_SECTIONS[target.tab].key,
          icon: "→",
          label,
          description: t("palette.legacyAliasDesc", { target: destination }),
          searchText: `${label} ${legacyId} legacy alias ${destination}`,
          run: () => runAndClose(() => onNavigate(target.tab, target.section)),
          meta: { kind: "navigate", tab: target.tab },
        });
      }
    }

    // --- Actions ---
    if (onNewProfile) {
      rows.push({
        id: "action-new-profile",
        section: "actions",
        icon: "+",
        label: t("palette.actionNewProfile"),
        searchText: `new profile ${t("palette.actionNewProfile")}`,
        run: () => runAndClose(onNewProfile),
        meta: { kind: "action" },
      });
    }
    if (onNewRunbook) {
      rows.push({
        id: "action-new-runbook",
        section: "actions",
        icon: "+",
        label: t("palette.actionNewRunbook"),
        searchText: `new runbook ${t("palette.actionNewRunbook")}`,
        run: () => runAndClose(onNewRunbook),
        meta: { kind: "action" },
      });
    }
    if (onCheckUpdates) {
      rows.push({
        id: "action-check-updates",
        section: "actions",
        icon: "⟳",
        label: t("palette.actionCheckUpdates"),
        searchText: `check for updates ${t("palette.actionCheckUpdates")}`,
        run: () => runAndClose(onCheckUpdates),
        meta: { kind: "action" },
      });
    }
    rows.push({
      id: "action-toggle-theme",
      section: "actions",
      icon: "◐",
      label: t("palette.actionToggleTheme"),
      description: t("palette.actionToggleThemeDesc"),
      searchText: `toggle theme cycle ${t("palette.actionToggleTheme")}`,
      run: () => runAndClose(onToggleTheme),
      meta: { kind: "action" },
    });
    if (onCycleAccent) {
      rows.push({
        id: "action-cycle-accent",
        section: "actions",
        icon: ACCENT_ICON,
        label: t("palette.actionCycleAccent"),
        description: t("palette.actionCycleAccentDesc"),
        searchText: `cycle accent color ${t("palette.actionCycleAccent")}`,
        run: () => runAndClose(onCycleAccent),
        meta: { kind: "action" },
      });
    }

    // --- Recent sessions ---
    const recent = (recentSessions ?? []).slice(0, 5);
    for (const item of recent) {
      const label = formatRecentLabel(item);
      const description = formatRecentDescription(item);
      rows.push({
        id: `recent-${item.sessionId ?? item.timestamp}-${item.cliKey}`,
        section: "recent",
        icon: "↻",
        label,
        description,
        searchText: `${label} ${item.directory} ${item.args} recent`,
        run: () => {
          if (onRelaunchSession) {
            runAndClose(() => onRelaunchSession(item));
          } else {
            runAndClose(() => onNavigate("history"));
          }
        },
        meta: { kind: "recent", item },
      });
    }

    // --- Theme (only if all 4 themes exist) ---
    if (THEMES.length >= 4 && onSetTheme) {
      for (const th of THEMES) {
        rows.push({
          id: `theme-${th}`,
          section: "theme",
          icon: THEME_ICONS[th],
          label: t(`palette.theme_${th}`),
          description: th === theme ? t("palette.themeActive") : undefined,
          searchText: `theme ${th} ${t(`palette.theme_${th}`)}`,
          run: () => runAndClose(() => onSetTheme(th)),
          meta: { kind: "theme", theme: th },
        });
      }
    }

    // --- Accent (keep existing behavior) ---
    for (const acc of ACCENTS) {
      const key = `palette.actionAccent${acc.charAt(0).toUpperCase()}${acc.slice(1)}`;
      const label = t(key);
      rows.push({
        id: `accent-${acc}`,
        section: "theme",
        icon: ACCENT_ICON,
        label,
        description: acc === accent ? t("palette.themeActive") : undefined,
        searchText: `accent ${acc} ${label}`,
        run: () => runAndClose(() => onSetAccent(acc)),
        meta: { kind: "accent", accent: acc },
      });
    }

    return rows;
  }, [
    t,
    query,
    pinned,
    togglePin,
    onNavigate,
    onToggleTheme,
    onSetTheme,
    onCycleAccent,
    onSetAccent,
    onCheckUpdates,
    onNewRunbook,
    onNewProfile,
    onRelaunchSession,
    recentSessions,
    theme,
    accent,
  ]);

  interface FilteredRow extends CommandRow {
    labelMatches: number[];
    descMatches: number[];
    shortcutMatches: number[];
    score: number;
  }

  const filtered: FilteredRow[] = useMemo(() => {
    const q = query.trim();
    if (!q) {
      return allRows.map((r) => ({
        ...r,
        labelMatches: [],
        descMatches: [],
        shortcutMatches: [],
        score: 0,
      }));
    }
    const out: FilteredRow[] = [];
    for (const row of allRows) {
      const combinedIdx = fuzzyMatch(row.searchText, q);
      if (combinedIdx === null) continue;
      const labelMatches = fuzzyMatch(row.label, q) ?? [];
      const descMatches = row.description ? fuzzyMatch(row.description, q) ?? [] : [];
      const shortcutMatches = row.shortcut ? fuzzyMatch(row.shortcut, q) ?? [] : [];
      const score = scoreMatch(combinedIdx);
      out.push({ ...row, labelMatches, descMatches, shortcutMatches, score });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }, [allRows, query]);

  const groupedSections = useMemo(() => {
    const sections: Array<{ key: string; titleKey: string; rows: FilteredRow[] }> = [
      { key: "home", titleKey: "nav.home", rows: [] },
      { key: "run", titleKey: "nav.groupRun", rows: [] },
      { key: "observe", titleKey: "nav.groupObserve", rows: [] },
      { key: "connect", titleKey: "nav.groupConnect", rows: [] },
      { key: "system", titleKey: "nav.groupSystem", rows: [] },
      { key: "actions", titleKey: "palette.groupActions", rows: [] },
      { key: "recent", titleKey: "palette.groupRecent", rows: [] },
      { key: "theme", titleKey: "palette.groupTheme", rows: [] },
    ];
    const idx: Record<string, number> = Object.fromEntries(sections.map((s, i) => [s.key, i]));
    for (const row of filtered) {
      sections[idx[row.section] ?? idx.actions].rows.push(row);
    }
    return sections.filter((s) => s.rows.length > 0);
  }, [filtered]);

  // Flat list for keyboard navigation (preserves section order).
  const flatRows: FilteredRow[] = useMemo(
    () => groupedSections.flatMap((s) => s.rows),
    [groupedSections],
  );

  // Clamp selection when filtered list shrinks.
  useEffect(() => {
    if (selectedIndex >= flatRows.length) {
      setSelectedIndex(flatRows.length === 0 ? 0 : flatRows.length - 1);
    }
  }, [flatRows.length, selectedIndex]);

  // Scroll selected row into view.
  useLayoutEffect(() => {
    if (!open) return;
    const el = itemRefs.current[selectedIndex];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, open, flatRows.length]);

  // Resize refs array each render to match current rows.
  itemRefs.current = new Array(flatRows.length).fill(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (flatRows.length === 0 ? 0 : (i + 1) % flatRows.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) =>
        flatRows.length === 0 ? 0 : (i - 1 + flatRows.length) % flatRows.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = flatRows[selectedIndex];
      if (row) row.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  if (!open) return null;

  return (
    <div
      className="cd-cmd__backdrop"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={t("topBar.command")}
    >
      <div
        className="cd-cmd"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="cd-cmd__prompt">
          <span className="cd-cmd__prompt-sigil" aria-hidden>
            &gt;
          </span>
          <input
            ref={inputRef}
            className="cd-cmd__input"
            placeholder={t("palette.placeholder")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            spellCheck={false}
            autoComplete="off"
            aria-label={t("palette.placeholder")}
            role="combobox"
            aria-expanded="true"
            aria-controls="cd-cmd-listbox"
            aria-autocomplete="list"
            aria-activedescendant={
              flatRows[selectedIndex] ? `cd-cmd-opt-${flatRows[selectedIndex].id}` : undefined
            }
          />
        </div>
        <div className="cd-cmd__list" ref={listRef} role="listbox" id="cd-cmd-listbox">
          {flatRows.length === 0 ? (
            <div className="cd-cmd__empty">
              <pre className="cd-cmd__empty-art" aria-hidden>{`> _`}</pre>
              <div className="cd-cmd__empty-text">{t("palette.empty")}</div>
            </div>
          ) : (
            groupedSections.map((section) => (
              <div
                key={section.key}
                className="cd-cmd__group"
                role="group"
                aria-labelledby={`cd-cmd-group-${section.key}`}
              >
                <div
                  className="cd-cmd__group-heading"
                  id={`cd-cmd-group-${section.key}`}
                  role="presentation"
                >
                  {t(section.titleKey)}
                </div>
                {section.rows.map((row) => {
                  const globalIndex = flatRows.indexOf(row);
                  const selected = globalIndex === selectedIndex;
                  return (
                    <button
                      type="button"
                      key={row.id}
                      id={`cd-cmd-opt-${row.id}`}
                      ref={(el) => {
                        itemRefs.current[globalIndex] = el;
                      }}
                      className={`cd-cmd__item${selected ? " cd-cmd__item--selected" : ""}`}
                      data-section={section.key}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      onClick={() => row.run()}
                      role="option"
                      aria-selected={selected}
                    >
                      <span className="cd-cmd__icon" aria-hidden>
                        {row.meta.kind === "accent" ? (
                          <span
                            className={`cd-cmd__swatch cd-cmd__swatch--${row.meta.accent}`}
                          />
                        ) : (
                          row.icon
                        )}
                      </span>
                      <span className="cd-cmd__body">
                        <span className="cd-cmd__label">
                          <Highlight text={row.label} indices={row.labelMatches} />
                        </span>
                        {row.description ? (
                          <span className="cd-cmd__desc">
                            <Highlight text={row.description} indices={row.descMatches} />
                          </span>
                        ) : null}
                      </span>
                      {row.shortcut ? (
                        <span className="cd-cmd__chip">
                          <Highlight text={row.shortcut} indices={row.shortcutMatches} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="cd-cmd__footer" aria-hidden>
          <span className="cd-cmd__hint">
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <span>{t("palette.hintNav")}</span>
          </span>
          <span className="cd-cmd__hint">
            <kbd>↵</kbd>
            <span>{t("palette.hintRun")}</span>
          </span>
          <span className="cd-cmd__hint">
            <kbd>esc</kbd>
            <span>{t("palette.hintClose")}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
