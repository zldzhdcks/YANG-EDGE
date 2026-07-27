/**
 * Research Framework v1 — 공통 Hash 인터페이스.
 * 동일 입력 → 동일 hash. 타임스탬프·네트워크 메타는 payload에서 제외할 것.
 */
import { createHash } from "node:crypto";

export const RESEARCH_FRAMEWORK_VERSION = "research-framework-v1";

export type HashableResearchPayload = unknown;

/** 결정적 JSON 직렬화 (키 정렬) */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortKeys(obj[key]);
  }
  return out;
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export type ResearchHashInput = {
  frameworkVersion: string;
  datasetId: string;
  schemaVersion: string;
  builderVersion: string;
  /** 재현 대상 본문 — generatedAt 등 변동 필드 제외 */
  body: HashableResearchPayload;
};

export function buildResearchResultHash(input: ResearchHashInput): string {
  return sha256Hex(
    stableStringify({
      frameworkVersion: input.frameworkVersion,
      datasetId: input.datasetId,
      schemaVersion: input.schemaVersion,
      builderVersion: input.builderVersion,
      body: input.body,
    }),
  );
}

export function buildResearchInputHash(parts: unknown[]): string {
  return sha256Hex(stableStringify(parts));
}

export type ResearchHashVerifier = {
  expected: string;
  actual: string;
  matched: boolean;
};

export function verifyResearchHash(
  expected: string,
  actual: string,
): ResearchHashVerifier {
  return {
    expected,
    actual,
    matched: expected === actual && expected.length > 0,
  };
}
