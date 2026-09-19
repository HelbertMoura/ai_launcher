import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { WorkspaceProfile } from "../../domain/types";

interface WorkspaceFormProps {
  initial: WorkspaceProfile;
  isNew: boolean;
  onSave: (profile: WorkspaceProfile) => void;
  onCancel: () => void;
}

export function WorkspaceForm({ initial, isNew, onSave, onCancel }: WorkspaceFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<WorkspaceProfile>({ ...initial });
  const [envKey, setEnvKey] = useState("");
  const [envVal, setEnvVal] = useState("");

  const setField = <K extends keyof WorkspaceProfile>(key: K, value: WorkspaceProfile[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddEnv = () => {
    const key = envKey.trim();
    if (!key) return;
    setForm((prev) => ({
      ...prev,
      envVars: { ...prev.envVars, [key]: envVal },
    }));
    setEnvKey("");
    setEnvVal("");
  };

  const handleRemoveEnv = (key: string) => {
    setForm((prev) => {
      const { [key]: _removed, ...rest } = prev.envVars;
      return { ...prev, envVars: rest };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.directory.trim()) return;
    onSave({
      ...form,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <section className="cd-ws-form">
      <header className="cd-ws-form__head">
        <h2 className="cd-ws-form__title">
          {isNew ? t("workspace.newTitle") : t("workspace.editTitle")}
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
          <span className="cd-ws-form__label">{t("workspace.directoryLabel")}</span>
          <input
            className="cd-ws-form__input"
            value={form.directory}
            onChange={(e) => setField("directory", e.target.value)}
            required
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

        <fieldset className="cd-ws-form__env">
          <legend className="cd-ws-form__label">{t("workspace.envVarsLabel")}</legend>
          <div className="cd-ws-form__env-row">
            <input
              className="cd-ws-form__input cd-ws-form__input--sm"
              value={envKey}
              onChange={(e) => setEnvKey(e.target.value)}
              placeholder="KEY"
            />
            <input
              className="cd-ws-form__input cd-ws-form__input--sm"
              value={envVal}
              onChange={(e) => setEnvVal(e.target.value)}
              placeholder="value"
            />
            <button type="button" className="cd-ws-form__env-add" onClick={handleAddEnv}>
              {t("common.add")}
            </button>
          </div>
          {Object.entries(form.envVars).map(([key, val]) => (
            <div key={key} className="cd-ws-form__env-entry">
              <span className="cd-ws-form__env-key">{key}</span>
              <span className="cd-ws-form__env-val">{val}</span>
              <button
                type="button"
                className="cd-ws-form__env-remove"
                onClick={() => handleRemoveEnv(key)}
              >
                {t("common.remove")}
              </button>
            </div>
          ))}
        </fieldset>

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
