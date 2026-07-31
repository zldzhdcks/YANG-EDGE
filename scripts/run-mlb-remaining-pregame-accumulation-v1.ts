/**
 * MLB Remaining Pregame Data Accumulation v1
 *
 * Identifies games that have not yet started (now < commenceTimeUtc),
 * runs Schedule → Starter → Odds → Lineup → Daily Summary → Prediction,
 * then writes remaining eligibility, cutoff audit, and collection summary.
 *
 * Does not change Engine weights. Does not auto-promote research.
 *
 *   npx tsx --env-file=.env.local scripts/run-mlb-remaining-pregame-accumulation-v1.ts [YYYY-MM-DD]
 */
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { instantToKst } from "../src/lib/datetime/kst";
import { writeJsonAtomic } from "../src/lib/mlb/build-mlb-schedule-artifact";
import { spawnLocalTsxScript } from "./lib/spawn-local-tsx";

const DATE =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  "";

const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const COLLECTION_STARTED_AT = new Date().toISOString();

type EligibilityStatus =
  | "PREGAME_ELIGIBLE"
  | "EXCLUDED_ALREADY_STARTED"
  | "PASS_START_TIME_UNKNOWN"
  | "POSTPONED"
  | "CANCELLED";

type StepRun = {
  step: string;
  exitCode: number | null;
  status: "SUCCESS" | "FAIL" | "SKIP";
  detail: string;
  artifact: string | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(rel: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), rel), "utf8"));
  } catch {
    return null;
  }
}

function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function artifactPaths(dateKst: string) {
  return {
    schedule: `data/research/mlb/${dateKst}-schedule-v1.json`,
    starter: `data/research/mlb/${dateKst}-starter-dataset-v1.json`,
    odds: `data/research/mlb/${dateKst}-odds-history-dataset-v1.json`,
    lineup: `data/research/mlb/${dateKst}-lineup-dataset-v1.json`,
    daily: `data/research/mlb/${dateKst}-daily-research-summary-v1.json`,
    prediction: `data/predictions/mlb/${dateKst}.json`,
    remaining: `data/research/mlb/${dateKst}-remaining-pregame-v1.json`,
    cutoffAudit: `data/research/mlb/${dateKst}-pregame-cutoff-audit-v1.json`,
    collectionSummary: `data/research/mlb/${dateKst}-pregame-collection-summary-v1.json`,
  };
}

async function preserveIfExists(rel: string, runId: string): Promise<string | null> {
  const abs = path.join(process.cwd(), rel);
  if (!(await exists(abs))) return null;
  const dir = path.dirname(abs);
  const base = path.basename(rel, ".json");
  const revRel = path
    .join(path.dirname(rel), `${base}.rev-${runId}.json`)
    .replace(/\\/g, "/");
  const revAbs = path.join(process.cwd(), revRel);
  if (await exists(revAbs)) return revRel;
  await mkdir(dir, { recursive: true });
  await copyFile(abs, revAbs);
  return revRel;
}

function classifyGame(
  commenceTimeUtc: string | null,
  statusAbstract: string | null,
  nowMs: number,
): { status: EligibilityStatus; exclusionReason: string | null; pregameEligible: boolean } {
  const abstract = (statusAbstract ?? "").toLowerCase();
  if (/postpon/.test(abstract)) {
    return {
      status: "POSTPONED",
      exclusionReason: "schedule statusAbstract postponed",
      pregameEligible: false,
    };
  }
  if (/cancel/.test(abstract)) {
    return {
      status: "CANCELLED",
      exclusionReason: "schedule statusAbstract cancelled",
      pregameEligible: false,
    };
  }
  if (!commenceTimeUtc) {
    return {
      status: "PASS_START_TIME_UNKNOWN",
      exclusionReason: "commenceTimeUtc missing",
      pregameEligible: false,
    };
  }
  const startMs = Date.parse(commenceTimeUtc);
  if (!Number.isFinite(startMs)) {
    return {
      status: "PASS_START_TIME_UNKNOWN",
      exclusionReason: "commenceTimeUtc unparseable",
      pregameEligible: false,
    };
  }
  if (startMs <= nowMs) {
    return {
      status: "EXCLUDED_ALREADY_STARTED",
      exclusionReason: `commenceTimeUtc ${commenceTimeUtc} <= collectionStartedAt`,
      pregameEligible: false,
    };
  }
  return {
    status: "PREGAME_ELIGIBLE",
    exclusionReason: null,
    pregameEligible: true,
  };
}

