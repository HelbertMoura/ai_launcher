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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cd-dialog__backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        ref={ref}
        tabIndex={-1}
        className={`cd-dialog cd-dialog--${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cd-dialog__header">
          <h2 className="cd-dialog__title">{title}</h2>
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
