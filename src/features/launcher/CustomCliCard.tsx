import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "../../ui/Card";
import { Chip } from "../../ui/Chip";
import { getCliIcon, hasCliIcon } from "../../icons/registry";
import type { CustomCli } from "../../lib/customClis";

interface CustomCliCardProps {
  cli: CustomCli;
  onLaunch: (cli: CustomCli) => void;
  /** ID estável usado pelo SortableContext; quando omitido, card não é arrastável. */
  dndId?: string;
}

export function CustomCliCard({ cli, onLaunch, dndId }: CustomCliCardProps) {
  const { t } = useTranslation();
  const sortable = useSortable({ id: dndId ?? `__nosort__:${cli.key}` });
  const dragStyle = dndId
    ? {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }
    : undefined;

  const iconSrc =
    cli.iconDataUrl ||
    (hasCliIcon(cli.key) ? getCliIcon(cli.key) : null);
  const iconEmoji = cli.iconEmoji || "▶";

  return (
    <div
      ref={dndId ? sortable.setNodeRef : undefined}
      style={dragStyle}
      className={`cd-draggable-item${sortable.isDragging ? " cd-draggable-item--dragging" : ""}`}
      {...(dndId ? sortable.attributes : {})}
    >
      <Card interactive>
      <div className="cd-cli-card__head">
        {dndId && (
          <span
            className="cd-drag-handle"
            aria-label={t("launcher.dragToReorder")}
            title={t("launcher.dragToReorder")}
            {...sortable.listeners}
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