async function runStep(
  name: string,
  script: string,
  dateKst: string,
  artifact: string | null,
): Promise<StepRun> {
  console.log(`\n--- ${name} ---`);
  try {
    const code = await spawnLocalTsxScript(script, [dateKst]);
    if (code !== 0) {
      return {
        step: name,
        exitCode: code,
        status: "FAIL",
        detail: `exit ${code}`,
        artifact,
      };
    }
    const present = artifact
      ? await exists(path.join(process.cwd(), artifact))
      : true;
    return {
      step: name,
      exitCode: code,
      status: present ? "SUCCESS" : "FAIL",
      detail: present ? "ok" : "artifact missing after success exit",
      artifact,
    };
  } catch (e) {
    return {
      step: name,
      exitCode: null,
      status: "FAIL",
      detail: e instanceof Error ? e.message : String(e),
      artifact,
    };
  }
}

function indexByGameId(rows: unknown[]): Map<string, Record<string, unknown>[]> {
  const map = new Map<string, Record<string, unknown>[]>();
  for (const raw of rows) {
    const row = asRecord(raw);
    if (!row) continue;
    const id = asString(row.gameId) ?? asString(row.internalGameId);
    if (!id) continue;
    const list = map.get(id) ?? [];
    list.push(row);
    map.set(id, list);
  }
  return map;
}

