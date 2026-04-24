/**
 * Simple external store for toast notifications.
 *
 * Usage:
 *   import { showToast } from "../ui/toastStore";
 *   showToast("Saved!", "success");
 */

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastEntry {
  readonly id: number;
  readonly message: string;
  readonly variant: ToastVariant;
}

type Listener = () => void;

let nextId = 0;
let toasts: readonly ToastEntry[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn();
}

export function getToasts(): readonly ToastEntry[] {
  return toasts;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Show a toast notification. Auto-dismissed after 4 seconds. */
export function showToast(message: string, variant: ToastVariant = "info"): void {
  const id = nextId++;
  toasts = [...toasts, { id, message, variant }];
  emit();

  setTimeout(() => {
    dismissToast(id);
  }, 4000);
}

/** Programmatically dismiss a toast by id. */
export function dismissToast(id: number): void {
  if (!toasts.some((t) => t.id === id)) return;
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}
