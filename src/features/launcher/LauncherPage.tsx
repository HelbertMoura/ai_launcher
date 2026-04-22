import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Banner } from "../../ui/Banner";
import { Button } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { CliCard } from "./CliCard";
import { LaunchDialog } from "./LaunchDialog";
import { useClis, type CliInfo } from "./useClis";
import "../page.css";
import "./LauncherPage.css";

export function LauncherPage() {
  const { t } = useTranslation();
  const { clis, checks, loading, error, refresh } = useClis();
  const [launching, setLaunching] = useState<CliInfo | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);

  const onInstall = async (cli: CliInfo) => {
    setInstalling(cli.key);
    try {
      await invoke<string>("install_cli", { cliKey: cli.key, timeoutSec: null });
      await refresh();
    } catch {
      // error surfaced in next refresh via CheckResult.missing
    } finally {
      setInstalling(null);
    }
  };

  const installedCount = Object.values(checks).filter((c) => c.installed).length;

  return (
    <section className="cd-page cd-launcher">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h2 className="cd-page__title">▎ {t("launcher.title")}</h2>
          <p className="cd-page__sub">
            {loading
              ? t("common.scanning")
              : t("launcher.installedCount", {
                  installed: installedCount,
                  total: clis.length,
                })}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void refresh()}
          disabled={loading}
          title={t("launcher.rescanTip")}
        >
          ⟳ {t("common.rescan")}
        </Button>
      </header>

      {error && <Banner variant="err">{error}</Banner>}

      {loading && (
        <div className="cd-page__grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="card" height={92} />
          ))}
        </div>
      )}

      {!loading && clis.length === 0 && (
        <div className="cd-page__empty">{t("launcher.empty")}</div>
      )}

      {!loading && clis.length > 0 && (
        <div className="cd-page__grid">
          {clis.map((cli) => (
            <CliCard
              key={cli.key}
              cli={cli}
              check={checks[cli.name]}
              installing={installing === cli.key}
              onLaunch={setLaunching}
              onInstall={onInstall}
            />
          ))}
        </div>
      )}

      <LaunchDialog cli={launching} onClose={() => setLaunching(null)} />
    </section>
  );
}
