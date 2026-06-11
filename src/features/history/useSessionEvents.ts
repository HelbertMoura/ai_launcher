import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { z } from "zod";
import { pushEvent } from "../inbox/inboxStore";
import { markSessionEnded, updateSessionStatus } from "./useHistory";

/**
 * Payload emitted by the Rust backend when a tracked session ends.
 * Mirrors `SessionEndedEvent` in src-tauri/src/commands/session.rs.
 *
 * - `completed` / `failed`: a directly-spawned session whose process exited;
 *   `exit_code` and `duration_secs` are usually present.
 * - `detached`: launched via Windows Terminal, whose `wt.exe` process exits
 *   immediately, so the real session cannot be measured. Emitted right away so
 *   the timeline stops claiming the launch is still "starting".
 */
const SESSION_ENDED_EVENT = "session-ended";

const sessionEndedSchema = z.object({
  session_id: z.string().min(1),
  status: z.enum(["completed", "failed", "detached"]),
  exit_code: z.number().int().nullable().optional(),
  duration_secs: z.number().int().nonnegative().nullable().optional(),
});

export type SessionEndedPayload = z.infer<typeof sessionEndedSchema>;

/** Best-effort CLI name lookup for a session id (history lives in the config blob). */
function sessionCli(sessionId: string): string {
  try {
    const raw = localStorage.getItem("ai-launcher-config");
    if (!raw) return "CLI";
    const cfg = JSON.parse(raw) as {
      history?: Array<{ sessionId?: string; cli?: string; cliKey?: string }>;
    };
    const item = cfg.history?.find((h) => h.sessionId === sessionId);
    return item?.cli || item?.cliKey || "CLI";
  } catch {
    return "CLI";
  }
}

/** Apply a validated session-ended payload to the persisted history. */
export function applySessionEnded(payload: SessionEndedPayload): void {
  const { session_id, status, exit_code, duration_secs } = payload;
  if (status === "detached") {
    // Detached sessions are not measurable; just stop showing "starting".
    updateSessionStatus(session_id, { status: "detached" });
  } else {
    markSessionEnded(session_id, {
      status,
      exitCode: exit_code ?? null,
      durationMs: duration_secs != null ? duration_secs * 1000 : undefined,
    });
  }

  const cli = sessionCli(session_id);
  const titleKey =
    status === "detached"
      ? "inbox.sessionDetached"
      : status === "failed"
        ? "inbox.sessionFailed"
        : "inbox.sessionCompleted";
  pushEvent({
    id: `session:${session_id}`,
    type: "session",
    titleKey,
    titleParams: { cli },
    ...(duration_secs != null
      ? { bodyKey: "inbox.sessionDuration", bodyParams: { duration: `${duration_secs}s` } }
      : {}),
    targetTab: "history",
  });
}

/**
 * Register a single global listener for `session-ended` events. Mount this once
 * near the app root. Validates the payload with zod before mutating history.
 */
export function useSessionEvents(): void {
  useEffect(() => {
    const unlisten = listen<unknown>(SESSION_ENDED_EVENT, (event) => {
      const parsed = sessionEndedSchema.safeParse(event.payload);
      if (!parsed.success) {
        // eslint-disable-next-line no-console
        console.warn("[session-ended] invalid payload", parsed.error);
        return;
      }
      applySessionEnded(parsed.data);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);
}
