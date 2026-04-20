import './Skeleton.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: number;
}

/**
 * Skeleton — placeholder com shimmer CSS.
 * Respeita prefers-reduced-motion (desliga a animação).
 */
export function Skeleton({ width = '100%', height = 16, radius = 4 }: SkeletonProps) {
  return (
    <span
      className="skel"
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

/**
 * SkeletonCliCard — placeholder para cards de CLI (altura ~140px).
 */
export function SkeletonCliCard() {
  return <div className="skel skel--cli-card" aria-hidden="true" role="presentation" />;
}

/**
 * SkeletonHistoryRow — placeholder para linhas do histórico (altura ~48px).
 */
export function SkeletonHistoryRow() {
  return <div className="skel skel--history-row" aria-hidden="true" role="presentation" />;
}

/**
 * SkeletonCostBar — placeholder para barras de custo (altura ~38px).
 */
export function SkeletonCostBar() {
  return <div className="skel skel--cost-bar" aria-hidden="true" role="presentation" />;
}
