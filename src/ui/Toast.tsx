import { useSyncExternalStore, useCallback } from "react";
import { getToasts, subscribe, dismissToast } from "./toastStore";
import "./Toast.css";

export function ToastContainer() {
  const toasts = useSyncExternalStore(subscribe, getToasts);

  if (toasts.length === 0) return null;

  return (
    <div
      className="cd-toast-container"
      aria-live="polite"
      aria-relevant="additions removals"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} message={t.message} variant={t.variant} />
      ))}
    </div>
  );
}

function ToastItem({
  id,
  message,
  variant,
}: {
  readonly id: number;
  readonly message: string;
  readonly variant: string;
}) {
  const handleDismiss = useCallback(() => dismissToast(id), [id]);

  return (
    <div role="alert" className={`cd-toast cd-toast--${variant}`}>
      <span className="cd-toast__icon" aria-hidden="true">
        {ICON[variant] ?? "i"}
      </span>
      <span className="cd-toast__msg">{message}</span>
      <button
        type="button"
        className="cd-toast__close"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
      >
        &times;
      </button>
    </div>
  );
}

const ICON: Record<string, string> = {
  success: "✓",
  error: "✗",
  warning: "⚠",
  info: "●",
};
