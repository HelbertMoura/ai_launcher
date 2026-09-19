import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AgentProfile } from "../../domain/types";
import { getRunbooks } from "./runbookStore";

interface AgentProfileFormProps {
  initial: AgentProfile;
  isNew: boolean;
  onSave: (profile: AgentProfile) => void;
  onCancel: () => void;
}

export function AgentProfileForm({ initial, isNew, onSave, onCancel }: AgentProfileFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<AgentProfile>({ ...initial });
  const runbooks = useMemo(() => getRunbooks(), []);

  const setField = <K extends keyof AgentProfile>(key: K, value: AgentProfile[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({
      ...form,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <section className="cd-ws-form">
      <header className="cd-ws-form__head">
        <h2 className="cd-ws-form__title">
          {isNew ? t("workspace.agentNewTitle") : t("workspace.agentEditTitle")}
        </h2>
      </header>

      <form className="cd-ws-form__body" onSubmit={handleSubmit}>
        <label className="cd-ws-form__field">
          <span className="cd-ws-form__label">{t("workspace.nameLabel")}</span>
          <input
            className="cd-ws-form__input"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            required
          />
        </label>

        <label className="cd-ws-form__field">
          <span className="cd-ws-form__label">{t("workspace.descriptionLabel")}</span>
          <input
            className="cd-ws-form__input"
            value={form.description ?? ""}
            onChange={(e) => setField("description", e.target.value || undefined)}
          />
        </label>

        <label className="cd-ws-form__field">
          <span className="cd-ws-form__label">{t("workspace.agentCliLabel")}</span>
          <input
            className="cd-ws-form__input"
            value={form.cliKey ?? ""}
            onChange={(e) => setField("cliKey", e.target.value || undefined)}
            placeholder="claude"
          />
        </label>

        <label className="cd-ws-form__field">
          <span className="cd-ws-form__label">{t("workspace.providerLabel")}</span>
          <input
            className="cd-ws-form__input"
            value={form.providerKey ?? ""}
            onChange={(e) => setField("providerKey", e.target.value || undefined)}
            placeholder={t("workspace.providerPlaceholder")}
          />
        </label>

        <label className="cd-ws-form__field">
          <span className="cd-ws-form__label">{t("workspace.agentArgsLabel")}</span>
          <input
            className="cd-ws-form__input"
            value={form.args ?? ""}
            onChange={(e) => setField("args", e.target.value || undefined)}
            placeholder="--model gpt-5"
          />
        </label>

        <label className="cd-ws-form__field">
          <span className="cd-ws-form__label">{t("workspace.agentRunbookLabel")}</span>
          <select
            className="cd-ws-form__input"
            value={form.runbookId ?? ""}
            onChange={(e) => setField("runbookId", e.target.value || undefined)}
          >
            <option value="">{t("workspace.agentNoRunbook")}</option>
            {runbooks.map((runbook) => (
              <option key={runbook.id} value={runbook.id}>
                {runbook.name}
              </option>
            ))}
          </select>
        </label>

        <label className="cd-ws-form__field">
          <span className="cd-ws-form__label">{t("workspace.tagsLabel")}</span>
          <input
            className="cd-ws-form__input"
            value={form.tags.join(", ")}
            onChange={(e) =>
              setField(
                "tags",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            placeholder={t("workspace.tagsPlaceholder")}
          />
        </label>

        <div className="cd-ws-form__foot">
          <button type="submit" className="cd-ws-form__save">
            {t("common.save")}
          </button>
          <button type="button" className="cd-ws-form__cancel" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </section>
  );
}
