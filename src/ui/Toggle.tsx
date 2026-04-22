import type { ChangeEvent, ReactNode } from "react";
import "./Toggle.css";

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };
  return (
    <label className={`cd-toggle${disabled ? " cd-toggle--disabled" : ""}`}>
      <input type="checkbox" checked={checked} onChange={handle} disabled={disabled} />
      <span className="cd-toggle__track">
        <span className="cd-toggle__thumb" />
      </span>
      {label && <span className="cd-toggle__label">{label}</span>}
    </label>
  );
}
