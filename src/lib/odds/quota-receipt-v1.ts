/**
 * The Odds API quota receipt v1 — usage metadata only.
 *
 * No API key, no response body, no bookmaker payload.
 * Remaining credits are operational state, never synthesized from plan size.
 */
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const ODDS_QUOTA_RECEIPT_VERSION =
  "the-odds-api-quota-receipt-v1" as const;

export const ODDS_QUOTA_RECEIPT_REL =
  "data/ops/provider/the-odds-api/quota-receipt-v1.json";

export const ODDS_QUOTA_RECEIPT_NOT_UPDATED =
  "QUOTA_RECEIPT_NOT_UPDATED" as const;

export const ODDS_QUOTA_RESET_CYCLE = "MONTHLY_DAY_1_00_UTC" as const;

export const ODDS_QUOTA_PROVIDER = "THE_ODDS_API" as const;

/**
 * Operator-confirmed plan identity (2026-09-19).
 * Remaining credits are NOT stored here.
 */
export const ODDS_OPERATOR_PLAN_EVIDENCE = {
  planName: "Free",
  planConfirmed: true,
  resetCycle: ODDS_QUOTA_RESET_CYCLE,
  evidenceDate: "2026-09-19",
} as const;

export type OddsQuotaReceiptSource =
  | "RESPONSE_HEADERS"
  | "OPERATOR_BOOTSTRAP";

export type OddsQuotaReceipt = {
  version: typeof ODDS_QUOTA_RECEIPT_VERSION;
  provider: typeof ODDS_QUOTA_PROVIDER;
  planName: string;
  planConfirmed: boolean;
  observedAt: string;
  requestsRemaining: number;
  requestsUsed: number | null;
  requestsLast: number | null;
  source: OddsQuotaReceiptSource;
  resetCycle: typeof ODDS_QUOTA_RESET_CYCLE;
  resetAtUtc: string | null;
  evidenceDate: string;
};

export type OddsQuotaReadStatus =
  | "QUOTA_AVAILABLE"
  | "QUOTA_ZERO"
  | "QUOTA_UNKNOWN"
  | "QUOTA_STALE"
  | "QUOTA_RECEIPT_MISSING";

export type OddsQuotaSource = "CLI" | "RECEIPT" | "NONE";

export type OddsQuotaHeaderParseResult =
  | {
      ok: true;
      remaining: number;
      used: number;
      last: number;
    }
  | {
      ok: false;
      reason: typeof ODDS_QUOTA_RECEIPT_NOT_UPDATED;
      field?: "remaining" | "used" | "last" | "missing";
    };

export type OddsQuotaReceiptWriteResult =
  | { updated: true; receipt: OddsQuotaReceipt; path: string }
  | {
      updated: false;
      reason: typeof ODDS_QUOTA_RECEIPT_NOT_UPDATED;
      path: string;
    };

export type OddsQuotaReadResult = {
  status: OddsQuotaReadStatus;
  remaining: number | null;
  receipt: OddsQuotaReceipt | null;
  allowsSpawn: boolean;
  path: string;
};

function nonNegativeInteger(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!/^(0|[1-9]\d*)$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0 || !Number.isFinite(n)) return null;
  return n;
}

export function oddsQuotaReceiptPath(cwd = process.cwd()): string {
  return path.join(cwd, ODDS_QUOTA_RECEIPT_REL);
}

/** Current cycle start: 1st of the UTC month at 00:00:00.000Z. */
export function currentOddsQuotaResetAtUtc(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}

/** Next cycle start (UTC). */
export function nextOddsQuotaResetAtUtc(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
}

export function parseOddsQuotaReceiptHeaders(headers: {
  get(name: string): string | null | undefined;
}): OddsQuotaHeaderParseResult {
  const remainingRaw = headers.get("x-requests-remaining");
  const usedRaw = headers.get("x-requests-used");
  const lastRaw = headers.get("x-requests-last");
  if (remainingRaw == null) {
    return { ok: false, reason: ODDS_QUOTA_RECEIPT_NOT_UPDATED, field: "missing" };
  }
  if (usedRaw == null) {
    return { ok: false, reason: ODDS_QUOTA_RECEIPT_NOT_UPDATED, field: "used" };
  }
  if (lastRaw == null) {
    return { ok: false, reason: ODDS_QUOTA_RECEIPT_NOT_UPDATED, field: "last" };
  }
  const remaining = nonNegativeInteger(remainingRaw);
  if (remaining == null) {
    return {
      ok: false,
      reason: ODDS_QUOTA_RECEIPT_NOT_UPDATED,
      field: "remaining",
    };
  }
  const used = nonNegativeInteger(usedRaw);
  if (used == null) {
    return { ok: false, reason: ODDS_QUOTA_RECEIPT_NOT_UPDATED, field: "used" };
  }
  const last = nonNegativeInteger(lastRaw);
  if (last == null) {
    return { ok: false, reason: ODDS_QUOTA_RECEIPT_NOT_UPDATED, field: "last" };
  }
  return { ok: true, remaining, used, last };
}

