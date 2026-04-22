import "./Skeleton.css";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  variant?: "line" | "card";
}

export function Skeleton({ width = "100%", height = 14, variant = "line" }: SkeletonProps) {
  return (
    <div
      className={`cd-skel cd-skel--${variant}`}
      style={{ width, height }}
      aria-busy="true"
    />
  );
}
