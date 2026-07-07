import { Button } from "./Button";
import "./EmptyState.css";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  art: string;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  actions?: EmptyStateAction[];
}

/**
 * ASCII-art empty state for the Command Deck design system.
 * Centered vertical stack: ascii art (pre, monospace, dim) → title → description → optional action.
 */
export function EmptyState({ art, title, description, action, actions }: EmptyStateProps) {
  const visibleActions = actions ?? (action ? [action] : []);

  return (
    <div className="cd-empty" role="status" aria-live="polite">
      <pre className="cd-empty__art" aria-hidden="true">{art}</pre>
      <h3 className="cd-empty__title">{title}</h3>
      {description && <p className="cd-empty__desc">{description}</p>}
      {visibleActions.length > 0 && (
        <div className="cd-empty__actions">
          {visibleActions.map((item, index) => (
            <Button
              key={item.label}
              size="sm"
              variant={index === 0 ? "primary" : "ghost"}
              onClick={item.onClick}
            >
              {item.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

// Preset ASCII art templates. Width kept under ~30 chars for narrow containers.
export const ART_TERMINAL = `┌──────────────┐
│  >_          │
│              │
│  █           │
└──────────────┘`;

export const ART_TOOLBOX = `┌────┬────┬────┐
│    │    │    │
├────┼────┼────┤
│    │    │    │
└────┴────┴────┘`;

export const ART_CLOCK = `    ╱│╲
   ╱ │ ╲
  ●──┼──●
   ╲ │ ╱
    ╲│╱`;

export const ART_CHART = `        ▇
    ▅   █
  ▃ █ ▆ █
▁ █ █ █ █`;

export const ART_CHECK = `  ┌───────┐
  │   ✓   │
  └───────┘`;
