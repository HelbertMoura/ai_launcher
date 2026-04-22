import type { HTMLAttributes, ReactNode } from "react";
import "./Chip.css";

type ChipVariant =
  | "neutral"
  | "online"
  | "offline"
  | "missing"
  | "update"
  | "admin"
  | "warn";

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
  dot?: boolean;
  children: ReactNode;
}

export function Chip({
  variant = "neutral",
  dot = false,
  className,
  children,
  ...rest
}: ChipProps) {
  const cls = ["cd-chip", `cd-chip--${variant}`];
  if (className) cls.push(className);
  return (
    <span {...rest} className={cls.join(" ")}>
      {dot && <span className="cd-chip__dot" aria-hidden />}
      {children}
    </span>
  );
}
