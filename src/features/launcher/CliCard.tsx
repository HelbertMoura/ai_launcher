import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Chip } from "../../ui/Chip";
import { getCliIcon, hasCliIcon } from "../../icons/registry";
import type { CheckResult, CliInfo } from "./useClis";

interface CliCardProps {
  cli: CliInfo;
  check?: CheckResult;
  installing?: boolean;
  onLaunch: (cli: CliInfo) => void;
  onInstall: (cli: CliInfo) => void;
}

export function CliCard({ cli, check, installing = false, onLaunch, onInstall }: CliCardProps) {
  const installed = check?.installed ?? false;
  const version = check?.version ?? null;
  return (
    <Card interactive>
      <div className="cd-cli-card__head">
        {hasCliIcon(cli.key) ? (
          <img className="cd-cli-card__icon" src={getCliIcon(cli.key)} alt="" />
        ) : (
          <span className="cd-cli-card__icon cd-cli-card__icon--placeholder" aria-hidden />
        )}
        <div className="cd-cli-card__meta">
          <div className="cd-cli-card__name">{cli.name}</div>
          <div className="cd-cli-card__cmd">{cli.command}</div>
        </div>
        <Chip variant={installed ? "online" : "missing"} dot>
          {installed ? (version ?? "online") : "missing"}
        </Chip>
      </div>
      <div className="cd-cli-card__actions">
        {installed ? (
          <Button size="sm" onClick={() => onLaunch(cli)}>Launch</Button>
        ) : (
          <Button size="sm" variant="ghost" loading={installing} onClick={() => onInstall(cli)}>
            {installing ? "Installing…" : "Install"}
          </Button>
        )}
      </div>
    </Card>
  );
}
