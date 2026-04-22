import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.css";

type Variant = "primary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const cls = ["cd-btn", `cd-btn--${variant}`, `cd-btn--${size}`];
  if (className) cls.push(className);
  return (
    <button
      {...rest}
      className={cls.join(" ")}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
    >
      {icon && <span className="cd-btn__icon" aria-hidden="true">{icon}</span>}
      <span className="cd-btn__label">{children}</span>
    </button>
  );
}
