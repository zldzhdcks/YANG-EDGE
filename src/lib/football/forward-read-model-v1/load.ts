import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_FORWARD_EVAL_REL } from "./constants";
import { fail, FORWARD_READ_MODEL_ERROR } from "./errors";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function resolveEvalPath(rootDir: string, evalRel?: string): string {
  return path.join(rootDir, evalRel ?? DEFAULT_FORWARD_EVAL_REL);
}

export function readCommittedEvalDocument(evalPath: string): unknown {
  let text: string;
  try {
    text = readFileSync(evalPath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      fail(
        FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_MISSING,
        evalPath.replace(/\\/g, "/"),
      );
    }
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_MISSING,
      err instanceof Error ? err.message : String(err),
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
      "eval JSON is not parseable",
    );
  }
}

export function unwrapEvalPayload(document: unknown): Record<string, unknown> {
  if (!isRecord(document)) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
      "eval root must be an object",
    );
  }
  if ("payload" in document) {
    if (!isRecord(document.payload)) {
      fail(
        FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
        "eval payload must be an object",
      );
    }
    if (typeof document.sha256 === "string" && document.sha256.length > 0) {
      const actual = sha256Canonical(document.payload);
      if (actual !== document.sha256) {
        fail(
          FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
          "eval envelope sha256 mismatch",
        );
      }
    }
    return document.payload;
  }
  return document;
}
