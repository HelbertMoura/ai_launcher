import { useTranslation } from "react-i18next";
import { CustomEntryLaunchDialog } from "../shared/custom-entry/CustomEntryLaunchDialog";
import { launchCustomIde } from "../../lib/tauri";
import type { CustomIde } from "../../lib/customIdes";

interface CustomIdeLaunchDialogProps {
  ide: CustomIde | null;
  onClose: () => void;
}

export function CustomIdeLaunchDialog({ ide, onClose }: CustomIdeLaunchDialogProps) {
  const { t } = useTranslation();

  return (
    <CustomEntryLaunchDialog
      entry={ide}
      onClose={onClose}
      launchLabel={t("tools.launch")}
      commandLine={(directory) =>
        ide ? ide.launchCmd.replace("<dir>", directory || ".") : ""
      }
      launch={async (directory) => {
        if (!ide) return;
        await launchCustomIde(ide.launchCmd, directory || null);
      }}
      notifyDirectory={(directory) => directory || "~"}
    />
  );
}
