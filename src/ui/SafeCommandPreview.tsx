import { useState } from "react";
import type { CommandPreview, RiskLevel } from "../lib/commandPreview";
import "./SafeCommandPreview.css";

interface SafeCommandPreviewProps {
  preview: CommandPreview;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
}

const RISK_COLORS: Record<RiskLevel, string> = {
  safe: "cd-risk--safe",
  caution: "cd-risk--caution",
  dangerous: "cd-risk--dangerous",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  safe: "Safe",
  caution: "Caution",
  dangerous: "Dangerous",
};

export function SafeCommandPreview({
  preview,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
}: SafeCommandPreviewProps) {
  const { executable, args, cwd, env, riskLevel, riskReasons } = preview;
  const isDangerous = riskLevel === "dangerous";
  const [acknowledgedRisk, setAcknowledgedRisk] = useState(false);

  const canConfirm = isDangerous ? acknowledgedRisk : true;
  const commandLine = [executable, ...args].filter(Boolean).join(" ");

  return (
    <div className="cd-safe-preview">
      {/* Risk badge */}
      <div className="cd-safe-preview__header">
        <span className={`cd-risk-badge ${RISK_COLORS[riskLevel]}`}>
          {RISK_LABELS[riskLevel]}
        </span>
      </div>

      {/* Command line */}
      <pre className="cd-safe-preview__command">
        <code>{commandLine || "(no command)"}</code>
      </pre>

      {/* Working directory */}
      {cwd && (
        <div className="cd-safe-preview__detail">
          <span className="cd-safe-preview__detail-label">cwd:</span>{" "}
          <code className="cd-safe-preview__detail-value">{cwd}</code>
        </div>
      )}

      {/* Environment variables (redacted) */}
      {Object.keys(env).length > 0 && (
        <div className="cd-safe-preview__detail">
          <span className="cd-safe-preview__detail-label">env:</span>
          <div className="cd-safe-preview__env-list">
            {Object.entries(env).map(([key, value]) => (
              <code key={key} className="cd-safe-preview__env-entry">
                {key}={value}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Risk reasons */}
      {riskReasons.length > 0 && (
        <ul className="cd-safe-preview__reasons">
          {riskReasons.map((reason, i) => (
            <li key={i} className="cd-safe-preview__reason">
              {reason}
            </li>
          ))}
        </ul>
      )}

      {/* Dangerous confirmation checkbox */}
      {isDangerous && (
        <label className="cd-safe-preview__ack">
          <input
            type="checkbox"
            checked={acknowledgedRisk}
            onChange={(e) => setAcknowledgedRisk(e.target.checked)}
          />
          <span>I understand the risks and want to proceed</span>
        </label>
      )}

      {/* Actions */}
      <div className="cd-safe-preview__actions">
        <button
          type="button"
          className="cd-safe-preview__btn cd-safe-preview__btn--cancel"
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`cd-safe-preview__btn cd-safe-preview__btn--confirm ${
            !canConfirm ? "cd-safe-preview__btn--disabled" : ""
          }`}
          disabled={!canConfirm || loading}
          onClick={onConfirm}
        >
          {loading ? "Running..." : confirmLabel}
        </button>
      </div>
    </div>
  );
}
