import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { Chip } from "../../ui/Chip";
import { getCliIcon, hasCliIcon } from "../../icons/registry";
import type { CustomCli } from "../../lib/customClis";

interface CustomCliCardProps {
  cli: CustomCli;
  onLaunch: (cli: CustomCli) => void;
}

export function CustomCliCard({ cli, onLaunch }: CustomCliCardProps) {
  const { t } = useTranslation();
  const iconSrc =
    cli.iconDataUrl ||
    (hasCliIcon(cli.key) ? getCliIcon(cli.key) : null);
  const iconEmoji = cli.iconEmoji || "▶";

  return (
    <Card interactive>
      <div className="cd-cli-card__head">
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
  );
}