export function receiptContainsForbiddenSecrets(value: unknown): boolean {
  const blob = JSON.stringify(value ?? "");
  return (
    /ODDS_API_KEY/i.test(blob) ||
    /"apiKey"\s*:/i.test(blob) ||
    /"api_key"\s*:/i.test(blob)
  );
}

export async function writeJsonAtomic(
  filePath: string,
  value: unknown,
): Promise<void> {
  const tmp = `${filePath}.${process.pid}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    await rename(tmp, filePath);
  } catch {
    await unlink(filePath).catch(() => undefined);
    await rename(tmp, filePath);
  }
}

function isNonNegativeIntegerValue(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && Number.isFinite(v);
}

function isNullableNonNegativeIntegerValue(v: unknown): v is number | null {
  return v === null || isNonNegativeIntegerValue(v);
}

function isOddsQuotaReceipt(v: unknown): v is OddsQuotaReceipt {
  if (typeof v !== "object" || v == null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  if (
    o.version !== ODDS_QUOTA_RECEIPT_VERSION ||
    o.provider !== ODDS_QUOTA_PROVIDER ||
    typeof o.planName !== "string" ||
    o.planName.trim().length === 0 ||
    typeof o.planConfirmed !== "boolean" ||
    typeof o.observedAt !== "string" ||
    !Number.isFinite(Date.parse(o.observedAt)) ||
    !isNonNegativeIntegerValue(o.requestsRemaining) ||
    !isNullableNonNegativeIntegerValue(o.requestsUsed) ||
    !isNullableNonNegativeIntegerValue(o.requestsLast) ||
    (o.source !== "RESPONSE_HEADERS" && o.source !== "OPERATOR_BOOTSTRAP") ||
    o.resetCycle !== ODDS_QUOTA_RESET_CYCLE ||
    typeof o.evidenceDate !== "string" ||
    receiptContainsForbiddenSecrets(v)
  ) {
    return false;
  }
  if (o.source === "RESPONSE_HEADERS") {
    return (
      isNonNegativeIntegerValue(o.requestsUsed) &&
      isNonNegativeIntegerValue(o.requestsLast)
    );
  }
  return true;
}

function bootstrapOptionalCount(
  value: number | null | undefined,
  label: "USED" | "LAST",
): number | null {
  if (value === undefined || value === null) return null;
  const parsed = nonNegativeInteger(String(value));
  if (parsed == null) throw new Error(`BOOTSTRAP_${label}_INVALID`);
  return parsed;
}

export function buildOddsQuotaBootstrapReceipt(input: {
  planName: string;
  requestsRemaining: number;
  requestsUsed?: number | null;
  requestsLast?: number | null;
  evidenceDate: string;
  observedAt?: string;
  planConfirmed?: boolean;
}): OddsQuotaReceipt {
  const remaining = nonNegativeInteger(String(input.requestsRemaining));
  if (remaining == null) {
    throw new Error("BOOTSTRAP_REMAINING_INVALID");
  }
  const used = bootstrapOptionalCount(input.requestsUsed, "USED");
  const last = bootstrapOptionalCount(input.requestsLast, "LAST");
  const observedAt = input.observedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(observedAt))) {
    throw new Error("BOOTSTRAP_OBSERVED_AT_INVALID");
  }
  const observed = new Date(observedAt);
  return {
    version: ODDS_QUOTA_RECEIPT_VERSION,
    provider: ODDS_QUOTA_PROVIDER,
    planName: input.planName.trim(),
    planConfirmed: input.planConfirmed !== false,
    observedAt,
    requestsRemaining: remaining,
    requestsUsed: used,
    requestsLast: last,
    source: "OPERATOR_BOOTSTRAP",
    resetCycle: ODDS_QUOTA_RESET_CYCLE,
    resetAtUtc: nextOddsQuotaResetAtUtc(observed).toISOString(),
    evidenceDate: input.evidenceDate,
  };
}

export async function writeOddsQuotaReceipt(
  receipt: OddsQuotaReceipt,
  cwd = process.cwd(),
): Promise<string> {
  if (receiptContainsForbiddenSecrets(receipt)) {
    throw new Error("QUOTA_RECEIPT_FORBIDDEN_SECRET_FIELD");
  }
  if (!isOddsQuotaReceipt(receipt)) {
    throw new Error("QUOTA_RECEIPT_INVALID");
  }
  const filePath = oddsQuotaReceiptPath(cwd);
  await writeJsonAtomic(filePath, receipt);
  return filePath;
}

export async function writeOddsQuotaReceiptFromHeaders(input: {
  headers: { get(name: string): string | null | undefined };
  cwd?: string;
  now?: Date;
  planName?: string;
  planConfirmed?: boolean;
  evidenceDate?: string;
}): Promise<OddsQuotaReceiptWriteResult> {
  const cwd = input.cwd ?? process.cwd();
  const filePath = oddsQuotaReceiptPath(cwd);
  const parsed = parseOddsQuotaReceiptHeaders(input.headers);
  if (!parsed.ok) {
    return {
      updated: false,
      reason: ODDS_QUOTA_RECEIPT_NOT_UPDATED,
      path: filePath,
    };
  }
  const existing = await readOddsQuotaReceiptFile(cwd);
  const now = input.now ?? new Date();
  const observedAt = now.toISOString();
  const receipt: OddsQuotaReceipt = {
    version: ODDS_QUOTA_RECEIPT_VERSION,
    provider: ODDS_QUOTA_PROVIDER,
    planName:
      input.planName?.trim() ||
      existing?.planName ||
      ODDS_OPERATOR_PLAN_EVIDENCE.planName,
    planConfirmed:
      input.planConfirmed ??
      existing?.planConfirmed ??
      ODDS_OPERATOR_PLAN_EVIDENCE.planConfirmed,
    observedAt,
    requestsRemaining: parsed.remaining,
    requestsUsed: parsed.used,
    requestsLast: parsed.last,
    source: "RESPONSE_HEADERS",
    resetCycle: ODDS_QUOTA_RESET_CYCLE,
    resetAtUtc: nextOddsQuotaResetAtUtc(now).toISOString(),
    evidenceDate:
      input.evidenceDate ||
      existing?.evidenceDate ||
      ODDS_OPERATOR_PLAN_EVIDENCE.evidenceDate,
  };
  await writeOddsQuotaReceipt(receipt, cwd);
  return { updated: true, receipt, path: filePath };
}

async function readOddsQuotaReceiptFile(
  cwd: string,
): Promise<OddsQuotaReceipt | null> {
  try {
    const raw = await readFile(oddsQuotaReceiptPath(cwd), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return isOddsQuotaReceipt(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function readOddsQuotaReceipt(input?: {
  cwd?: string;
  now?: Date;
}): Promise<OddsQuotaReadResult> {
  const cwd = input?.cwd ?? process.cwd();
  const now = input?.now ?? new Date();
  const filePath = oddsQuotaReceiptPath(cwd);
  let rawText: string;
  try {
    rawText = await readFile(filePath, "utf8");
  } catch {
    return {
      status: "QUOTA_RECEIPT_MISSING",
      remaining: null,
      receipt: null,
      allowsSpawn: false,
      path: filePath,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch {
    return {
      status: "QUOTA_UNKNOWN",
      remaining: null,
      receipt: null,
      allowsSpawn: false,
      path: filePath,
    };
  }
  if (!isOddsQuotaReceipt(parsed)) {
    return {
      status: "QUOTA_UNKNOWN",
      remaining: null,
      receipt: null,
      allowsSpawn: false,
      path: filePath,
    };
  }
  const observedMs = Date.parse(parsed.observedAt);
  const resetMs = currentOddsQuotaResetAtUtc(now).getTime();
  if (observedMs < resetMs) {
    return {
      status: "QUOTA_STALE",
      remaining: null,
      receipt: parsed,
      allowsSpawn: false,
      path: filePath,
    };
  }
  if (parsed.requestsRemaining === 0) {
    return {
      status: "QUOTA_ZERO",
      remaining: 0,
      receipt: parsed,
      allowsSpawn: false,
      path: filePath,
    };
  }
  return {
    status: "QUOTA_AVAILABLE",
    remaining: parsed.requestsRemaining,
    receipt: parsed,
    allowsSpawn: true,
    path: filePath,
  };
}

/**
 * Unattended quota SoT: CLI override → valid receipt → NONE.
 * Unknown never means unlimited.
 */
export async function resolveOddsQuotaInput(input: {
  cliQuotaRemaining?: number | null;
  unattended: boolean;
  cwd?: string;
  now?: Date;
}): Promise<{
  remaining: number | null;
  source: OddsQuotaSource;
  readStatus: OddsQuotaReadStatus | null;
  allowsSpawn: boolean;
}> {
  if (input.cliQuotaRemaining != null) {
    return {
      remaining: input.cliQuotaRemaining,
      source: "CLI",
      readStatus: null,
      allowsSpawn: input.cliQuotaRemaining > 0,
    };
  }
  if (!input.unattended) {
    return {
      remaining: null,
      source: "NONE",
      readStatus: null,
      allowsSpawn: false,
    };
  }
  const read = await readOddsQuotaReceipt({
    cwd: input.cwd,
    now: input.now,
  });
  if (read.status === "QUOTA_AVAILABLE") {
    return {
      remaining: read.remaining,
      source: "RECEIPT",
      readStatus: read.status,
      allowsSpawn: true,
    };
  }
  if (read.status === "QUOTA_ZERO") {
    return {
      remaining: 0,
      source: "RECEIPT",
      readStatus: read.status,
      allowsSpawn: false,
    };
  }
  return {
    remaining: null,
    source: "NONE",
    readStatus: read.status,
    allowsSpawn: false,
  };
}
