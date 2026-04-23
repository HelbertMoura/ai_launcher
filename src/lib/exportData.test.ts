import { describe, it, expect } from "vitest";
import { toCsv } from "./exportData";

describe("toCsv", () => {
  it("empty rows returns empty string", () => {
    expect(toCsv([])).toBe("");
  });

  it("single row", () => {
    const csv = toCsv([{ a: 1, b: "hi" }]);
    expect(csv).toBe("a,b\n1,hi");
  });

  it("escapes commas", () => {
    const csv = toCsv([{ name: "a,b" }]);
    expect(csv).toBe('name\n"a,b"');
  });

  it("escapes quotes by doubling", () => {
    const csv = toCsv([{ name: 'he said "hi"' }]);
    expect(csv).toBe('name\n"he said ""hi"""');
  });

  it("escapes newlines", () => {
    const csv = toCsv([{ body: "line1\nline2" }]);
    expect(csv).toBe('body\n"line1\nline2"');
  });

  it("handles null and undefined as empty", () => {
    const csv = toCsv([{ a: null, b: undefined, c: 0 }]);
    expect(csv).toBe("a,b,c\n,,0");
  });
});
