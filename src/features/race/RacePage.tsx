import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Banner } from "../../ui/Banner";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Chip } from "../../ui/Chip";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { Icon } from "../../ui/Icon";
import { Input } from "../../ui/Input";
import { Warning } from "../../ui/icons";
import { useClis } from "../launcher/useClis";
import { raceStore } from "./raceStore";
import { useRace } from "./useRace";
import "../page.css";
import "./RacePage.css";

/** Backend cap (`MAX_AGENTS` in race.rs) enforced again in the form. */
const MAX_AGENTS = 3;

type StatusChipVariant = "neutral" | "online" | "offline" | "missing" | "update" | "warn";

/** Chip styling per known agent status; unknown values degrade to neutral. */
const STATUS_CHIP: Record<string, StatusChipVariant> = {
  running: "online",
  completed: "update",
  failed: "missing",
  killed: "warn",
  cancelled: "offline",
};

const KNOWN_AGENT_STATUSES = ["running", "completed", "failed", "killed"] as const;

function agentStatusLabel(status: string, translate: (key: string) => string): string {
  if ((KNOWN_AGENT_STATUSES as readonly string[]).includes(status)) {
    return translate(`race.status.${status}`);
  }
  return translate("race.status.unknown");
}

function formatDuration(secs: number | null): string {
  if (secs === null) return "—";
  const minutes = Math.floor(secs / 60);
  const rest = secs % 60;
  return minutes > 0 ? `${minutes}m ${String(rest).padStart(2, "0")}s` : `${rest}s`;
}

/**
 * Race Mode MVP (v23.2b): start form (directory, prompt, up to 3 detected
 * agent CLIs) plus the live race columns fed by `race_status` polling.
 * Diff inspection and result adoption land in 23.2c — the terminal banners
 * and the cost placeholder make that explicit instead of faking data.
 */
