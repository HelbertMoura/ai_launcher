import { describe, it, expect } from "vitest";
import { toCsv, redactSensitiveJson, containsApiKey } from "./exportData";

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

describe("redactSensitiveJson", () => {
  it("redacts apiKey field", () => {
    const input = '{"apiKey": "sk-ant-secret123"}';
    expect(redactSensitiveJson(input)).toBe('{"apiKey": "****"}');
  });

  it("redacts auth_token field", () => {
    const input = '{"auth_token": "my-secret-token"}';
    expect(redactSensitiveJson(input)).toBe('{"auth_token": "****"}');
  });

  it("redacts secret field", () => {
    const input = '{"secret": "top-secret-value"}';
    expect(redactSensitiveJson(input)).toBe('{"secret": "****"}');
  });

  it("redacts password field", () => {
    const input = '{"password": "hunter2"}';
    expect(redactSensitiveJson(input)).toBe('{"password": "****"}');
  });

  it("redacts Key with capital K", () => {
    const input = '{"Key": "value123"}';
    expect(redactSensitiveJson(input)).toBe('{"Key": "****"}');
  });

  it("does not redact non-sensitive fields", () => {
    const input = '{"name": "Claude", "version": "1.0"}';
    expect(redactSensitiveJson(input)).toBe(input);
  });

  it("handles mixed content with nested objects", () => {
    const input = '{"apiKey": "sk-test", "name": "test", "token": "abc123"}';
    const result = redactSensitiveJson(input);
    expect(result).toContain('"apiKey": "****"');
    expect(result).toContain('"token": "****"');
    expect(result).toContain('"name": "test"');
  });

  it("handles empty string values", () => {
    const input = '{"apiKey": ""}';
    // Empty string should remain as empty string, not redacted
    expect(redactSensitiveJson(input)).toBe('{"apiKey": "****"}');
  });
});

describe("containsApiKey", () => {
  it("detects Anthropic API key pattern", () => {
    expect(containsApiKey('{"apiKey": "sk-ant-api03-validkeywithlotsofchars123"}')).toBe(true);
  });

  it("detects __secret__ marker", () => {
    expect(containsApiKey('{"apiKey": "__secret__"}')).toBe(true);
  });

  it("does not flag normal text", () => {
    expect(containsApiKey('{"name": "Claude", "version": "1"}')).toBe(false);
  });

  it("does not flag short random strings", () => {
    expect(containsApiKey("sk-123")).toBe(false);
  });
});
