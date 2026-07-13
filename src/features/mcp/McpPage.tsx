import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Banner } from "../../ui/Banner";
import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { EmptyState, ART_TOOLBOX } from "../../ui/EmptyState";
import { Skeleton } from "../../ui/Skeleton";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { showToast } from "../../ui/toastStore";
import { useMcp } from "./useMcp";
import {
  MCP_CLIS,
  type McpCli,
  type McpHealth,
  type McpServer,
  type McpServerInput,
} from "./types";
import { MCP_CATALOG, isCatalogEntryValid, type McpCatalogEntry } from "./catalog";
import { serverToHealthInput } from "./projectMcp";
import { McpServerDialog, type McpDialogInitial } from "./McpServerDialog";
import { buildMcpOverview, mcpHealthKey } from "./mcpPageModel";
import { getExecutionMode } from '../../domain/executionMode';
import { appendAuditEvent } from '../../lib/auditLog';
import { getActiveWorkspaceId } from '../workspace/workspaceStore';
import "../page.css";
import "./McpPage.css";

const CLI_LABELS: Record<McpCli, string> = {
  claude: "Claude",
  codex: "Codex",
  gemini: "Gemini",
};

export function McpPage() {
  const { t } = useTranslation();
  const {
    servers,
    loading,
    error,
    refresh,
    addServer,
    updateServer,
    removeServer,
    healthCheck,
  } = useMcp();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [dialogInitial, setDialogInitial] = useState<McpDialogInitial>({});
  const [confirmTarget, setConfirmTarget] = useState<McpServer | null>(null);
  const [health, setHealth] = useState<Record<string, McpHealth>>({});

  const grouped = useMemo(() => {
    const map: Record<McpCli, McpServer[]> = { claude: [], codex: [], gemini: [] };
    for (const s of servers) map[s.cli].push(s);
    return map;
  }, [servers]);

  const overview = useMemo(
    () => buildMcpOverview(servers, health),
    [servers, health],
  );

  // Run a lightweight health check for every listed server whenever the list
  // changes. Failures degrade gracefully (no entry => "unknown" pill).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, McpHealth> = {};
      for (const s of servers) {
        try {
          const h = await healthCheck(serverToHealthInput(s));
          if (cancelled) return;
          next[`${s.cli}:${s.name}`] = h;
        } catch {
          /* leave unknown */
        }
      }
      if (!cancelled) setHealth(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [servers, healthCheck]);

  const openAdd = useCallback((cli?: McpCli) => {
    setDialogMode("add");
    setDialogInitial(cli ? { cli } : {});
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((s: McpServer) => {
    setDialogMode("edit");
    setDialogInitial({
      cli: s.cli,
      cliLocked: true,
      originalName: s.name,
      name: s.name,
      transport: s.transport,
      command: s.command,
      args: s.args,
      url: s.url,
      envKeys: s.env_keys,
    });
    setDialogOpen(true);
  }, []);

  const openCatalog = useCallback((entry: McpCatalogEntry) => {
    if (!isCatalogEntryValid(entry)) {
      showToast(t("mcp.catalogInvalid"), "error");
      return;
    }
    setDialogMode("add");
    setDialogInitial({
      name: entry.name,
      transport: entry.transport,
      command: entry.command,
      args: entry.args,
      url: entry.url,
      envKeys: entry.envKeys,
    });
    setDialogOpen(true);
  }, [t]);

  const handleSubmit = useCallback(
    async (cli: McpCli, name: string, server: McpServerInput) => {
      if (dialogMode === "add") {
        await addServer(cli, server);
        appendAuditEvent({ action: 'mcp.server.add', outcome: 'confirmed', mode: getExecutionMode(), workspaceId: getActiveWorkspaceId() ?? undefined, detail: `${cli}:${server.name}` });
        showToast(t("mcp.toastAdded", { name: server.name }), "success");
      } else {
        await updateServer(cli, name, server);
        appendAuditEvent({ action: 'mcp.server.update', outcome: 'confirmed', mode: getExecutionMode(), workspaceId: getActiveWorkspaceId() ?? undefined, detail: `${cli}:${server.name}` });
        showToast(t("mcp.toastUpdated", { name: server.name }), "success");
      }
    },
    [dialogMode, addServer, updateServer, t],
  );

  const handleRemove = useCallback(async () => {
    if (!confirmTarget) return;
    const target = confirmTarget;
    setConfirmTarget(null);
    try {
      await removeServer(target.cli, target.name);
      appendAuditEvent({ action: 'mcp.server.remove', outcome: 'confirmed', mode: getExecutionMode(), workspaceId: getActiveWorkspaceId() ?? undefined, detail: `${target.cli}:${target.name}` });
      showToast(t("mcp.toastRemoved", { name: target.name }), "success");
    } catch (e: unknown) {
      appendAuditEvent({ action: 'mcp.server.remove', outcome: 'failed', mode: getExecutionMode(), workspaceId: getActiveWorkspaceId() ?? undefined, detail: `${target.cli}:${target.name}` });
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  }, [confirmTarget, removeServer, t]);

  const hasAny = servers.length > 0;

  return (
    <section className="cd-page cd-mcp">
      <header className="cd-page__head">
        <div className="cd-page__heading">
            <h1 id="mcp-page-title" className="cd-page__title">▎ {t("mcp.title")}</h1>
          <p className="cd-page__sub">{t("mcp.subtitle")}</p>
        </div>
        <div className="cd-mcp__head-actions">
          <Button size="sm" variant="ghost" onClick={() => void refresh()}>
            {t("common.refresh")}
          </Button>
          <Button size="sm" variant="primary" onClick={() => openAdd()}>
            + {t("mcp.add")}
          </Button>
        </div>
      </header>

      <section
        className="cd-mcp-overview"
        aria-labelledby="mcp-overview-title"
        aria-live="polite"
      >
        <div className="cd-mcp-overview__lead">
          <span className="cd-mcp-overview__eyebrow">{t("mcp.overviewEyebrow")}</span>
          <strong id="mcp-overview-title">
            {loading
              ? t("mcp.overviewLoading")
              : t("mcp.overviewTitle", { count: overview.total })}
          </strong>
          <span>{t("mcp.overviewHint")}</span>
        </div>
        <div className="cd-mcp-overview__metrics">
          <div><strong>{overview.healthy}</strong><span>{t("mcp.metricHealthy")}</span></div>
          <div><strong>{overview.unavailable}</strong><span>{t("mcp.metricUnavailable")}</span></div>
          <div><strong>{overview.unknown}</strong><span>{t("mcp.metricUnknown")}</span></div>
          <div><strong>{overview.configuredClis}</strong><span>{t("mcp.metricClis")}</span></div>
        </div>
      </section>

      {error && <Banner variant="err">{error}</Banner>}

      {loading && (
        <div className="cd-page__grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="card" height={120} />
          ))}
        </div>
      )}

      {!loading && !hasAny && (
        <EmptyState
          art={ART_TOOLBOX}
          title={t("mcp.emptyTitle")}
          description={t("mcp.emptyHint")}
          action={{ label: t("mcp.add"), onClick: () => openAdd() }}
        />
      )}

      {!loading &&
        hasAny &&
        MCP_CLIS.map((cli) => {
          const list = grouped[cli];
          if (list.length === 0) return null;
          return (
            <section key={cli} className="cd-mcp__group" aria-labelledby={`mcp-group-${cli}`}>
              <div className="cd-mcp__group-head">
                <div>
                  <span className="cd-mcp__group-kicker">{t("mcp.targetCli")}</span>
                  <h2 id={`mcp-group-${cli}`} className="cd-mcp__group-title">{CLI_LABELS[cli]}</h2>
                </div>
                <Chip variant="neutral">{list.length}</Chip>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openAdd(cli)}
                >
                  + {t("mcp.addTo", { cli: CLI_LABELS[cli] })}
                </Button>
              </div>
              <div className="cd-page__grid">
                {list.map((s) => (
                  <ServerCard
                    key={`${s.cli}:${s.name}`}
                    server={s}
                    health={health[mcpHealthKey(s)]}
                    onEdit={() => openEdit(s)}
                    onRemove={() => setConfirmTarget(s)}
                  />
                ))}
              </div>
            </section>
          );
        })}

      <section className="cd-mcp__catalog" aria-labelledby="mcp-catalog-title">
        <div className="cd-mcp__catalog-head">
          <div>
            <span className="cd-mcp__group-kicker">{t("mcp.catalogEyebrow")}</span>
            <h2 id="mcp-catalog-title" className="cd-mcp__group-title">{t("mcp.catalogTitle")}</h2>
          </div>
          <Chip variant="admin">{t("mcp.catalogCount", { count: MCP_CATALOG.length })}</Chip>
        </div>
        <div className="cd-mcp__catalog-note">
          <strong>{t("mcp.catalogSafeTitle")}</strong>
          <span>{t("mcp.catalogHint")}</span>
          <span>{t("mcp.catalogBackupHint")}</span>
        </div>
        <div className="cd-page__grid">
          {MCP_CATALOG.map((entry) => (
            <Card key={entry.id} className="cd-mcp__catalog-card">
              <div className="cd-mcp__catalog-name">{entry.label}</div>
              <p className="cd-mcp__catalog-desc">{entry.description}</p>
              <code
                className="cd-mcp__catalog-cmd"
                tabIndex={0}
                aria-label={t("mcp.commandLabel", { name: entry.label })}
              >
                {entry.transport === "stdio"
                  ? `${entry.command} ${(entry.args ?? []).join(" ")}`.trim()
                  : entry.url}
              </code>
              <div className="cd-mcp__catalog-foot">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t("mcp.catalogAddLabel", { name: entry.label })}
                  onClick={() => openCatalog(entry)}
                >
                  {t("mcp.add")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <McpServerDialog
        open={dialogOpen}
        mode={dialogMode}
        initial={dialogInitial}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={confirmTarget !== null}
        variant="danger"
        title={t("mcp.removeTitle")}
        message={t("mcp.removeMessage", {
          name: confirmTarget?.name ?? "",
          cli: confirmTarget ? CLI_LABELS[confirmTarget.cli] : "",
        })}
        confirmLabel={t("common.delete")}
        onConfirm={() => void handleRemove()}
        onCancel={() => setConfirmTarget(null)}
      />
    </section>
  );
}

interface ServerCardProps {
  server: McpServer;
  health?: McpHealth;
  onEdit: () => void;
  onRemove: () => void;
}

function ServerCard({ server, health, onEdit, onRemove }: ServerCardProps) {
  const { t } = useTranslation();
  const transportVariant = server.transport === "http" ? "update" : "online";
  const healthTone = health ? (health.ok ? "online" : "missing") : "neutral";
  const healthText = health
    ? health.ok
      ? t("mcp.healthOk")
      : t("mcp.healthBad")
    : t("mcp.healthUnknown");

  return (
    <Card className="cd-mcp__card">
      <div className="cd-mcp__card-head">
        <div className="cd-mcp__card-identity">
          <span className="cd-mcp__status-dot" data-status={health ? (health.ok ? "ok" : "bad") : "unknown"} aria-hidden />
          <span className="cd-mcp__card-name">{server.name}</span>
        </div>
        <div className="cd-mcp__card-badges">
          <Chip variant={transportVariant}>{server.transport}</Chip>
          <Chip variant={healthTone} dot title={health?.detail}>
            {healthText}
          </Chip>
          {!server.enabled && <Chip variant="neutral">{t("mcp.disabled")}</Chip>}
        </div>
      </div>

      <code
        className="cd-mcp__card-cmd"
        tabIndex={0}
        aria-label={t("mcp.commandLabel", { name: server.name })}
      >
        {server.transport === "stdio"
          ? `${server.command ?? ""} ${(server.args ?? []).join(" ")}`.trim()
          : server.url}
      </code>

      {(server.env_keys.length > 0 || server.headers_keys.length > 0) && (
        <div className="cd-mcp__card-keys">
          {server.env_keys.map((k) => (
            <Chip key={`env:${k}`} variant="neutral">
              env:{k}
            </Chip>
          ))}
          {server.headers_keys.map((k) => (
            <Chip key={`hdr:${k}`} variant="neutral">
              hdr:{k}
            </Chip>
          ))}
        </div>
      )}

      <div className="cd-mcp__card-foot">
        <span className="cd-mcp__card-scope">{t("mcp.localConfig")}</span>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          {t("common.edit")}
        </Button>
        <Button size="sm" variant="danger" onClick={onRemove}>
          {t("common.delete")}
        </Button>
      </div>
    </Card>
  );
}
