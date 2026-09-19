import { useTranslation } from "react-i18next";
import type { WorkspaceProfile } from "../../domain/types";
import type { HistoryItem } from "../history/useHistory";
import { BentoCard } from "./BentoCard";

interface ProfilesCardProps {
  profiles: WorkspaceProfile[];
  pinnedCount: number;
  activeId: string | null;
  historyItems?: HistoryItem[];
  onActivate: (id: string) => void;
  onEdit: (profile: WorkspaceProfile) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onNew: () => void;
  onCreateFromHistory: (item: HistoryItem) => void;
}

export function ProfilesCard({
  profiles,
  pinnedCount,
  activeId,
  historyItems,
  onActivate,
  onEdit,
  onDelete,
  onTogglePin,
  onNew,
  onCreateFromHistory,
}: ProfilesCardProps) {
  const { t } = useTranslation();
  const meta = t("workspace.profilesMeta", {
    total: profiles.length,
    pinned: pinnedCount,
  });

  const footer = (
    <button type="button" className="cd-ws-bento__btn" onClick={onNew}>
      + {t("workspace.new")}
    </button>
  );

  return (
    <BentoCard area="profiles" title={t("workspace.profilesTitle")} meta={meta} footer={footer}>
      {profiles.length === 0 ? (
        <div className="cd-ws-bento__empty">
          <p>{t("workspace.empty")}</p>
          {historyItems && historyItems.length > 0 && (
            <>
              <p className="cd-ws-bento__empty-hint">{t("workspace.createFromHistory")}</p>
              <div className="cd-ws-bento__history-list">
                {historyItems.slice(0, 5).map((item, i) => (
                  <button
                    key={`${item.cliKey}-${item.timestamp}-${i}`}
                    type="button"
                    className="cd-ws-bento__history-item"
                    onClick={() => onCreateFromHistory(item)}
                  >
                    <span className="cd-ws-bento__history-cli">{item.cli}</span>
                    <span className="cd-ws-bento__history-dir">{item.directory}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="cd-ws-bento__profiles">
          {profiles.map((profile) => (
            <WorkspaceCard
              key={profile.id}
              profile={profile}
              isActive={profile.id === activeId}
              onActivate={onActivate}
              onEdit={onEdit}
              onDelete={onDelete}
              onTogglePin={onTogglePin}
            />
          ))}
        </div>
      )}
    </BentoCard>
  );
}

interface WorkspaceCardProps {
  profile: WorkspaceProfile;
  isActive: boolean;
  onActivate: (id: string) => void;
  onEdit: (profile: WorkspaceProfile) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
}

function WorkspaceCard({
  profile,
  isActive,
  onActivate,
  onEdit,
  onDelete,
  onTogglePin,
}: WorkspaceCardProps) {
  const { t } = useTranslation();

  return (
    <div className={`cd-ws-card${isActive ? " cd-ws-card--active" : ""}`}>
      <div className="cd-ws-card__head">
        <span className="cd-ws-card__name">
          {profile.pinned && <span className="cd-ws-card__pin-mark">★ </span>}
          {profile.name}
        </span>
        <button
          type="button"
          className="cd-ws-card__pin"
          onClick={() => onTogglePin(profile.id)}
          title={profile.pinned ? t("workspace.unpin") : t("workspace.pin")}
        >
          {profile.pinned ? "★" : "☆"}
        </button>
      </div>
      {profile.description && (
        <div className="cd-ws-card__desc">{profile.description}</div>
      )}
      <div className="cd-ws-card__dir">{profile.directory}</div>
      <div className="cd-ws-card__clis">
        {profile.cliKeys.map((key) => (
          <span key={key} className="cd-ws-card__cli-tag">
            {key}
          </span>
        ))}
      </div>
      {profile.providerKey && (
        <div className="cd-ws-card__provider">{profile.providerKey}</div>
      )}
      <div className="cd-ws-card__foot">
        {isActive ? (
          <span className="cd-ws-card__active-badge">{t("workspace.active")}</span>
        ) : (
          <button
            type="button"
            className="cd-ws-card__activate"
            onClick={() => onActivate(profile.id)}
          >
            {t("workspace.activate")}
          </button>
        )}
        <button
          type="button"
          className="cd-ws-card__edit"
          onClick={() => onEdit(profile)}
        >
          {t("common.edit")}
        </button>
        <button
          type="button"
          className="cd-ws-card__delete"
          onClick={() => onDelete(profile.id)}
        >
          {t("common.delete")}
        </button>
      </div>
    </div>
  );
}
