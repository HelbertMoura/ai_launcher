import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { z } from "zod";
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

/** Apply a validated session-ended payload to the persisted history. */
export function applySessionEnded(payload: SessionEndedPayload): void {
  const { session_id, status, exit_code, duration_secs } = payload;
  if (status === "detached") {
    // Detached sessions are not measurable; just stop showing "starting".
    updateSessionStatus(session_id, { status: "detached" });
    return;
  }
  markSessionEnded(session_id, {
    status,
    exitCode: exit_code ?? null,
    durationMs: duration_secs != null ? duration_secs * 1000 : undefined,
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
