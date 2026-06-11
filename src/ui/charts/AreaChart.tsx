// src/ui/charts/AreaChart.tsx
import { buildAreaPath, buildLinePath, scalePoints } from "./geometry";
import "./charts.css";

export interface AreaChartDatum {
  label: string;
  value: number;
}

interface AreaChartProps {
  data: AreaChartDatum[];
  /** Accessible description of the whole chart (required). */
  ariaLabel: string;
  height?: number;
  formatValue?: (v: number) => string;
}

const VIEW_W = 600;

export function AreaChart({ data, ariaLabel, height = 120, formatValue = String }: AreaChartProps) {
  const values = data.map((d) => d.value);
  const pts = scalePoints(values, VIEW_W, height);
  const first = data[0]?.label ?? "";
  const mid = data[Math.floor(data.length / 2)]?.label ?? "";
  const last = data[data.length - 1]?.label ?? "";

  return (
    <figure className="cd-chart" role="img" aria-label={ariaLabel}>
      <svg
        className="cd-chart__svg"
        viewBox={`0 0 ${VIEW_W} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path className="cd-chart__area" d={buildAreaPath(pts, height)} />
        <path className="cd-chart__line" d={buildLinePath(pts)} />
        {pts.map((p, i) => (
          <circle key={data[i].label} className="cd-chart__dot" cx={p.x} cy={p.y} r={3}>
            <title>{`${data[i].label}: ${formatValue(data[i].value)}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="cd-chart__axis" aria-hidden="true">
        <span>{first}</span>
        <span>{mid}</span>
        <span>{last}</span>
      </figcaption>
    </figure>
  );
}
