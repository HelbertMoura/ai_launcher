import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Chip } from "../../ui/Chip";
import { getToolIcon, hasToolIcon } from "../../icons/registry";
import type { CheckResult, ToolInfo } from "./useTools";

interface ToolCardProps {
  tool: ToolInfo;
  check?: CheckResult;
  installing?: boolean;
  launching?: boolean;
  onLaunch: (tool: ToolInfo) => void;
  onInstall: (tool: ToolInfo) => void;
}

export function ToolCard({
  tool,
  check,
  installing = false,
  launching = false,
  onLaunch,
  onInstall,
}: ToolCardProps) {
  const installed = check?.installed ?? false;
  const version = check?.version ?? null;
  return (
    <Card interactive>
      <div className="cd-tool-card__head">
        {hasToolIcon(tool.key) ? (
          <img className="cd-tool-card__icon" src={getToolIcon(tool.key)} alt="" />
        ) : (
          <span className="cd-tool-card__icon cd-tool-card__icon--placeholder" aria-hidden />
        )}
        <div className="cd-tool-card__meta">
          <div className="cd-tool-card__name">{tool.name}</div>
          <div className="cd-tool-card__cmd">{tool.command}</div>
        </div>
        <Chip variant={installed ? "online" : "missing"} dot>
          {installed ? (version ?? "online") : "missing"}
        </Chip>
      </div>
      <div className="cd-tool-card__actions">
        {installed ? (
          <Button size="sm" loading={launching} onClick={() => onLaunch(tool)}>
            {launching ? "Launching…" : "Launch"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            loading={installing}
            onClick={() => onInstall(tool)}
          >
            {installing ? "Installing…" : tool.install_url ? "Get" : "Install"}
          </Button>
        )}
      </div>
    </Card>
  );
}
