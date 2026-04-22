import type { ReactNode } from "react";
import "./Tooltip.css";

interface TooltipProps {
  content: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
}

export function Tooltip({ content, side = "top", children }: TooltipProps) {
  return (
    <span className="cd-tip" data-side={side}>
      {children}
      <span role="tooltip" className="cd-tip__content">
        {content}
      </span>
    </span>
  );
}
