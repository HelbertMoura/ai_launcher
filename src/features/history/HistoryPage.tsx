import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { useHistory, type HistoryItem } from "./useHistory";
import "../page.css";
import "./HistoryPage.css";

function truncateDir(dir: string, max = 48): string {
  if (dir.length <= max) return dir;
  const head = Math.ceil(max / 2) - 1;
  const tail = Math.floor(max / 2) - 2;
  return `${dir.slice(0, head)}…${dir.slice(dir.length - tail)}`;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} minutes ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hours ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} days ago`;
  return new Date(iso).toLocaleDateString();
}

export function HistoryPage() {
  const { items, clear } = useHistory();

  const onClear = () => {
    if (items.length === 0) return;
    const ok = window.confirm("Clear all launch history? This cannot be undone.");
    if (ok) clear();
  };

  return (
    <section className="cd-page cd-history">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h2 className="cd-page__title">▎ HISTORY</h2>
          <p className="cd-page__sub">
            {items.length === 0
              ? "no launches yet"
              : `${items.length} launch${items.length === 1 ? "" : "es"}`}
          </p>
        </div>
        {items.length > 0 && (
          <Button variant="danger" size="sm" onClick={onClear}>
            Clear history
          </Button>
        )}
      </header>

      {items.length === 0 ? (
        <div className="cd-page__empty">No launches yet.</div>
      ) : (
        <ul className="cd-history__list">
          {items.map((item, idx) => (
            <HistoryRow key={`${item.timestamp}-${idx}`} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function HistoryRow({ item }: { item: HistoryItem }) {
  return (
    <li className="cd-history__item">
      <Card>
        <div className="cd-history__row">
          <div className="cd-history__main">
            <div className="cd-history__cli">{item.cli}</div>
            <div className="cd-history__dir" title={item.directory}>
              {truncateDir(item.directory)}
            </div>
            {item.args.trim() && (
              <code className="cd-history__args">{item.args}</code>
            )}
          </div>
          <time className="cd-history__time" dateTime={item.timestamp}>
            {relativeTime(item.timestamp)}
          </time>
        </div>
      </Card>
    </li>
  );
}
