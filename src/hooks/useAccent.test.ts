import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAccent } from "./useAccent";

describe("useAccent", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-accent");
    document.documentElement.style.cssText = "";
  });

  it("defaults to red", () => {
    const { result } = renderHook(() => useAccent());
    expect(result.current.accent).toBe("red");
  });

  it("persists accent choice", () => {
    const { result } = renderHook(() => useAccent());
    act(() => result.current.setAccent("blue"));
    expect(localStorage.getItem("ai-launcher:accent")).toBe("blue");
    expect(document.documentElement.getAttribute("data-accent")).toBe("blue");
  });

  it("sets custom hex and applies CSS vars", () => {
    const { result } = renderHook(() => useAccent());
    act(() => {
      result.current.setCustomHex("#ff00aa");
      result.current.setAccent("custom");
    });
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#ff00aa");
  });

  it("rejects invalid hex", () => {
    const { result } = renderHook(() => useAccent());
    act(() => result.current.setCustomHex("not-a-color"));
    expect(result.current.customHex).not.toBe("not-a-color");
  });
});
