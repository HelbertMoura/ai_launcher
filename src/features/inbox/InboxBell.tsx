import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell } from "../../ui/icons";
import type { TabId } from "../../app/layout/TabId";
import {
  clearAll,
  markAllRead,
  markRead,
  useInbox,
  type InboxEvent,
} from "./inboxStore";
import "./InboxBell.css";

const TYPE_GLYPH: Record<InboxEvent["type"], string> = {
  session: "⟲",
  budget: "$",
  update: "↑",
  doctor: "✚",
};

function relativeTime(ts: number, nowLabel: string): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return nowLabel;
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

interface InboxBellProps {
  onNavigate: (tab: TabId) => void;
}

export function InboxBell({ onNavigate }: InboxBellProps) {
  const { t } = useTranslation();
  const { events } = useInbox();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const unread = events.filter((e) => !e.read).length;
  const sorted = [...events].sort((a, b) => b.ts - a.ts);

  const closeAndRestoreFocus = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  // Click-outside closes the panel.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const handlePanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeAndRestoreFocus();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
      if (items.length === 0) return;
      const idx = items.findIndex((el) => el === document.activeElement);
      const next =
        e.key === "ArrowDown"
          ? items[(idx + 1) % items.length]
          : items[(idx - 1 + items.length) % items.length];
      next.focus();
    }
  };

  const handleItemClick = (evt: InboxEvent): void => {
    markRead(evt.id);
    setOpen(false);
    onNavigate(evt.targetTab);
  };

  itemRefs.current = new Array(sorted.length).fill(null);

  // Event title/body keys are persisted as plain strings, so the typed t()
  // overload can't verify them statically — localized cast at the boundary.
  const tDynamic = (key: string, params?: Record<string, string | number>): string =>
    String(t(key as never, params as never));

  return (
    <div className="cd-inbox" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="cd-inbox__bell"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread > 0 ? t("inbox.open", { count: unread }) : t("inbox.openEmpty")}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={16} aria-hidden />
        {unread > 0 && (
          <span className="cd-inbox__badge" aria-hidden>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="cd-inbox__panel"
          role="dialog"
          aria-label={t("inbox.title")}
          onKeyDown={handlePanelKeyDown}
        >
          <div className="cd-inbox__head">
            <span className="cd-inbox__head-title">{t("inbox.title")}</span>
          </div>
          <div className="cd-inbox__list">
            {sorted.length === 0 ? (
              <div className="cd-inbox__empty">{t("inbox.empty")}</div>
            ) : (
              sorted.map((evt, i) => (
                <button
                  key={evt.id}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  type="button"
                  className={`cd-inbox__item${evt.read ? "" : " cd-inbox__item--unread"}`}
                  onClick={() => handleItemClick(evt)}
                >
                  <span className="cd-inbox__item-icon" aria-hidden>
                    {TYPE_GLYPH[evt.type]}
                  </span>
                  <span className="cd-inbox__item-body">
                    <span className="cd-inbox__item-title">
                      {tDynamic(evt.titleKey, evt.titleParams)}
                    </span>
                    {evt.bodyKey && (
                      <span className="cd-inbox__item-desc">
                        {tDynamic(evt.bodyKey, evt.bodyParams)}
                      </span>
                    )}
                  </span>
                  <span className="cd-inbox__item-time">
                    {relativeTime(evt.ts, t("inbox.timeNow"))}
                  </span>
                </button>
              ))
            )}
          </div>
          {sorted.length > 0 && (
            <div className="cd-inbox__foot">
              <button type="button" className="cd-inbox__foot-btn" onClick={() => markAllRead()}>
                {t("inbox.markAllRead")}
              </button>
              <button type="button" className="cd-inbox__foot-btn" onClick={() => clearAll()}>
                {t("inbox.clearAll")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
