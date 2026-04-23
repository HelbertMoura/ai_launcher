import { useTranslation } from "react-i18next";
import type { PrereqCheck } from "./usePrerequisites";

interface PrereqCardProps {
  item: PrereqCheck;
}

export function PrereqCard({ item }: PrereqCardProps) {
  const { t } = useTranslation();

  const isUrl = item.install_command?.startsWith("http");

  return (
    <div className={`cd-prereq-card${item.installed ? " cd-prereq-card--ok" : " cd-prereq-card--missing"}`}>
      <div className="cd-prereq-card__icon">{item.installed ? "✓" : "✗"}</div>
      <div className="cd-prereq-card__body">
        <div className="cd-prereq-card__name">{item.name}</div>
        <div className="cd-prereq-card__version">
          {item.version ?? t("prereqs.notInstalled")}
        </div>
      </div>
      {!item.installed && item.install_command && (
        <div className="cd-prereq-card__action">
          {isUrl ? (
            <span className="cd-prereq-card__hint">{item.install_command}</span>
          ) : (
            <code className="cd-prereq-card__cmd">{item.install_command}</code>
          )}
        </div>
      )}
    </div>
  );
}
