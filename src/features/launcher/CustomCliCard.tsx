import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { Chip } from "../../ui/Chip";
import { getCliIcon, hasCliIcon } from "../../icons/registry";
import type { DragStartHandlers, DropHandlers } from "../../hooks/useDraggable";
import type { CustomCli } from "../../lib/customClis";

interface CustomCliCardProps {
  cli: CustomCli;
  onLaunch: (cli: CustomCli) => void;
  startHandlers?: DragStartHandlers;
  dropHandlers?: DropHandlers;
  isDropTarget?: boolean;
}

export function CustomCliCard({
  cli,
  onLaunch,
  startHandlers,
  dropHandlers,
  isDropTarget = false,
}: CustomCliCardProps) {
  const { t } = useTranslation();
  const iconSrc =
    cli.iconDataUrl ||
    (hasCliIcon(cli.key) ? getCliIcon(cli.key) : null);
  const iconEmoji = cli.iconEmoji || "▶";

  return (
    <div
      className={`cd-draggable-item${isDropTarget ? " cd-draggable-item--drop-target" : ""}`}
      {...(dropHandlers ?? {})}
    >
      <Card interactive>
      <div className="cd-cli-card__head">
        {startHandlers && (
          <span
            className="cd-drag-handle"
            aria-label={t("launcher.dragToReorder")}
            title={t("launcher.dragToReorder")}
            {...startHandlers}
          >
            ⋮⋮
          </span>
        )}
        {iconSrc ? (
          <img className="cd-cli-card__icon" src={iconSrc} alt="" />
        ) : (
          <span className="cd-cli-card__icon cd-cli-card__icon--placeholder" aria-hidden>
            {iconEmoji}
          </span>
        )}
        <div className="cd-cli-card__meta">
          <div className="cd-cli-card__name">{cli.name}</div>
          <div className="cd-cli-card__cmd">{cli.installCmd.split(/\s+/).pop() ?? cli.key}</div>
        </div>
        <Chip variant="admin">Custom</Chip>
      </div>
      <div className="cd-cli-card__actions">
        <button
          type="button"
          className="cd-cli-card__launch-btn"
          onClick={() => onLaunch(cli)}
        >
          {t("launcher.launch")}
        </button>
      </div>
      </Card>
    </div>
  );
}
