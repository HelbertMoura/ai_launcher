// ==============================================================================
// AI Launcher Pro - Sparkline
// SVG inline, zero dependencies. Renderiza uma série curta de pontos como
// linha suavizada. Cor herda via currentColor por padrão.
// ==============================================================================

interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  stroke?: string;
}

export function Sparkline({
  points,
  width = 80,
  height = 24,
  stroke = 'currentColor',
}: SparklineProps) {
  if (points.length === 0) return null;
  const max = Math.max(...points, 0.01);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const stepX = width / Math.max(points.length - 1, 1);
  const d = points
    .map((p, i) => {
      const x = i * stepX;
      const y = height - ((p - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
