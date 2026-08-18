/**
 * Raw research-artifact inventory. Read-only.
 * Weekly/Monthly numbers come from these artifacts, never from PPT or prior reports.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { sha256FileContent } from "@/lib/mlb/mlb-review-hash";
import { REPORTING_ZERO_WRITES, type ReportingWriteAudit } from "./leakage";
import {
  isNonSourceKind,
  type ArtifactKind,
} from "./provenance";
import {
  CANONICAL_REPORT_DIR,
  FORBIDDEN_PRESENTATION_DIR,
  type SourceArtifactRef,
  type SportId,
} from "./types";

const DATE_RE = /(\d{4}-\d{2}-\d{2})/;

export type InventoriedArtifact = SourceArtifactRef & {
  dateKst: string | null;
  schemaVersion: string | null;
  predictionClass: string | null;
  model: string | null;
  engine: string | null;
  recommendation: string | null;
  officialPickCount: number | null;
  joinKeys: Record<string, string | number | null>;
  excludedAsSource: boolean;
};

export type RawArtifactInventory = {
  periodStart: string;
  periodEnd: string;
  artifacts: InventoriedArtifact[];
  sourceArtifacts: SourceArtifactRef[];
  excludedNonSources: InventoriedArtifact[];
  writeAudit: ReportingWriteAudit;
};

const SPORT_DIRS: Array<{ sport: SportId; rel: string }> = [
  { sport: "MLB", rel: "data/research/mlb" },
  { sport: "FOOTBALL", rel: "data/research/football" },
  { sport: "KBO", rel: "data/research/kbo" },
  { sport: "NPB", rel: "data/research/npb" },
];

const EXTRA_DIRS: Array<{ sport: SportId; rel: string }> = [
  { sport: "MLB", rel: "data/predictions/mlb" },
  { sport: "MLB", rel: "data/recommendations/mlb" },
  { sport: "MLB", rel: "data/audits" },
];

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function classifyArtifactKind(input: {
  rel: string;
  schemaVersion: string | null;
}): ArtifactKind {
  const rel = input.rel.replace(/\\/g, "/");
  if (rel.startsWith(`${FORBIDDEN_PRESENTATION_DIR}/`) || rel.endsWith(".pptx")) {
    return "PRESENTATION_NON_SOURCE";
  }
  if (rel.includes("/reporting/") && rel.includes("weekly")) {
    return "WEEKLY_REPORT_NON_SOURCE";
  }
  if (rel.includes("/reporting/") && rel.includes("monthly")) {
    return "MONTHLY_REPORT_NON_SOURCE";
  }

  const schema = (input.schemaVersion ?? "").toLowerCase();
  const base = path.posix.basename(rel).toLowerCase();

  if (rel.startsWith("data/audits/") || schema.includes("audit") || base.includes("-audit")) {
    return "AUDIT";
  }
  if (schema.includes("schedule") || base.includes("schedule")) return "SCHEDULE";
  if (schema.includes("official-result") || base.includes("official-result")) {
    return "OFFICIAL_RESULT";
  }
  if (schema.includes("graded-prediction") || base.includes("graded-prediction")) {
    return "GRADED_PREDICTION";
  }
  if (schema.includes("market-baseline") || base.includes("market-baseline")) {
    return "MARKET_BASELINE";
  }
  if (
    schema.includes("prediction-snapshot") ||
    base.includes("prediction-snapshot") ||
    /^data\/predictions\/mlb\/\d{4}-\d{2}-\d{2}\.json$/.test(rel)
  ) {
    return "PREDICTION_SNAPSHOT";
  }
  if (schema.includes("recommendation") || base.includes("engine-recommendation")) {
    return "RECOMMENDATION_SEAL";
  }
  if (schema.includes("1x2-odds") || base.includes("odds")) return "ODDS";
  if (schema.includes("starter") && base.includes("postgame")) {
    return "STARTER_POSTGAME_REVIEW";
  }
  if (schema.includes("starter") || base.includes("starter-dataset")) return "STARTER";
  if (schema.includes("lineup") || base.includes("lineup")) return "LINEUP";
  if (schema.includes("identity") || base.includes("identity")) return "IDENTITY";
  if (schema.includes("daily-research-summary") || base.includes("daily-research-summary")) {
    return "DAILY_RESEARCH_SUMMARY";
  }
  if (schema.includes("success-review") || base.includes("success-review")) {
    return "SUCCESS_REVIEW";
  }
  if (schema.includes("failure-review") || base.includes("failure-review")) {
    return "FAILURE_REVIEW";
  }
  if (schema.includes("daily-review-summary") || base.includes("daily-review-summary")) {
    return "DAILY_REVIEW_SUMMARY";
  }
  if (schema.includes("research-scorecard") || base.includes("research-scorecard")) {
    return "RESEARCH_SCORECARD";
  }
  return "UNKNOWN";
}

function extractJoinKeys(doc: Record<string, unknown>): Record<string, string | number | null> {
  const meta = asRecord(doc.meta) ?? {};
  const firstMatch = Array.isArray(doc.matches)
    ? asRecord(doc.matches[0])
    : Array.isArray(doc.games)
      ? asRecord(doc.games[0])
      : Array.isArray(doc.rows)
        ? asRecord(doc.rows[0])
        : null;
  return {
    matchId: asString(firstMatch?.matchId),
    gamePk: asNumber(firstMatch?.gamePk),
    internalGameId: asString(firstMatch?.internalGameId) ?? asString(firstMatch?.gameId),
    providerMatchId: asString(firstMatch?.providerMatchId),
    fixtureId: asString(firstMatch?.fixtureId),
    sourceArtifactHash:
      asString(meta.sourceScheduleHash) ??
      asString(meta.sourceScheduleArtifactHashAtFreeze) ??
      asString(meta.resultHash),
    sourceSnapshotHash: asString(meta.sourceSnapshotHash) ?? asString(meta.snapshotHash),
    predictionHash:
      asString(meta.predictionHashSha256) ?? asString(meta.predictionHash),
  };
}

function dateFromName(name: string): string | null {
  const m = name.match(DATE_RE);
  return m?.[1] ?? null;
}

function inPeriod(date: string | null, start: string, end: string): boolean {
  if (!date) return false;
  return date >= start && date <= end;
}

async function listJsonFiles(absDir: string): Promise<string[]> {
  let names: string[] = [];
  try {
    names = await readdir(absDir);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const abs = path.join(absDir, name);
    try {
      const st = await stat(abs);
      if (st.isFile()) out.push(name);
    } catch {
      /* skip */
    }
  }
  return out;
}

