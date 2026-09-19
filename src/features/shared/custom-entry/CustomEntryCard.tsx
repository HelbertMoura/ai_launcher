import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "../../../ui/Card";
import { Chip } from "../../../ui/Chip";

/**
 * Shared card for user-defined catalog entries (custom CLIs and custom
 * IDEs). `classPrefix` selects the legacy CSS class family ("cd-cli-card"
 * for the launcher, "cd-tool-card" for tools) so markup stays identical
 * to the original feature cards.
 */
export interface CustomEntryCardProps {
  name: string;
  /** Text shown in the card subtitle (resolved command). */
  commandText: string;
  iconSrc: string | null;
  iconEmoji: string;
  /** CSS class prefix, e.g. "cd-cli-card" or "cd-tool-card". */
  classPrefix: string;
  /** Text of the admin chip (already translated by the caller). */
  chipLabel: string;
  launchLabel: string;
  onLaunch: () => void;
  /**
   * When provided, renders the "Test" button. Resolve = command found,
   * reject = missing.
   */
  testCommand?: () => Promise<void>;
  /** Optional node rendered at the start of the head row (drag handle). */
  headLeading?: ReactNode;
}

export function CustomEntryCard({
  name,
  commandText,
  iconSrc,
  iconEmoji,
  classPrefix,
  chipLabel,
  launchLabel,
  onLaunch,
  testCommand,
  headLeading,
}: CustomEntryCardProps) {
  const { t } = useTranslation();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"found" | "missing" | null>(null);

  const handleTestPath = async () => {
    if (!testCommand) return;
    setTesting(true);
    setTestResult(null);
    try {
      await testCommand();
      setTestResult("found");
    } catch {
      setTestResult("missing");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card interactive>
      <div className={`${classPrefix}__head`}>
        {headLeading}
        {iconSrc ? (
          <img className={`${classPrefix}__icon`} src={iconSrc} alt="" />
        ) : (
          <span
            className={`${classPrefix}__icon ${classPrefix}__icon--placeholder`}
            aria-hidden
          >
            {iconEmoji}
          </span>
        )}
        <div className={`${classPrefix}__meta`}>
          <div className={`${classPrefix}__name`}>{name}</div>
          <div className={`${classPrefix}__cmd`}>{commandText}</div>
        </div>
        <Chip variant="admin">{chipLabel}</Chip>
      </div>
      <div className={`${classPrefix}__actions`}>
        <button type="button" className="cd-cli-card__launch-btn" onClick={onLaunch}>
          {launchLabel}
        </button>
        {testCommand && (
          <button
            type="button"
            className="cd-tool-card__test-btn"
            disabled={testing}
            onClick={handleTestPath}
            title="Test if command is available"
          >
            {testing ? "..." : "Test"}
          </button>
        )}
        {testResult === "found" && <Chip variant="online" dot>{t("common.online")}</Chip>}
        {testResult === "missing" && <Chip variant="missing" dot>{t("common.missing")}</Chip>}
      </div>
    </Card>
  );
}

export interface SortableCustomEntryCardProps extends CustomEntryCardProps {
  entryKey: string;
  /** ID estável usado pelo SortableContext; quando omitido, card não é arrastável. */
  dndId?: string;
  dragHandleLabel: string;
}

/** Sortable variant used by the launcher grid (dnd-kit). */
export function SortableCustomEntryCard({
  entryKey,
  dndId,
  dragHandleLabel,
  ...cardProps
}: SortableCustomEntryCardProps) {
  const sortable = useSortable({ id: dndId ?? `__nosort__:${entryKey}` });
  const dragStyle = dndId
    ? {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }
    : undefined;

  return (
    <div
      ref={dndId ? sortable.setNodeRef : undefined}
      style={dragStyle}
      className={`cd-draggable-item${sortable.isDragging ? " cd-draggable-item--dragging" : ""}`}
    >
      <CustomEntryCard
        {...cardProps}
        headLeading={
          dndId ? (
            <span
              className="cd-drag-handle"
              aria-label={dragHandleLabel}
              title={dragHandleLabel}
              {...sortable.attributes}
              {...sortable.listeners}
            >
              ⋮⋮
            </span>
          ) : undefined
        }
      />
    </div>
  );
}
