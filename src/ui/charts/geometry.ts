// src/ui/charts/geometry.ts
// Pure SVG path math for the hand-rolled charts. Numbers are rounded to 2
// decimals to keep snapshots/paths stable across platforms.
export interface XY {
  x: number;
  y: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Scale values into an SVG coordinate space. y is inverted (0 = top). */
export function scalePoints(values: number[], width: number, height: number, pad = 4): XY[] {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  const innerH = height - pad * 2;
  if (values.length === 1) {
    const y = max > 0 ? pad : height - pad;
    return [{ x: round2(width / 2), y: round2(max > 0 ? y : height - pad) }];
  }
  const stepX = width / (values.length - 1);
  return values.map((v, i) => ({
    x: round2(i * stepX),
    y: round2(max > 0 ? pad + innerH * (1 - v / max) : height - pad),
  }));
}

export function buildLinePath(pts: XY[]): string {
  if (pts.length === 0) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

export function buildAreaPath(pts: XY[], height: number): string {
  if (pts.length === 0) return "";
  const line = buildLinePath(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${line} L ${last.x} ${height} L ${first.x} ${height} Z`;
}
