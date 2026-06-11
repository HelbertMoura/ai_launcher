// src/ui/charts/BarList.tsx
import "./charts.css";

export interface BarListItem {
  /** null = aggregated/unknown bucket; caller provides the display fallback. */
  label: string | null;
  value: number;
  /** 0..1 share of the total — drives the bar width. */
  share: number;
}

interface BarListProps {
  items: BarListItem[];
  ariaLabel: string;
  formatValue: (v: number) => string;
  /** Display text for null labels (e.g. t("costs.otherBucket")). */
  fallbackLabel: string;
}

export function BarList({ items, ariaLabel, formatValue, fallbackLabel }: BarListProps) {
  return (
    <ul className="cd-barlist" aria-label={ariaLabel}>
      {items.map((item, i) => (
        <li key={`${item.label ?? "__other"}-${i}`} className="cd-barlist__row">
          <span className="cd-barlist__label">{item.label ?? fallbackLabel}</span>
          <span className="cd-barlist__track" aria-hidden="true">
            <span
              className="cd-barlist__bar"
              style={{ width: `${Math.max(2, Math.round(item.share * 100))}%` }}
            />
          </span>
          <span className="cd-barlist__value">{formatValue(item.value)}</span>
        </li>
      ))}
    </ul>
  );
}
