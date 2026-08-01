/**
 * Ephemeral image processing helpers — no permanent image storage.
 * Temp paths are never returned to clients.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type EphemeralSession = {
  root: string;
  warnings: string[];
};

export async function createEphemeralOcrSession(): Promise<EphemeralSession> {
  const root = await mkdtemp(path.join(tmpdir(), "kbo-proto-ocr-"));
  return { root, warnings: [] };
}

export async function writeEphemeralImage(
  session: EphemeralSession,
  bytes: Uint8Array,
  ext: string,
): Promise<{ absPath: string; imageId: string }> {
  const imageId = `img-${randomUUID()}`;
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").slice(0, 5) || "bin";
  const absPath = path.join(session.root, `${imageId}.${safeExt}`);
  await writeFile(absPath, bytes);
  return { absPath, imageId };
}

export async function cleanupEphemeralSession(
  session: EphemeralSession,
): Promise<string[]> {
  const warnings: string[] = [];
  try {
    await rm(session.root, { recursive: true, force: true });
  } catch (e) {
    warnings.push(
      `TEMP_CLEANUP_FAILED: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  return warnings;
}
