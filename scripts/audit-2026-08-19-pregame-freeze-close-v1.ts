/**
 * 2026-08-19 Pregame Freeze close audit.
 * Consumes existing MLB prediction snapshot. Does not call providers,
 * rewrite sealed inputs, or re-run the engine.
 *
 *   npx tsx scripts/audit-2026-08-19-pregame-freeze-close-v1.ts record-before
 *   npx tsx scripts/audit-2026-08-19-pregame-freeze-close-v1.ts close
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { instantToKst } from "../src/lib/datetime/kst";

export const DATE_KST = "2026-08-19";
export const CLOSE_REL = "data/audits/2026-08-19-pregame-freeze-close-v1.json";
export const HASHES_BEFORE_REL =
  "data/audits/2026-08-19-pregame-freeze-hashes-before-v1.json";
export const PREDICTION_REL = `data/predictions/mlb/${DATE_KST}.json`;
export const SUMMARY_REL =
  `data/research/mlb/${DATE_KST}-daily-research-summary-v1.json`;
export const INPUT_CLOSE_REL = "data/audits/2026-08-19-pregame-input-close-v1.json";
export const FOOTBALL_SNAPSHOT_REL =
  `data/research/football/${DATE_KST}-prediction-snapshot-v0.json`;

export const FROZEN_INPUTS = {
  mlbSchedule: `data/research/mlb/${DATE_KST}-schedule-v1.json`,
  starter: `data/research/mlb/${DATE_KST}-starter-dataset-v1.json`,
  providerOdds: `data/research/mlb/${DATE_KST}-odds-history-dataset-v1.json`,
  officialLineup: `data/research/mlb/${DATE_KST}-lineup-dataset-v1.json`,
  expectedLineupObservation:
    `data/operator-input/mlb/${DATE_KST}-expected-lineup-observation-v0.json`,
  koreanMarketOddsObservation:
    `data/operator-input/mlb/${DATE_KST}-korean-market-odds-observation-v0.json`,
  dailyScopeLock: "data/audits/2026-08-19-daily-scope-lock-v1.json",
  pregameInputClose: INPUT_CLOSE_REL,
  footballSchedule: `data/research/football/${DATE_KST}-schedule-v1.json`,
} as const;

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function hashFrozen(cwd: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, rel] of Object.entries(FROZEN_INPUTS)) {
    out[key] = sha256File(path.join(cwd, rel));
  }
  return out;
}

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

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function firstPitchKstLabel(utc: string): string | null {
  const kst = instantToKst(utc);
  if (!kst) return null;
  return `${kst.date} ${kst.time} KST`;
}

export async function recordHashesBefore(cwd = process.cwd()) {
  const generatedAt = new Date().toISOString();
  for (const rel of Object.values(FROZEN_INPUTS)) {
    if (!existsSync(path.join(cwd, rel))) throw new Error(`MISSING:${rel}`);
  }
  if (existsSync(path.join(cwd, PREDICTION_REL))) {
    throw new Error("PREDICTION_ALREADY_EXISTS");
  }
  const hashes = hashFrozen(cwd);
  const abs = path.join(cwd, HASHES_BEFORE_REL);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(
    abs,
    `${JSON.stringify({ generatedAt, hashes }, null, 2)}\n`,
    "utf8",
  );
  return { generatedAt, hashes };
}

export async function auditPregameFreezeClose(cwd = process.cwd()) {
  const existingAbs = path.join(cwd, CLOSE_REL);
  if (existsSync(existingAbs)) {
    return JSON.parse(readFileSync(existingAbs, "utf8")) as Record<
      string,
      unknown
    >;
  }

  const beforeAbs = path.join(cwd, HASHES_BEFORE_REL);
  if (!existsSync(beforeAbs)) {
    throw new Error("HASHES_BEFORE_MISSING");
  }
  if (!existsSync(path.join(cwd, PREDICTION_REL))) {
    throw new Error("PREDICTION_MISSING");
  }
  if (existsSync(path.join(cwd, FOOTBALL_SNAPSHOT_REL))) {
    throw new Error("FOOTBALL_SNAPSHOT_PRESENT");
  }

  const beforeDoc = JSON.parse(readFileSync(beforeAbs, "utf8")) as {
    hashes: Record<string, string>;
  };
  const after = hashFrozen(cwd);
  const unchanged = Object.entries(beforeDoc.hashes).every(
    ([k, v]) => after[k] === v,
  );

  const pred = JSON.parse(
    readFileSync(path.join(cwd, PREDICTION_REL), "utf8"),
  ) as Record<string, unknown>;
  const meta = asRecord(pred.meta) ?? {};
  const summary = asRecord(pred.summary) ?? {};
  const rows = asArr(pred.predictions);
  const inputClose = JSON.parse(
    readFileSync(path.join(cwd, INPUT_CLOSE_REL), "utf8"),
  ) as {
    MLB: {
      scheduleGames: number;
      starter: { probableAvailable: number; probableMissing: number };
      officialLineup: { confirmed: number; notReleased: number };
    };
    FOOTBALL: { scopeGames: number; blocked: number };
  };

  const schedule = JSON.parse(
    readFileSync(path.join(cwd, FROZEN_INPUTS.mlbSchedule), "utf8"),
  ) as { games?: Array<Record<string, unknown>> };
  const commenceByGameId = new Map<string, string>();
  for (const g of schedule.games ?? []) {
    const id = asString(g.internalGameId);
    const utc = asString(g.commenceTimeUtc);
    if (id && utc) commenceByGameId.set(id, utc);
  }

  const predictedAts = rows
    .map((r) => asString(asRecord(r)?.predictedAt))
    .filter((v): v is string => v != null)
    .sort();
  const predictedAt = predictedAts[0] ?? asString(meta.generatedAt);
  const commenceTimes = [...commenceByGameId.values()]
    .map((t) => ({ t, ms: Date.parse(t) }))
    .filter((x) => Number.isFinite(x.ms))
    .sort((a, b) => a.ms - b.ms);
  const firstPitchUtc = commenceTimes[0]?.t ?? null;

  let allBeforeKickoff = true;
  let lateCount = 0;
  for (const raw of rows) {
    const rec = asRecord(raw);
    const pa = asString(rec?.predictedAt);
    const gameId = asString(rec?.gameId);
    const commenceUtc =
      asString(rec?.commenceTimeUtc) ??
      (gameId ? commenceByGameId.get(gameId) ?? null : null);
    if (pa && commenceUtc && Date.parse(pa) >= Date.parse(commenceUtc)) {
      allBeforeKickoff = false;
      lateCount += 1;
    }
  }

  const inputStatusCounts: Record<string, number> = {};
  const officialStatusCounts: Record<string, number> = {};
  const recGradeCounts: Record<string, number> = {};
  for (const raw of rows) {
    const rec = asRecord(raw);
    const is = asString(rec?.inputStatus) ?? "UNKNOWN";
    const os = asString(rec?.officialStatus) ?? "UNKNOWN";
    const rg = asString(rec?.recommendationGrade) ?? "null";
    inputStatusCounts[is] = (inputStatusCounts[is] ?? 0) + 1;
    officialStatusCounts[os] = (officialStatusCounts[os] ?? 0) + 1;
    recGradeCounts[rg] = (recGradeCounts[rg] ?? 0) + 1;
  }

  const minutesBeforeFirstPitch =
    predictedAt && firstPitchUtc
      ? Math.round((Date.parse(firstPitchUtc) - Date.parse(predictedAt)) / 60000)
      : null;

  const generatedAt = new Date().toISOString();
  const document = {
    schemaVersion: "yang-edge-pregame-freeze-close-v1",
    dateKst: DATE_KST,
    generatedAt,
    researchOnly: true,
    MLB: {
      scheduleGames: inputClose.MLB.scheduleGames,
      predictionRows: rows.length,
      predictionHash:
        asString(meta.predictionHashSha256) ??
        asString(meta.predictionHash) ??
        null,
      inputHash:
        asString(meta.inputManifestHash) ??
        asString(asRecord(meta.inputManifest)?.inputHash) ??
        null,
      eligible: asNumber(meta.eligibleCount) ?? officialStatusCounts.ELIGIBLE ?? 0,
      pass: asNumber(meta.passCount) ?? officialStatusCounts.PASS ?? 0,
      blocked: asNumber(meta.blockedCount) ?? officialStatusCounts.BLOCKED ?? 0,
      limitedInput: inputStatusCounts.LIMITED_INPUT ?? 0,
      good: recGradeCounts.GOOD ?? 0,
      predictedAt,
      generatedAt: asString(meta.generatedAt),
      firstPitchUtc,
      firstPitchKst: firstPitchUtc ? firstPitchKstLabel(firstPitchUtc) : null,
      minutesBeforeFirstPitch,
      allBeforeKickoff,
      lateFreezeRows: lateCount,
      schemaVersion: asString(meta.schemaVersion) ?? asString(meta.version),
      researchOnly: summary.researchOnly === true || meta.researchOnly === true,
      resultsFetched: meta.resultsFetched === true,
      engineRerun: meta.engineRerun === true,
      officialPickCount: asNumber(meta.officialPickCount) ?? 0,
      starterProbable: inputClose.MLB.starter.probableAvailable,
      starterMissing: inputClose.MLB.starter.probableMissing,
      officialLineupConfirmed: inputClose.MLB.officialLineup.confirmed,
      officialLineupNotReleased: inputClose.MLB.officialLineup.notReleased,
      inventedValues: 0,
      snapshotRel: PREDICTION_REL,
      dailySummaryRel: SUMMARY_REL,
    },
    FOOTBALL: {
      scopeGames: 6,
      predictionEligible: 0,
      validBlocked: 6,
      predictionGenerated: 0,
      engineCalled: false,
      postgameAccess: false,
    },
    providerCalls: 0,
    resultCalls: 0,
    gradeCalls: 0,
    reviewCalls: 0,
    postgameCalls: 0,
    engineMutation: false,
    inputHashesBefore: beforeDoc.hashes,
    inputHashesAfter: after,
    allFrozenInputsUnchanged: unchanged,
    stageStatus:
      unchanged && allBeforeKickoff
        ? "C_PREGAME_FREEZE_DONE"
        : "C_PREGAME_FREEZE_INCOMPLETE",
    leakage: {
      providerCalls: 0,
      resultCalls: 0,
      gradeCalls: 0,
      reviewCalls: 0,
      postgameCalls: 0,
      engineMutation: false,
      expectedLineupWiredIntoEngine: false,
      koreanMarketOddsWiredIntoEngine: false,
    },
  };

  if (document.stageStatus !== "C_PREGAME_FREEZE_DONE") {
    throw new Error(
      `FREEZE_CLOSE_INCOMPLETE unchanged=${unchanged} allBeforeKickoff=${allBeforeKickoff}`,
    );
  }

  await mkdir(path.dirname(existingAbs), { recursive: true });
  await writeFile(
    existingAbs,
    `${JSON.stringify(document, null, 2)}\n`,
    "utf8",
  );
  if (existsSync(beforeAbs)) unlinkSync(beforeAbs);
  return document;
}

async function main() {
  const mode = process.argv[2]?.trim() || "close";
  if (mode === "record-before") {
    const doc = await recordHashesBefore();
    console.log(
      `recorded ${HASHES_BEFORE_REL} keys=${Object.keys(doc.hashes).length}`,
    );
    return;
  }
  if (mode !== "close") {
    console.error(
      "Usage: npx tsx scripts/audit-2026-08-19-pregame-freeze-close-v1.ts [record-before|close]",
    );
    process.exitCode = 1;
    return;
  }
  const doc = await auditPregameFreezeClose();
  const mlb = asRecord(doc.MLB);
  console.log(
    [
      `wrote ${CLOSE_REL}`,
      `stage=${String(doc.stageStatus)}`,
      `rows=${String(mlb?.predictionRows)}`,
      `hash=${String(mlb?.predictionHash)}`,
      `unchanged=${String(doc.allFrozenInputsUnchanged)}`,
    ].join(" "),
  );
}

if (process.argv[1]?.includes("audit-2026-08-19-pregame-freeze-close-v1")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
