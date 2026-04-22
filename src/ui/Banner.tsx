import type { ReactNode } from "react";
import "./Banner.css";

interface BannerProps {
  variant?: "info" | "warn" | "err" | "admin";
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}

export function Banner({ variant = "info", icon, children, actions }: BannerProps) {
  return (
    <div className={`cd-banner cd-banner--${variant}`}>
      {icon && <span className="cd-banner__icon">{icon}</span>}
      <span className="cd-banner__content">{children}</span>
      {actions && <span className="cd-banner__actions">{actions}</span>}
    </div>
  );
}
