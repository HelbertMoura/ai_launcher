import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import "./Dialog.css";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ open, onClose, title, size = "md", children, footer }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = ref.current;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    panel?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cd-dialog__backdrop" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cd-dialog-title"
        tabIndex={-1}
        className={`cd-dialog cd-dialog--${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cd-dialog__header">
          <h2 id="cd-dialog-title" className="cd-dialog__title">{title}</h2>
          <button
            type="button"
            className="cd-dialog__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="cd-dialog__body">{children}</div>
        {footer && <footer className="cd-dialog__footer">{footer}</footer>}
      </div>
    </div>
  );
}
