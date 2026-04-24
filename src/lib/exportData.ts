export function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ];
  return lines.join("\n");
}

export function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Redact sensitive fields in a JSON string.
 * Replaces values of keys matching /KEY|TOKEN|SECRET|PASSWORD|AUTH/i with "****".
 * Does NOT log or expose the original values.
 */
export function redactSensitiveJson(jsonStr: string): string {
  return jsonStr.replace(
    /("(?:api_?[Kk]ey|auth_?[Tt]oken|[Kk]ey|[Tt]oken|[Ss]ecret|[Pp]assword|[Aa]uth)"\s*:\s*)"[^"]*"/g,
    '$1"****"',
  );
}

/**
 * Check if a string contains a pattern that looks like an API key
 * (common prefixes for Anthropic, OpenAI, etc.).
 */
export function containsApiKey(text: string): boolean {
  const patterns = [
    /sk-ant-api[a-z0-9-]{20,}/i,
    /sk-proj-[a-zA-Z0-9]{20,}/i,
    /sk-[a-zA-Z0-9]{40,}/i,
    /key-[a-zA-Z0-9]{20,}/i,
    /__secret__/,
  ];
  return patterns.some((p) => p.test(text));
}
