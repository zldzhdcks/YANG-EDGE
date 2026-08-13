/**
 * Optional research-artifact JSON reader.
 * null ONLY for a genuinely missing file (ENOENT).
 * Corrupt JSON / read failures / non-object roots fail loudly.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { asRecord } from "@/lib/mlb/mlb-review-utils";

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err != null &&
    "code" in err &&
    (err as NodeJS.ErrnoException).code === "ENOENT"
  );
}

export async function readOptionalJsonObject(
  cwd: string,
  rel: string,
): Promise<Record<string, unknown> | null> {
  const abs = path.join(cwd, rel);
  let raw: string;
  try {
    raw = await readFile(abs, "utf8");
  } catch (err) {
    if (isEnoent(err)) return null;
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`ARTIFACT_READ_FAILED: ${rel}: ${msg}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`ARTIFACT_JSON_INVALID: ${rel}: ${msg}`);
  }

  const rec = asRecord(parsed);
  if (!rec) {
    throw new Error(`ARTIFACT_ROOT_INVALID: ${rel}: JSON root must be an object`);
  }
  return rec;
}
