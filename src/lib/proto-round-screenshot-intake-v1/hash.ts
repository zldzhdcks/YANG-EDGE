import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/** SHA-256 of raw bytes. Does not decode or parse the image. */
export function sha256RawBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function sha256FileBytes(absPath: string): Promise<string> {
  const buf = await readFile(absPath);
  return sha256RawBytes(buf);
}
