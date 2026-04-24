import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "../../ui/Card";
import { Chip } from "../../ui/Chip";
import { getToolIcon, hasToolIcon } from "../../icons/registry";
import type { CustomIde } from "../../lib/customIdes";

interface CustomIdeCardProps {
  ide: CustomIde;
  onLaunch: (ide: CustomIde) => void;
}

export function CustomIdeCard({ ide, onLaunch }: CustomIdeCardProps) {
  const { t } = useTranslation();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"found" | "missing" | null>(null);

  const iconSrc =
    ide.iconDataUrl ||
    (hasToolIcon(ide.key) ? getToolIcon(ide.key) : null);
  const iconEmoji = ide.iconEmoji || "▶";

  const handleTestPath = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await invoke<string>("launch_custom_ide", {
        launchCmd: ide.detectCmd,
        directory: null,
      });
      setTestResult("found");
    } catch {
      setTestResult("missing");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card interactive>
      <div className="cd-tool-card__head">
        {iconSrc ? (
          <img className="cd-tool-card__icon" src={iconSrc} alt="" />
        ) : (
          <span className="cd-tool-card__icon cd-tool-card__icon--placeholder" aria-hidden>
            {iconEmoji}
          </span>
        )}
        <div className="cd-tool-card__meta">
          <div className="cd-tool-card__name">{ide.name}</div>
          <div className="cd-tool-card__cmd">{ide.launchCmd}</div>
        </div>
        <Chip variant="admin">Custom</Chip>
      </div>
      <div className="cd-tool-card__actions">
        <button
          type="button"
          className="cd-cli-card__launch-btn"
          onClick={() => onLaunch(ide)}
        >
          {t("tools.launch")}
        </button>
        <button
          type="button"
          className="cd-tool-card__test-btn"
          disabled={testing}
          onClick={handleTestPath}
          title="Test if command is available"
        >
          {testing ? "..." : "Test"}
        </button>
        {testResult === "found" && (
          <Chip variant="online" dot>{t("common.online")}</Chip>
        )}
        {testResult === "missing" && (
          <Chip variant="missing" dot>{t("common.missing")}</Chip>
        )}
      </div>
    </Card>
  );
}
