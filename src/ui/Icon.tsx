import type { ComponentType } from "react";
import type { IconWeight } from "@phosphor-icons/react";

export interface IconProps {
  icon: ComponentType<{
    size?: number;
    weight?: IconWeight;
    color?: string;
    className?: string;
  }>;
  size?: number;
  weight?: IconWeight;
  color?: string;
  className?: string;
}

/**
 * Consistent icon wrapper for the Command Deck design system.
 *
 * Defaults: 16px, regular weight. Use `size={14}` inline with body text,
 * `size={20}` for standalone chrome, and `size={24}` for prominent action
 * buttons. Prefer the `cd-icon` utility class on the parent for baseline
 * alignment with adjacent text (inline-flex + gap).
 */
export function Icon({
  icon: IconComponent,
  size = 16,
  weight = "regular",
  color,
  className,
}: IconProps) {
  return (
    <IconComponent
      size={size}
      weight={weight}
      color={color}
      className={className}
    />
  );
}
