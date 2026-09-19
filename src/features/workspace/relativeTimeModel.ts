/** Compact relative time used by the recent sessions card ("30s", "5m", "3h", "2d"). */
export function timeAgo(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  return `${days}d`;
}
