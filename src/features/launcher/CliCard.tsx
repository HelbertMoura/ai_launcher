import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Chip } from "../../ui/Chip";
import { getCliIcon, hasCliIcon } from "../../icons/registry";
import type { CheckResult, CliInfo } from "./useClis";

interface CliCardProps {
  cli: CliInfo;
  check?: CheckResult;
  installing?: boolean;
  hasUpdate?: boolean;
  onLaunch: (cli: CliInfo) => void;
  onInstall: (cli: CliInfo) => void;
}

export function CliCard({ cli, check, installing = false, hasUpdate = false, onLaunch, onInstall }: CliCardProps) {
  const { t } = useTranslation();
  const installed = check?.installed ?? false;
  const version = check?.version ?? null;
  return (
    <Card interactive>
      <div className="cd-cli-card__head">
        {hasCliIcon(cli.key) ? (
          <img className="cd-cli-card__icon" src={getCliIcon(cli.key)} alt="" />
        ) : (
          <span className="cd-cli-card__icon cd-cli-card__icon--placeholder" aria-hidden>
            ◆
          </span>
        )}
        <div className="cd-cli-card__meta">
          <div className="cd-cli-card__name">{cli.name}</div>
          <div className="cd-cli-card__cmd">{cli.command}</div>
        </div>
        <Chip variant={installed ? "online" : "missing"} dot>
          {installed ? (version ?? t("common.online")) : t("common.missing")}
        </Chip>
        {hasUpdate && <span className="cd-cli-card__update" title="Update available">⬆</span>}
      </div>
      <div className="cd-cli-card__actions">
        {installed ? (
          <Button size="sm" onClick={() => onLaunch(cli)}>{t("launcher.launch")}</Button>
        ) : (
          <Button size="sm" variant="ghost" loading={installing} onClick={() => onInstall(cli)}>
            {installing ? t("launcher.installing") : t("launcher.install")}
          </Button>
        )}
      </div>
    </Card>
  );
}
