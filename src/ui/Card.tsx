import type { HTMLAttributes, ReactNode } from "react";
import "./Card.css";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  active?: boolean;
  children: ReactNode;
}

export function Card({
  interactive = false,
  active = false,
  className,
  children,
  ...rest
}: CardProps) {
  const cls = ["cd-card"];
  if (interactive) cls.push("cd-card--interactive");
  if (active) cls.push("cd-card--active");
  if (className) cls.push(className);
  return (
    <div {...rest} className={cls.join(" ")}>
      {children}
    </div>
  );
}