async function readInventoried(input: {
  cwd: string;
  rel: string;
  sport: SportId | "MULTI" | "UNKNOWN";
}): Promise<InventoriedArtifact | null> {
  const abs = path.join(input.cwd, input.rel);
  let raw: string;
  try {
    raw = await readFile(abs, "utf8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  const doc = asRecord(parsed);
  if (!doc) return null;
  const meta = asRecord(doc.meta) ?? {};
  const schemaVersion =
    asString(doc.schemaVersion) ?? asString(meta.schemaVersion);
  const kind = classifyArtifactKind({
    rel: input.rel.replace(/\\/g, "/"),
    schemaVersion,
  });
  const dateKst =
    asString(doc.dateKst) ??
    asString(meta.dateKst) ??
    dateFromName(path.basename(input.rel));
  const posix = input.rel.replace(/\\/g, "/");
  return {
    path: posix,
    hash: sha256FileContent(raw),
    kind,
    sport: input.sport,
    schemaVersion,
    dateKst,
    predictionClass: asString(meta.predictionClass),
    model: asString(meta.model),
    engine: asString(meta.engine),
    recommendation: asString(meta.recommendation),
    officialPickCount: asNumber(meta.officialPickCount),
    joinKeys: extractJoinKeys(doc),
    excludedAsSource: isNonSourceKind(kind),
  };
}

export async function inventoryRawArtifacts(input: {
  periodStart: string;
  periodEnd: string;
  cwd?: string;
  extraRels?: string[];
}): Promise<RawArtifactInventory> {
  const cwd = input.cwd ?? process.cwd();
  const artifacts: InventoriedArtifact[] = [];
  const dirs = [...SPORT_DIRS, ...EXTRA_DIRS];

  for (const dir of dirs) {
    const names = await listJsonFiles(path.join(cwd, dir.rel));
    for (const name of names) {
      const date = dateFromName(name);
      if (date && !inPeriod(date, input.periodStart, input.periodEnd)) continue;
      if (!date && dir.rel === "data/audits") continue;
      const rel = `${dir.rel}/${name}`.replace(/\\/g, "/");
      const item = await readInventoried({ cwd, rel, sport: dir.sport });
      if (item) artifacts.push(item);
    }
  }

  for (const extra of input.extraRels ?? []) {
    const posix = extra.replace(/\\/g, "/");
    if (posix.startsWith(`${FORBIDDEN_PRESENTATION_DIR}/`)) continue;
    const item = await readInventoried({
      cwd,
      rel: posix,
      sport: "UNKNOWN",
    });
    if (item && (item.dateKst == null || inPeriod(item.dateKst, input.periodStart, input.periodEnd))) {
      artifacts.push(item);
    }
  }

  const excludedNonSources = artifacts.filter((a) => a.excludedAsSource);
  const sources = artifacts.filter((a) => !a.excludedAsSource);

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    artifacts,
    sourceArtifacts: sources.map((a) => ({
      path: a.path,
      hash: a.hash,
      kind: a.kind,
      sport: a.sport,
      schemaVersion: a.schemaVersion,
    })),
    excludedNonSources,
    writeAudit: { ...REPORTING_ZERO_WRITES },
  };
}

export function assertCanonicalWritePath(rel: string): void {
  const posix = rel.replace(/\\/g, "/");
  if (
    posix === FORBIDDEN_PRESENTATION_DIR ||
    posix.startsWith(`${FORBIDDEN_PRESENTATION_DIR}/`)
  ) {
    throw new Error("REPORT_WRITE_FORBIDDEN_PRESENTATION_DIR");
  }
  if (!posix.startsWith(`${CANONICAL_REPORT_DIR}/`)) {
    throw new Error("REPORT_WRITE_MUST_BE_CANONICAL_RESEARCH_DIR");
  }
}

export function datesWithEvidence(inventory: RawArtifactInventory): string[] {
  return [
    ...new Set(
      inventory.artifacts
        .filter((a) => !a.excludedAsSource && a.dateKst)
        .map((a) => a.dateKst as string),
    ),
  ].sort();
}
