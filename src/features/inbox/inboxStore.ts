// Persisted notification inbox. Events carry i18n KEYS (not rendered strings)
// so locale switches re-render correctly. Dedup is by stable `id`: re-pushing
// an existing id with identical content only refreshes ts and PRESERVES read
// (an installed-but-pending update must not re-unread on every boot); changed
// content re-marks unread.
import { useSyncExternalStore } from "react";
import { readKey, writeKey } from "../../lib/storage";
import type { TabId } from "../../app/layout/TabId";

export type InboxType = "session" | "budget" | "update" | "doctor";

export interface InboxEvent {
  id: string;
  type: InboxType;
  titleKey: string;
  titleParams?: Record<string, string | number>;
  bodyKey?: string;
  bodyParams?: Record<string, string | number>;
  ts: number;
  read: boolean;
  targetTab: TabId;
}

export interface InboxState {
  events: InboxEvent[];
  /** Doctor check keys currently failing — drives ok->fail transition detection. */
  doctorFailing: string[];
}

const MAX_EVENTS = 50;

let state: InboxState | null = null;
const listeners = new Set<() => void>();

function load(): InboxState {
  if (state === null) {
    const raw = readKey("inbox");
    state = {
      events: (raw.events as InboxEvent[]) ?? [],
      doctorFailing: raw.doctorFailing ?? [],
    };
  }
  return state;
}

function save(next: InboxState): void {
  state = next;
  // The registry schema is a tolerant passthrough (index signature); our
  // stricter InboxState satisfies it at runtime but not structurally.
  writeKey("inbox", next as never);
  for (const fn of listeners) fn();
}

export function getInboxSnapshot(): InboxState {
  return load();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function unreadCount(): number {
  return load().events.filter((e) => !e.read).length;
}

/** Evict beyond MAX_EVENTS: oldest read first, then oldest overall. */
function evict(events: InboxEvent[]): InboxEvent[] {
  let result = events;
  while (result.length > MAX_EVENTS) {
    const candidates = result.filter((e) => e.read);
    const pool = candidates.length > 0 ? candidates : result;
    const victim = pool.reduce((oldest, e) => (e.ts < oldest.ts ? e : oldest));
    result = result.filter((e) => e !== victim);
  }
  return result;
}

export type PushInput = Omit<InboxEvent, "ts" | "read"> & {
  ts?: number;
  /** Always re-mark unread even when content is identical (e.g. doctor ok->fail re-transition). */
  forceUnread?: boolean;
};

function sameContent(a: InboxEvent, b: PushInput): boolean {
  return (
    a.titleKey === b.titleKey &&
    a.bodyKey === b.bodyKey &&
    JSON.stringify(a.titleParams ?? null) === JSON.stringify(b.titleParams ?? null) &&
    JSON.stringify(a.bodyParams ?? null) === JSON.stringify(b.bodyParams ?? null)
  );
}

export function pushEvent(input: PushInput): void {
  const cur = load();
  const { forceUnread, ts: inputTs, ...rest } = input;
  const ts = inputTs ?? Date.now();
  const existing = cur.events.find((e) => e.id === rest.id);
  let events: InboxEvent[];
  if (existing) {
    const keepRead = !forceUnread && existing.read && sameContent(existing, input);
    events = cur.events.map((e) =>
      e.id === rest.id ? { ...e, ...rest, ts, read: keepRead } : e,
    );
  } else {
    events = evict([...cur.events, { ...rest, ts, read: false }]);
  }
  save({ ...cur, events });
}

export function markRead(id: string): void {
  const cur = load();
  save({ ...cur, events: cur.events.map((e) => (e.id === id ? { ...e, read: true } : e)) });
}

export function markAllRead(): void {
  const cur = load();
  save({ ...cur, events: cur.events.map((e) => ({ ...e, read: true })) });
}

export function clearAll(): void {
  const cur = load();
  save({ ...cur, events: [] });
}

export interface DoctorResult {
  key: string;
  name: string;
  installed: boolean;
}

/** Push doctor events ONLY for ok->fail transitions (anti-spam). */
export function reportDoctorResults(results: DoctorResult[]): void {
  const cur = load();
  const previouslyFailing = new Set(cur.doctorFailing);
  const nowFailing = results.filter((r) => !r.installed).map((r) => r.key);
  const newlyFailing = results.filter((r) => !r.installed && !previouslyFailing.has(r.key));

  // Keys not present in this run keep their previous failing status.
  const reportedKeys = new Set(results.map((r) => r.key));
  const carried = cur.doctorFailing.filter((k) => !reportedKeys.has(k));
  const nextFailing = [...new Set([...carried, ...nowFailing])];

  // Persist the transition state FIRST so the pushes below see it.
  save({ ...cur, doctorFailing: nextFailing });

  for (const r of newlyFailing) {
    pushEvent({
      id: `doctor:${r.key}`,
      type: "doctor",
      titleKey: "inbox.doctorTitle",
      titleParams: { name: r.name },
      targetTab: "doctor",
      forceUnread: true,
    });
  }
}

/** Test-only: drop the in-memory cache so the next read hits localStorage. */
export function __resetForTests(): void {
  state = null;
}

/** React hook — re-renders on every store mutation. */
export function useInbox(): InboxState {
  return useSyncExternalStore(subscribe, getInboxSnapshot);
}
