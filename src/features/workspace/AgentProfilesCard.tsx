import { useTranslation } from "react-i18next";
import type { AgentProfile } from "../../domain/types";
import { BentoCard } from "./BentoCard";

interface AgentProfilesCardProps {
  profiles: AgentProfile[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onEdit: (profile: AgentProfile) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onNew: () => void;
}

export function AgentProfilesCard({
  profiles,
  activeId,
  onActivate,
  onEdit,
  onDelete,
  onTogglePin,
  onNew,
}: AgentProfilesCardProps) {
  const { t } = useTranslation();
  const footer = (
    <button type="button" className="cd-ws-bento__btn" onClick={onNew}>
      + {t("workspace.agentNew")}
    </button>
  );

  return (
    <BentoCard
      area="agents"
      title={t("workspace.agentProfilesTitle")}
      meta={t("workspace.totalMeta", { count: profiles.length })}
      footer={footer}
    >
      {profiles.length === 0 ? (
        <p className="cd-ws-bento__dim">{t("workspace.agentProfilesEmpty")}</p>
      ) : (
        <div className="cd-ws-agent-list">
          {profiles.map((profile) => (
            <AgentProfileCard
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

interface AgentProfileCardProps {
  profile: AgentProfile;
  isActive: boolean;
  onActivate: (id: string) => void;
  onEdit: (profile: AgentProfile) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
}

function AgentProfileCard({
  profile,
  isActive,
  onActivate,
  onEdit,
  onDelete,
  onTogglePin,
}: AgentProfileCardProps) {
  const { t } = useTranslation();
  const summary = [
    profile.cliKey || t("workspace.agentDefaultCli"),
    profile.providerKey,
    profile.runbookId,
  ].filter(Boolean);

  return (
    <div className={`cd-ws-agent${isActive ? " cd-ws-agent--active" : ""}`}>
      <div className="cd-ws-agent__head">
        <span className="cd-ws-agent__name">
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
      {profile.description && <p className="cd-ws-agent__desc">{profile.description}</p>}
      <p className="cd-ws-agent__meta">{summary.join(" · ")}</p>
      {profile.args && <code className="cd-ws-agent__args">{profile.args}</code>}
      {profile.tags.length > 0 && (
        <div className="cd-ws-agent__tags">
          {profile.tags.slice(0, 4).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
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
        <button type="button" className="cd-ws-card__edit" onClick={() => onEdit(profile)}>
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
