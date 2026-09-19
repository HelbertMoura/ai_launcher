import { useTranslation } from "react-i18next";
import { CustomEntryCard } from "../shared/custom-entry/CustomEntryCard";
import { launchCustomIde } from "../../lib/tauri";
import { getToolIcon, hasToolIcon } from "../../icons/registry";
import type { CustomIde } from "../../lib/customIdes";

interface CustomIdeCardProps {
  ide: CustomIde;
  onLaunch: (ide: CustomIde) => void;
}

export function CustomIdeCard({ ide, onLaunch }: CustomIdeCardProps) {
  const { t } = useTranslation();

  const iconSrc =
    ide.iconDataUrl ||
    (hasToolIcon(ide.key) ? getToolIcon(ide.key) : null);

  return (
    <CustomEntryCard
      name={ide.name}
      commandText={ide.launchCmd}
      iconSrc={iconSrc}
      iconEmoji={ide.iconEmoji || "▶"}
      classPrefix="cd-tool-card"
      chipLabel="Custom"
      launchLabel={t("tools.launch")}
      onLaunch={() => onLaunch(ide)}
      testCommand={async () => {
        await launchCustomIde(ide.detectCmd, null);
      }}
    />
  );
}
