import { useTranslation } from "react-i18next";
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

function useRelativeTime() {
  const { t } = useTranslation();
  return (iso: string): string => {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return iso;
    const diff = Date.now() - then;
    if (diff < 60_000) return t("history.justNow");
    if (diff < 3_600_000)
      return t("history.minutesAgo", { count: Math.floor(diff / 60_000) });
    if (diff < 86_400_000)
      return t("history.hoursAgo", { count: Math.floor(diff / 3_600_000) });
    if (diff < 604_800_000)
      return t("history.daysAgo", { count: Math.floor(diff / 86_400_000) });
    return new Date(iso).toLocaleDateString();
  };
}

export function HistoryPage() {
  const { t } = useTranslation();
  const { items, clear } = useHistory();

  const onClear = () => {
    if (items.length === 0) return;
    const ok = window.confirm(t("history.clearConfirm"));
    if (ok) clear();
  };

  return (
    <section className="cd-page cd-history">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h2 className="cd-page__title">▎ {t("history.title")}</h2>
          <p className="cd-page__sub">
            {items.length === 0
              ? t("history.none")
              : t("history.count", { count: items.length })}
          </p>
        </div>
        {items.length > 0 && (
          <Button variant="danger" size="sm" onClick={onClear}>
            {t("history.clear")}
          </Button>
        )}
      </header>

      {items.length === 0 ? (
        <div className="cd-page__empty">{t("history.none")}.</div>
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
  const relativeTime = useRelativeTime();
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
