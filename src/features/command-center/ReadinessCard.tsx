import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import type { TabId } from "../../app/layout/TabId";
import type { ReadinessCard as ReadinessCardType } from "./commandCenterModel";

export function ReadinessCard({
  card,
  onNavigate,
}: {
  card: ReadinessCardType;
  onNavigate: (tab: TabId) => void;
}) {
  const { t } = useTranslation();
  const value =
    card.value === "None"
      ? t("commandCenter.none")
      : card.value === "Ready"
        ? t("commandCenter.ready")
        : card.value === "Draft"
          ? t("commandCenter.draft")
          : card.value === "Error"
            ? t("commandCenter.error")
            : card.value;

  return (
    <Card
      interactive
      className={`cd-command__ready cd-command__ready--${card.tone}`}
      onClick={() => onNavigate(card.targetTab)}
    >
      <span className="cd-command__ready-label">{t(card.labelKey)}</span>
      <strong>{value}</strong>
      <small>{t(card.detailKey, card.detailParams)}</small>
    </Card>
  );
}

export function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="cd-command__meta-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
