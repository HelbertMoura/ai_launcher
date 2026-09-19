import { useTranslation } from "react-i18next";
import { SortableCustomEntryCard } from "../shared/custom-entry/CustomEntryCard";
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

  const iconSrc =
    cli.iconDataUrl ||
    (hasCliIcon(cli.key) ? getCliIcon(cli.key) : null);

  return (
    <SortableCustomEntryCard
      dndId={dndId}
      entryKey={cli.key}
      dragHandleLabel={t("launcher.dragToReorder")}
      name={cli.name}
      commandText={cli.installCmd.split(/\s+/).pop() ?? cli.key}
      iconSrc={iconSrc}
      iconEmoji={cli.iconEmoji || "▶"}
      classPrefix="cd-cli-card"
      chipLabel={t("launcher.custom")}
      launchLabel={t("launcher.launch")}
      onLaunch={() => onLaunch(cli)}
    />
  );
}
