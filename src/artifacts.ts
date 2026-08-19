import type { ExtractedArtifact } from "./types";

const PATTERNS: Array<[ExtractedArtifact["type"], RegExp]> = [
  ["email", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/gi],
  ["domain", /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi],
  ["ipv4", /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g],
  ["sha256", /\b[a-f0-9]{64}\b/gi],
  ["bitcoin", /\b(?:bc1[a-zA-HJ-NP-Z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g],
];

function normalizeArtifact(type: ExtractedArtifact["type"], raw: string): string {
  if (type === "email" || type === "domain" || type === "sha256") return raw.toLowerCase();
  return raw;
}

export function extractArtifacts(text: string): ExtractedArtifact[] {
  const seen = new Set<string>();
  const output: ExtractedArtifact[] = [];
  for (const [type, pattern] of PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const raw = match[0];
      if (!raw) continue;
      const value = normalizeArtifact(type, raw);
      if (type === "domain" && value.endsWith(".onion")) continue;
      const key = `${type}:${value}`;
      if (!seen.has(key)) {
        seen.add(key);
        output.push({ type, value });
      }
      if (output.length >= 500) return output;
    }
  }
  return output;
}
