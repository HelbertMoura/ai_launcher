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
