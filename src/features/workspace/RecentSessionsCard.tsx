import { useTranslation } from "react-i18next";
import { useHistory } from "../history/useHistory";
import type { TabId } from "../../app/layout/TabId";
import { BentoCard } from "./BentoCard";
import { timeAgo } from "./relativeTimeModel";

export function RecentSessionsCard({ onNavigate }: { onNavigate?: (tab: TabId) => void }) {
  const { t } = useTranslation();
  const { items } = useHistory();
  const recent = items.slice(0, 5);
  const meta = t("workspace.totalMeta", { count: items.length });
  const handleActivate = onNavigate ? () => onNavigate("history") : undefined;

  return (
    <BentoCard
      area="sessions"
      title={t("workspace.sessionsTitle")}
      meta={meta}
      onActivate={handleActivate}
    >
      {recent.length === 0 ? (
        <p className="cd-ws-bento__dim">{t("workspace.nothingYet")}</p>
      ) : (
        <ul className="cd-ws-bento__session-list">
          {recent.map((item, i) => (
            <li
              key={`${item.sessionId ?? item.cliKey}-${item.timestamp}-${i}`}
              className="cd-ws-bento__session-item"
            >
              <span className={`cd-ws-bento__session-dot cd-ws-bento__session-dot--${item.status}`} />
              <span className="cd-ws-bento__session-cli">{item.cli}</span>
              <span className="cd-ws-bento__session-time">{timeAgo(item.timestamp)}</span>
            </li>
          ))}
        </ul>
      )}
    </BentoCard>
  );
}
