import { createHash } from "node:crypto";

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(",")}}`;
}

export function sha256(value: unknown): string {
  const text =
    typeof value === "string" ? value : stableStringify(value);
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function sha256FileContent(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}
