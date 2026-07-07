import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Chip } from "../../ui/Chip";
import { getCliIcon, hasCliIcon } from "../../icons/registry";
import { getRecentDirs } from "../history/useHistory";
import { getPinnedDirs } from "./pinnedDirs";
import { showToast } from "../../ui/toastStore";
import { launchCliSession, recordFailedLaunch } from "./launchSession";
import type { CheckResult, CliInfo } from "./useClis";

interface CliCardProps {
  cli: CliInfo;
  check?: CheckResult;
  installing?: boolean;
  hasUpdate?: boolean;
  onLaunch: (cli: CliInfo) => void;
  onInstall: (cli: CliInfo) => void;
  /** ID estável usado pelo SortableContext; quando omitido, card não é arrastável. */
  dndId?: string;
}

function truncateEnd(s: string, max = 32): string {
  return s.length <= max ? s : `…${s.slice(s.length - (max - 1))}`;
}

export function CliCard({
  cli,
  check,
  installing = false,
  hasUpdate = false,
  onLaunch,
  onInstall,
  dndId,
}: CliCardProps) {
  const { t } = useTranslation();
  const sortable = useSortable({ id: dndId ?? `__nosort__:${cli.key}` });
  const dragStyle = dndId
    ? {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }
    : undefined;
  const installed = check?.installed ?? false;
  const version = check?.version ?? null;
  const pinnedDirs = useMemo(() => getPinnedDirs(cli.key), [cli.key]);
  const recentDirs = useMemo(
    () => getRecentDirs(cli.key).filter((d) => !pinnedDirs.includes(d)).slice(0, 3),
    [cli.key, pinnedDirs],
  );
  const [quickLaunching, setQuickLaunching] = useState(false);

  const quickLaunch = async (dir: string) => {
    setQuickLaunching(true);
    try {
      const result = await launchCliSession({
        cli,
        directory: dir,
        args: "",
        noPerms: true,
      });
      if (result.projectProfileError) {
        showToast(result.projectProfileError, "warning");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      recordFailedLaunch(cli, dir, "", message);
      showToast(message, "error");
    } finally {
      setQuickLaunching(false);
    }
  };

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
        {hasUpdate && <span className="cd-cli-card__update" title="Update available" aria-label="Update available">&#x2191;</span>}
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
      {installed && (pinnedDirs.length > 0 || recentDirs.length > 0) && (
        <div className="cd-cli-card__recents">
          {pinnedDirs.map((d) => (
            <button
              key={`pin-${d}`}
              className="cd-cli-card__recent-dir cd-cli-card__recent-dir--pinned"
              title={d}
              disabled={quickLaunching}
              onClick={(e) => {
                e.stopPropagation();
                void quickLaunch(d);
              }}
            >
              <span className="cd-cli-card__pin-icon" aria-hidden="true">&#x25C8;</span> {truncateEnd(d)}
            </button>
          ))}
          {recentDirs.map((d) => (
            <button
              key={d}
              className="cd-cli-card__recent-dir"
              title={d}
              disabled={quickLaunching}
              onClick={(e) => {
                e.stopPropagation();
                void quickLaunch(d);
              }}
            >
              <span className="cd-cli-card__dir-icon" aria-hidden="true">&#x25B7;</span> {truncateEnd(d)}
            </button>
          ))}
        </div>
      )}
      </Card>
    </div>
  );
}
