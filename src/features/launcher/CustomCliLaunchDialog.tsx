import { useTranslation } from "react-i18next";
import { CustomEntryLaunchDialog } from "../shared/custom-entry/CustomEntryLaunchDialog";
import { launchCustomCli } from "../../lib/tauri";
import type { CustomCli } from "../../lib/customClis";

interface CustomCliLaunchDialogProps {
  cli: CustomCli | null;
  onClose: () => void;
}

export function CustomCliLaunchDialog({ cli, onClose }: CustomCliLaunchDialogProps) {
  const { t } = useTranslation();

  return (
    <CustomEntryLaunchDialog
      entry={cli}
      onClose={onClose}
      requireDirectory
      showArgsField
      launchLabel={t("launcher.launch")}
      commandLine={(_directory, args) =>
        cli
          ? [
              cli.installCmd.split(/\s+/).pop() ?? cli.key,
              cli.launchArgs || args
                ? [cli.launchArgs, args].filter(Boolean).join(" ")
                : "",
            ].filter(Boolean).join(" ")
          : ""
      }
      launch={async (directory, args) => {
        if (!cli) return;
        const command = cli.installCmd.split(/\s+/).pop() ?? cli.key;
        const allArgs = [cli.launchArgs, args].filter(Boolean).join(" ") || null;
        await launchCustomCli({
          command,
          args: allArgs,
          directory,
          env: null,
        });
      }}
    />
  );
}
