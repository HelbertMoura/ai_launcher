import { useEffect, useRef } from "react";
import { Button } from "./Button";
import "./ConfirmDialog.css";

type ConfirmVariant = "normal" | "danger";

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly variant?: ConfirmVariant;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "normal",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    // Focus the confirm button when dialog opens
    const timer = setTimeout(() => {
      const confirmBtn = panelRef.current?.querySelector<HTMLButtonElement>(
        "[data-confirm]",
      );
      confirmBtn?.focus();
    }, 50);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
        return;
      }
      // Focus trap
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
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
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  return (
    <div className="cd-confirm__backdrop" onClick={onCancel}>
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cd-confirm-title"
        aria-describedby="cd-confirm-desc"
        className={`cd-confirm cd-confirm--${variant}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cd-confirm__header">
          <h3 id="cd-confirm-title" className="cd-confirm__title">
            {title}
          </h3>
        </div>
        <p id="cd-confirm-desc" className="cd-confirm__message">
          {message}
        </p>
        <div className="cd-confirm__actions">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            data-confirm
            size="sm"
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