export function RacePage() {
  const { t } = useTranslation();
  const race = useRace();
  const { clis, checks } = useClis();

  const [directory, setDirectory] = useState("");
  const [taskPrompt, setTaskPrompt] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { phase, handle, snapshot, error, cancelling } = race;
  const isStarting = phase === "starting";
  const isTerminal = phase === "finished" || phase === "failed" || phase === "cancelled";

  // The surface opens ready to configure; remounting mid-race (e.g. after
  // navigating away and back) resumes the live poll cadence; after a race,
  // "New race" returns to the form.
  useEffect(() => {
    const current = raceStore.getSnapshot();
    if (current.phase === "running" && current.handle) {
      raceStore.resumePolling();
    } else if (current.phase === "idle") {
      raceStore.beginConfiguration();
    }
    // Clear the poll interval if this surface ever unmounts.
    return () => raceStore.dispose();
  }, []);

  // The checks map is keyed by the CLI display name (catalogStore contract),
  // not by its key.
  const detected = clis.filter((cli) => checks[cli.name]?.installed);

  const canStart =
    phase === "configuring" &&
    directory.trim().length > 0 &&
    taskPrompt.trim().length > 0 &&
    selected.length > 0 &&
    selected.length <= MAX_AGENTS;

  const toggleAgent = (key: string): void => {
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= MAX_AGENTS) return prev; // duplicates blocked by checkbox state
      return [...prev, key];
    });
  };

  const pickDirectory = async (): Promise<void> => {
    try {
      const picked = await openDialog({ directory: true, multiple: false });
      if (typeof picked === "string" && picked) setDirectory(picked);
    } catch {
      /* picker unavailable outside the Tauri runtime: keep manual entry */
    }
  };

  const startRace = (): void => {
    if (!canStart) return;
    void race.start({ directory, taskPrompt, agents: selected });
  };

  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      startRace();
    }
  };

  const terminalBanner =
    phase === "finished"
      ? { variant: "info" as const, text: t("race.finished") }
      : phase === "failed"
        ? { variant: "err" as const, text: t("race.failed") }
        : phase === "cancelled"
          ? { variant: "warn" as const, text: t("race.cancelled") }
          : null;

  return (
    <section className="cd-page cd-race">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h1 className="cd-page__title">▎ {t("race.title")}</h1>
          <p className="cd-page__sub">{t("race.subtitle")}</p>
        </div>
        {phase === "running" && (
          <span className="cd-race__live" role="status">{t("race.liveBadge")}</span>
        )}
      </header>

      {error && phase === "running" && (
        <Banner variant="warn">
          <span>{error}</span> <span className="cd-race__hint">{t("race.pollErrorNote")}</span>
        </Banner>
      )}

      {error && (phase === "configuring" || isStarting) && (
        <Banner variant="err">
          <strong>{t("race.errorTitle")}</strong>
          <span className="cd-race__error-message">{error}</span>
          <span className="cd-race__hint">{t("race.errorHint")}</span>
        </Banner>
      )}

      {(phase === "configuring" || isStarting) && (
        <Card className="cd-race__form">
          <h2 className="cd-race__kicker">{t("race.formTitle")}</h2>

          <div className="cd-race__field">
            <label className="cd-race__label" htmlFor="cd-race-directory">
              {t("race.directory")}
            </label>
            <div className="cd-race__directory">
              <Input
                id="cd-race-directory"
                value={directory}
                onChange={(event) => setDirectory(event.target.value)}
                placeholder="C:\projects\meu-app"
                spellCheck={false}
                disabled={isStarting}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void pickDirectory()}
                disabled={isStarting}
              >
                {t("common.browse")}
              </Button>
            </div>
          </div>

          <div className="cd-race__field">
            <label className="cd-race__label" htmlFor="cd-race-prompt">
              {t("race.prompt")}
            </label>
            <textarea
              id="cd-race-prompt"
              className="cd-race__prompt"
              value={taskPrompt}
              onChange={(event) => setTaskPrompt(event.target.value)}
              onKeyDown={handlePromptKeyDown}
              placeholder={t("race.promptPlaceholder")}
              rows={5}
              spellCheck={false}
              disabled={isStarting}
            />
            <p className="cd-race__hint">{t("race.promptHint")}</p>
          </div>

          <fieldset className="cd-race__agents" disabled={isStarting}>
            <legend className="cd-race__label">{t("race.agents")}</legend>
            {detected.length === 0 ? (
              <p className="cd-race__hint">{t("race.agentsEmpty")}</p>
            ) : (
              <div className="cd-race__agent-list">
                {detected.map((cli) => {
                  const checked = selected.includes(cli.key);
                  const version = checks[cli.name]?.version;
                  return (
                    <label
                      key={cli.key}
                      className={`cd-race__agent${checked ? " cd-race__agent--on" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && selected.length >= MAX_AGENTS}
                        onChange={() => toggleAgent(cli.key)}
                      />
                      <span className="cd-race__agent-name">{cli.name}</span>
                      {version && (
                        <span className="cd-race__agent-version">{version}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
            <p className="cd-race__hint">
              {selected.length >= MAX_AGENTS ? t("race.agentsMax") : t("race.agentsHint")}
            </p>
          </fieldset>

          <div className="cd-race__actions">
            <Button onClick={startRace} disabled={!canStart} loading={isStarting}>
              {isStarting ? t("race.starting") : t("race.start")}
            </Button>
          </div>
        </Card>
      )}

      {(phase === "running" || isTerminal) && handle && (
        <>
          {handle.warnings.length > 0 && (
            <Banner variant="warn" icon={<Icon icon={Warning} size={14} weight="bold" />}>
              <strong>{t("race.warningsTitle")}</strong>
              <ul className="cd-race__banner-list">
                {handle.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Banner>
          )}

          {!snapshot && (
            <p className="cd-race__waiting" role="status">{t("race.waitingFirst")}</p>
          )}

          {snapshot && (
            <div className="cd-race__grid">
              {snapshot.agents.map((agent) => (
                <Card key={agent.agent} className="cd-race__column">
                  <div className="cd-race__column-head">
                    <span className="cd-race__agent-title">{agent.agent}</span>
                    <Chip
                      variant={STATUS_CHIP[agent.status] ?? "neutral"}
                      dot
                    >
                      {agentStatusLabel(agent.status, t)}
                    </Chip>
                  </div>
                  <dl className="cd-race__metrics">
                    <div>
                      <dt>{t("race.duration")}</dt>
                      <dd>{formatDuration(agent.duration_secs)}</dd>
                    </div>
                    <div>
                      <dt>{t("race.exit")}</dt>
                      <dd>
                        {agent.exit_code === null
                          ? "—"
                          : t("race.exitCode", { code: agent.exit_code })}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("race.cost")}</dt>
                      {/* Documented placeholder: the snapshot carries no cost
                          fields yet (23.2 design §3). Never invent data. */}
                      <dd title={t("race.costPlaceholder")}>—</dd>
                    </div>
                  </dl>
                  <div className="cd-race__log-block">
                    <span className="cd-race__kicker">{t("race.logs")}</span>
                    {agent.last_log_lines.length > 0 ? (
                      <pre className="cd-race__log">{agent.last_log_lines.join("\n")}</pre>
                    ) : (
                      <p className="cd-race__hint">{t("race.logsEmpty")}</p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div className="cd-race__actions">
            {phase === "running" && (
              <Button
                variant="danger"
                onClick={() => setConfirmOpen(true)}
                loading={cancelling}
              >
                {cancelling ? t("race.cancelling") : t("race.cancel")}
              </Button>
            )}
            {isTerminal && (
              <Button variant="ghost" onClick={race.beginConfiguration}>
                {t("race.newRace")}
              </Button>
            )}
          </div>
        </>
      )}

      {isTerminal && terminalBanner && (
        <Banner variant={terminalBanner.variant}>{terminalBanner.text}</Banner>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={t("race.cancelConfirmTitle")}
        message={t("race.cancelConfirmBody")}
        confirmLabel={t("race.cancel")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        onConfirm={() => {
          setConfirmOpen(false);
          void race.cancel();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
}
