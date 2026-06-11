// src/ui/charts/geometry.test.ts
import { describe, expect, it } from "vitest";
import { buildAreaPath, buildLinePath, scalePoints } from "./geometry";

describe("scalePoints", () => {
  it("maps values to x evenly and y inverted (max at top)", () => {
    const pts = scalePoints([0, 5, 10], 100, 50, 0);
    expect(pts[0]).toEqual({ x: 0, y: 50 });
    expect(pts[2]).toEqual({ x: 100, y: 0 });
    expect(pts[1].y).toBe(25);
  });

  it("flat-lines at the bottom when all values are zero", () => {
    const pts = scalePoints([0, 0], 100, 50, 0);
    expect(pts.every((p) => p.y === 50)).toBe(true);
  });

  it("handles a single point (centered x)", () => {
    const pts = scalePoints([3], 100, 50, 0);
    expect(pts).toHaveLength(1);
    expect(pts[0].x).toBe(50);
  });
});

describe("paths", () => {
  it("buildLinePath produces M..L.. syntax", () => {
    const d = buildLinePath([{ x: 0, y: 10 }, { x: 5, y: 2 }]);
    expect(d).toBe("M 0 10 L 5 2");
  });

  it("buildAreaPath closes to the baseline", () => {
    const d = buildAreaPath([{ x: 0, y: 10 }, { x: 5, y: 2 }], 50);
    expect(d).toBe("M 0 10 L 5 2 L 5 50 L 0 50 Z");
  });

  it("returns empty string for no points", () => {
    expect(buildLinePath([])).toBe("");
    expect(buildAreaPath([], 50)).toBe("");
  });
});