async function main() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE)) {
    console.error(
      "Usage: npx tsx --env-file=.env.local scripts/run-mlb-remaining-pregame-accumulation-v1.ts YYYY-MM-DD",
    );
    process.exitCode = 1;
    return;
  }

  const paths = artifactPaths(DATE);
  const nowMs = Date.parse(COLLECTION_STARTED_AT);
  const kstNow = instantToKst(COLLECTION_STARTED_AT);

  console.log(`=== MLB Remaining Pregame Accumulation v1 (${DATE}) ===`);
  console.log(`runId=${RUN_ID}`);
  console.log(`collectionStartedAt=${COLLECTION_STARTED_AT}`);
  console.log(`kstNow=${kstNow?.date ?? "?"} ${kstNow?.time ?? "?"}`);

  const revisions: Record<string, string | null> = {
    schedule: await preserveIfExists(paths.schedule, RUN_ID),
    lineup: await preserveIfExists(paths.lineup, RUN_ID),
    starter: await preserveIfExists(paths.starter, RUN_ID),
    odds: await preserveIfExists(paths.odds, RUN_ID),
    prediction: await preserveIfExists(paths.prediction, RUN_ID),
  };
  console.log("revisions:", revisions);

  const steps: StepRun[] = [];

  // 1. Schedule refresh (full slate — eligibility filters remaining)
  steps.push(
    await runStep(
      "schedule",
      "scripts/build-mlb-schedule-artifact-v1.ts",
      DATE,
      paths.schedule,
    ),
  );

  const scheduleDoc = asRecord(await readJson(paths.schedule));
  const scheduleGames = Array.isArray(scheduleDoc?.games)
    ? (scheduleDoc!.games as unknown[])
    : [];

  const eligibilityGames = scheduleGames.map((raw) => {
    const g = asRecord(raw) ?? {};
    const commenceTimeUtc = asString(g.commenceTimeUtc);
    const statusAbstract = asString(g.statusAbstract);
    const classified = classifyGame(commenceTimeUtc, statusAbstract, nowMs);
    const kst = commenceTimeUtc ? instantToKst(commenceTimeUtc) : null;
    return {
      gamePk: asNumber(g.gamePk),
      internalGameId: asString(g.internalGameId),
      awayTeam: asString(g.awayTeam),
      homeTeam: asString(g.homeTeam),
      scheduledStartUtc: commenceTimeUtc,
      scheduledStartKst: kst
        ? `${kst.date} ${kst.time?.slice(0, 5) ?? ""}`.trim()
        : asString(g.startTimeKst),
      collectionStartedAt: COLLECTION_STARTED_AT,
      scheduleAsOf: asString(asRecord(scheduleDoc?.meta)?.generatedAt),
      statusAbstract,
      eligibilityStatus: classified.status,
      pregameEligible: classified.pregameEligible,
      exclusionReason: classified.exclusionReason,
    };
  });

  const remainingDoc = {
    schemaVersion: "mlb-remaining-pregame-v1",
    dateKst: DATE,
    runId: RUN_ID,
    generatedAt: new Date().toISOString(),
    collectionStartedAt: COLLECTION_STARTED_AT,
    scheduleArtifact: paths.schedule,
    revisions,
    summary: {
      totalSlateGames: eligibilityGames.length,
      pregameEligible: eligibilityGames.filter((g) => g.pregameEligible).length,
      alreadyStarted: eligibilityGames.filter(
        (g) => g.eligibilityStatus === "EXCLUDED_ALREADY_STARTED",
      ).length,
      postponed: eligibilityGames.filter((g) => g.eligibilityStatus === "POSTPONED")
        .length,
      cancelled: eligibilityGames.filter((g) => g.eligibilityStatus === "CANCELLED")
        .length,
      startTimeUnknown: eligibilityGames.filter(
        (g) => g.eligibilityStatus === "PASS_START_TIME_UNKNOWN",
      ).length,
    },
    games: eligibilityGames,
  };
  await writeJsonAtomic(path.join(process.cwd(), paths.remaining), remainingDoc);
  console.log(
    `remaining eligible=${remainingDoc.summary.pregameEligible} / slate=${remainingDoc.summary.totalSlateGames}`,
  );

  // 2–5 collectors (do not abort on failure)
  steps.push(
    await runStep(
      "starter",
      "scripts/build-mlb-starter-dataset-v1.ts",
      DATE,
      paths.starter,
    ),
  );
  steps.push(
    await runStep(
      "odds",
      "scripts/build-mlb-odds-history-dataset-v1.ts",
      DATE,
      paths.odds,
    ),
  );
  steps.push(
    await runStep(
      "lineup",
      "scripts/build-mlb-lineup-dataset-v1.ts",
      DATE,
      paths.lineup,
    ),
  );
  steps.push(
    await runStep(
      "daily-research",
      "scripts/build-mlb-daily-research-v1.ts",
      DATE,
      paths.daily,
    ),
  );
  steps.push(
    await runStep(
      "prediction",
      "scripts/build-mlb-prediction-snapshot-v1.ts",
      DATE,
      paths.prediction,
    ),
  );

  // Load outputs for audit
  const starterDoc = asRecord(await readJson(paths.starter));
  const oddsDoc = asRecord(await readJson(paths.odds));
  const lineupDoc = asRecord(await readJson(paths.lineup));
  const predictionDoc = asRecord(await readJson(paths.prediction));

  const starterRows = indexByGameId(
    Array.isArray(starterDoc?.rows) ? (starterDoc!.rows as unknown[]) : [],
  );
  const oddsRows = indexByGameId(
    Array.isArray(oddsDoc?.rows) ? (oddsDoc!.rows as unknown[]) : [],
  );
  const lineupRows = indexByGameId(
    Array.isArray(lineupDoc?.rows) ? (lineupDoc!.rows as unknown[]) : [],
  );
  const predictions = Array.isArray(predictionDoc?.predictions)
    ? (predictionDoc!.predictions as unknown[])
    : [];
  const predById = new Map<string, Record<string, unknown>>();
  for (const raw of predictions) {
    const p = asRecord(raw);
    const id = asString(p?.gameId);
    if (id && p) predById.set(id, p);
  }

  const eligibleIds = new Set(
    eligibilityGames
      .filter((g) => g.pregameEligible)
      .map((g) => g.internalGameId)
      .filter((x): x is string => !!x),
  );

  type AuditGame = {
    gamePk: number | null;
    internalGameId: string | null;
    pregameEligible: boolean;
    scheduledStartUtc: string | null;
    checks: Array<{ id: string; pass: boolean; detail: string }>;
    leakageFailed: boolean;
    predictionStatus: string;
    passReason: string | null;
    starterStatus: string;
    oddsStatus: string;
    lineupStatus: string;
    finalStatus: string;
  };

  const auditGames: AuditGame[] = [];

  for (const eg of eligibilityGames) {
    const gameId = eg.internalGameId ?? "";
    const checks: AuditGame["checks"] = [];
    const start = eg.scheduledStartUtc;
    const startMs = start ? Date.parse(start) : NaN;

    if (!eg.pregameEligible) {
      auditGames.push({
        gamePk: eg.gamePk,
        internalGameId: eg.internalGameId,
        pregameEligible: false,
        scheduledStartUtc: start,
        checks: [
          {
            id: "eligibility",
            pass: true,
            detail: eg.eligibilityStatus,
          },
        ],
        leakageFailed: false,
        predictionStatus: "EXCLUDED",
        passReason: eg.exclusionReason,
        starterStatus: "SKIPPED",
        oddsStatus: "SKIPPED",
        lineupStatus: "SKIPPED",
        finalStatus: eg.eligibilityStatus,
      });
      continue;
    }

    const starters = starterRows.get(gameId) ?? [];
    const odds = oddsRows.get(gameId) ?? [];
    const lineups = lineupRows.get(gameId) ?? [];
    const pred = predById.get(gameId);

    const starterStatus =
      starters.length === 0
        ? "STARTER_NOT_COLLECTED"
        : starters.every((r) => asString(r.probablePitcherId) || asString(r.probablePitcherName) || asString(asRecord(r.probable)?.name as unknown) || asNumber(asRecord(r.probable)?.id as unknown) != null)
          ? "STARTER_PROBABLE_COLLECTED"
          : asString(starters[0]?.collectionStatus) ??
            asString(starters[0]?.status) ??
            "STARTER_MISSING";

    // More robust starter check using known schema fields
    let starterLabel = "STARTER_MISSING";
    if (starters.length === 0) {
      starterLabel = "STARTER_NOT_COLLECTED";
    } else {
      const hasProbable = starters.some((r) => {
        const probable = asRecord(r.probable);
        return (
          asNumber(probable?.id) != null ||
          !!asString(probable?.name) ||
          asNumber(r.probablePitcherId) != null ||
          !!asString(r.probablePitcherName)
        );
      });
      const cutoffFail = starters.some(
        (r) =>
          asString(r.cutoffStatus) === "FAILED" ||
          asNumber(r.cutoffViolations) != null && (asNumber(r.cutoffViolations) ?? 0) > 0,
      );
      if (cutoffFail) starterLabel = "STARTER_CUTOFF_FAILED";
      else if (hasProbable) starterLabel = "STARTER_PROBABLE_COLLECTED";
      else starterLabel = "STARTER_MISSING";
    }

    const oddsRow = odds[0];
    const oddsStatus =
      !oddsRow
        ? "NOT_COLLECTED"
        : asString(oddsRow.collectionStatus) ?? "NOT_COLLECTED";

    const lineupStatuses = lineups.map((r) => asString(r.collectionStatus));
    let lineupStatus = "NOT_COLLECTED";
    if (lineups.length === 0) lineupStatus = "NOT_COLLECTED";
    else if (lineupStatuses.every((s) => s === "CONFIRMED"))
      lineupStatus = "CONFIRMED_PREGAME";
    else if (lineupStatuses.some((s) => s === "PARTIAL")) lineupStatus = "PARTIAL";
    else if (lineupStatuses.every((s) => s === "NOT_RELEASED"))
      lineupStatus = "NOT_RELEASED";
    else lineupStatus = lineupStatuses[0] ?? "NOT_COLLECTED";

    // Leakage checks
    checks.push({
      id: "collection_before_start",
      pass: Number.isFinite(startMs) && nowMs < startMs,
      detail: `collectionStartedAt=${COLLECTION_STARTED_AT} start=${start}`,
    });

    const inputTimes: Array<{ label: string; at: string | null }> = [
      {
        label: "starter.generatedAt",
        at: asString(asRecord(starterDoc?.meta)?.generatedAt),
      },
      {
        label: "odds.generatedAt",
        at: asString(asRecord(oddsDoc?.meta)?.generatedAt),
      },
      {
        label: "lineup.generatedAt",
        at: asString(asRecord(lineupDoc?.meta)?.generatedAt),
      },
      {
        label: "prediction.predictedAt",
        at:
          asString(asRecord(predictionDoc?.meta)?.predictedAt) ??
          asString(pred?.predictedAt),
      },
    ];

    for (const t of inputTimes) {
      if (!t.at || !Number.isFinite(startMs)) {
        checks.push({
          id: `timestamp:${t.label}`,
          pass: false,
          detail: `${t.label} missing`,
        });
        continue;
      }
      const atMs = Date.parse(t.at);
      checks.push({
        id: `timestamp:${t.label}`,
        pass: Number.isFinite(atMs) && atMs < startMs,
        detail: `${t.label}=${t.at} vs start=${start}`,
      });
    }

    for (const row of odds) {
      const capturedAt = asString(row.capturedAt);
      if (capturedAt && Number.isFinite(startMs)) {
        checks.push({
          id: `odds.capturedAt`,
          pass: Date.parse(capturedAt) < startMs,
          detail: `capturedAt=${capturedAt}`,
        });
      }
    }
    for (const row of lineups) {
      const src = asString(row.sourceTimestamp);
      if (src && Number.isFinite(startMs)) {
        checks.push({
          id: `lineup.sourceTimestamp`,
          pass: Date.parse(src) < startMs,
          detail: `sourceTimestamp=${src}`,
        });
      }
    }

    // recentStarts must not include target gamePk
    for (const row of starters) {
      const recent = Array.isArray(row.recentStarts)
        ? (row.recentStarts as unknown[])
        : [];
      const hit = recent.some((s) => asNumber(asRecord(s)?.gamePk) === eg.gamePk);
      checks.push({
        id: "starter.recentStarts_excludes_target",
        pass: !hit,
        detail: hit
          ? `target gamePk ${eg.gamePk} found in recentStarts`
          : "target gamePk not in recentStarts",
      });
    }

    const leakageFailed = checks.some((c) => !c.pass);

    const inputStatus = asString(pred?.inputStatus);
    const baselineStatus = asString(pred?.baselineStatus);
    let predictionStatus = "PASS";
    let passReason: string | null = null;
    if (leakageFailed) {
      predictionStatus = "INVALID_PRE_GAME_CUTOFF";
      passReason = "leakage or cutoff check failed";
    } else if (!pred) {
      predictionStatus = "PASS";
      passReason = "prediction row missing";
    } else if (inputStatus === "BLOCKED") {
      predictionStatus = "PASS";
      passReason = `inputStatus=BLOCKED; ${(Array.isArray(pred.inputWarnings) ? pred.inputWarnings : []).join(",")}`;
    } else if (baselineStatus === "PASS" || baselineStatus === "INSUFFICIENT") {
      predictionStatus = "PASS";
      passReason = `baselineStatus=${baselineStatus}`;
    } else if (baselineStatus === "BASELINE_CANDIDATE") {
      predictionStatus = "PREDICTED";
      passReason = null;
    } else {
      predictionStatus = baselineStatus ?? inputStatus ?? "PASS";
      passReason = `inputStatus=${inputStatus}; baselineStatus=${baselineStatus}`;
    }

    const finalStatus = leakageFailed
      ? "INVALID_PRE_GAME_CUTOFF"
      : predictionStatus === "PREDICTED"
        ? "PREDICTED"
        : predictionStatus === "PASS"
          ? "PASS"
          : predictionStatus;

    auditGames.push({
      gamePk: eg.gamePk,
      internalGameId: eg.internalGameId,
      pregameEligible: true,
      scheduledStartUtc: start,
      checks,
      leakageFailed,
      predictionStatus,
      passReason,
      starterStatus: starterLabel !== "STARTER_MISSING" ? starterLabel : starterStatus,
      oddsStatus,
      lineupStatus,
      finalStatus,
    });
  }

  const cutoffAudit = {
    schemaVersion: "mlb-pregame-cutoff-audit-v1",
    dateKst: DATE,
    runId: RUN_ID,
    generatedAt: new Date().toISOString(),
    collectionStartedAt: COLLECTION_STARTED_AT,
    summary: {
      eligibleGames: eligibleIds.size,
      leakageFailures: auditGames.filter((g) => g.leakageFailed).length,
      invalidCutoff: auditGames.filter(
        (g) => g.finalStatus === "INVALID_PRE_GAME_CUTOFF",
      ).length,
      predicted: auditGames.filter((g) => g.finalStatus === "PREDICTED").length,
      pass: auditGames.filter((g) => g.finalStatus === "PASS").length,
    },
    games: auditGames,
  };
  await writeJsonAtomic(
    path.join(process.cwd(), paths.cutoffAudit),
    cutoffAudit,
  );

  const notCollected = {
    starter: auditGames.filter(
      (g) =>
        g.pregameEligible &&
        (g.starterStatus === "STARTER_NOT_COLLECTED" ||
          g.starterStatus === "STARTER_MISSING"),
    ).length,
    odds: auditGames.filter(
      (g) => g.pregameEligible && g.oddsStatus === "NOT_COLLECTED",
    ).length,
    lineup: auditGames.filter(
      (g) =>
        g.pregameEligible &&
        (g.lineupStatus === "NOT_COLLECTED" || g.lineupStatus === "NOT_RELEASED"),
    ).length,
  };

  const collectionSummary = {
    schemaVersion: "mlb-pregame-collection-summary-v1",
    dateKst: DATE,
    runId: RUN_ID,
    generatedAt: new Date().toISOString(),
    collectionStartedAt: COLLECTION_STARTED_AT,
    kstAtCollection: `${kstNow?.date ?? DATE} ${kstNow?.time ?? ""}`.trim(),
    engineChanged: false,
    weightsChanged: false,
    researchPromotion: "NONE",
    revisions,
    steps,
    artifacts: paths,
    counts: {
      totalSlateGames: remainingDoc.summary.totalSlateGames,
      pregameEligibleAtStart: remainingDoc.summary.pregameEligible,
      alreadyStartedAtStart: remainingDoc.summary.alreadyStarted,
      successfullyStoredEligible: auditGames.filter(
        (g) => g.pregameEligible && !g.leakageFailed,
      ).length,
      pass: cutoffAudit.summary.pass,
      predicted: cutoffAudit.summary.predicted,
      notCollected,
      cutoffFailures: cutoffAudit.summary.invalidCutoff,
      leakageFailures: cutoffAudit.summary.leakageFailures,
    },
    games: auditGames.map((g) => ({
      gamePk: g.gamePk,
      internalGameId: g.internalGameId,
      pregameEligible: g.pregameEligible,
      scheduledStartUtc: g.scheduledStartUtc,
      starterStatus: g.starterStatus,
      oddsStatus: g.oddsStatus,
      lineupStatus: g.lineupStatus,
      predictionStatus: g.predictionStatus,
      passReason: g.passReason,
      finalStatus: g.finalStatus,
      leakageFailed: g.leakageFailed,
      artifacts: {
        schedule: paths.schedule,
        starter: paths.starter,
        odds: paths.odds,
        lineup: paths.lineup,
        prediction: paths.prediction,
        remaining: paths.remaining,
        cutoffAudit: paths.cutoffAudit,
      },
    })),
    assistantSummary: [
      `MLB Remaining Pregame Accumulation — ${DATE}`,
      `Collection started: ${COLLECTION_STARTED_AT}`,
      `Slate: ${remainingDoc.summary.totalSlateGames}`,
      `Pregame eligible: ${remainingDoc.summary.pregameEligible}`,
      `Already started: ${remainingDoc.summary.alreadyStarted}`,
      `Predicted: ${cutoffAudit.summary.predicted}`,
      `PASS: ${cutoffAudit.summary.pass}`,
      `Leakage failures: ${cutoffAudit.summary.leakageFailures}`,
      `Engine changed: false`,
    ].join("\n"),
  };

  await writeJsonAtomic(
    path.join(process.cwd(), paths.collectionSummary),
    collectionSummary,
  );

  // Hash fingerprint for report
  const fingerprint = {
    remainingHash: sha256Text(JSON.stringify(remainingDoc.games)),
    cutoffHash: sha256Text(JSON.stringify(cutoffAudit.games)),
  };

  console.log("\n=== SUMMARY ===");
  console.log(collectionSummary.assistantSummary);
  console.log(`wrote ${paths.remaining}`);
  console.log(`wrote ${paths.cutoffAudit}`);
  console.log(`wrote ${paths.collectionSummary}`);
  console.log(`fingerprint=${JSON.stringify(fingerprint)}`);

  const hardFail = steps.some(
    (s) =>
      (s.step === "schedule" || s.step === "prediction") && s.status === "FAIL",
  );
  if (hardFail) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
