import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
  /** Optional extra content rendered between the message and the actions
   *  (e.g. a command preview). Does not replace the dialog's own buttons. */
  readonly children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = "normal",
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  const resolvedConfirmLabel = confirmLabel ?? t("common.confirm");
  const resolvedCancelLabel = cancelLabel ?? t("common.cancel");

  useEffect(() => {
    if (!open) return;

    // Focus the safest default action when the dialog opens. For destructive
    // actions we focus Cancel so an accidental Enter/Space does not confirm.
    const timer = setTimeout(() => {
      const selector =
        variant === "danger" ? "[data-cancel]" : "[data-confirm]";
      const target = panelRef.current?.querySelector<HTMLButtonElement>(selector);
      target?.focus();
    }, 50);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      // No global Enter-to-confirm handler: the focused button already fires
      // its native click on Enter/Space, which keeps danger dialogs safe.
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
  }, [open, onCancel, variant]);

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
        {children}
        <div className="cd-confirm__actions">
          <Button data-cancel size="sm" variant="ghost" onClick={onCancel}>
            {resolvedCancelLabel}
          </Button>
          <Button
            data-confirm
            size="sm"
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
          >
            {resolvedConfirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
