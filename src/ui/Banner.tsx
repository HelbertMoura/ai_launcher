import type { ReactNode } from "react";
import "./Banner.css";

type BannerVariant = "info" | "warn" | "err" | "admin";

interface BannerProps {
  variant?: BannerVariant;
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}

const ROLE: Record<BannerVariant, "status" | "alert"> = {
  info: "status",
  warn: "alert",
  err: "alert",
  admin: "status",
};

export function Banner({ variant = "info", icon, children, actions }: BannerProps) {
  return (
    <div role={ROLE[variant]} className={`cd-banner cd-banner--${variant}`}>
      {icon && <span className="cd-banner__icon" aria-hidden="true">{icon}</span>}
      <span className="cd-banner__content">{children}</span>
      {actions && <span className="cd-banner__actions">{actions}</span>}
    </div>
  );
}
