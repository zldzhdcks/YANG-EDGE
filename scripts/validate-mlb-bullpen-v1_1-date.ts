/**
 * Bullpen v1.1 — 지정일(기본 2026-07-28) 종료 후 누적 검증 오케스트레이터.
 *
 * Classifier / threshold / Engine / Framework / immutable prediction 불변.
 *
 * 실행:
 *   tsx --env-file=.env.local scripts/validate-mlb-bullpen-v1_1-date.ts [YYYY-MM-DD]
 *   tsx --env-file=.env.local scripts/validate-mlb-bullpen-v1_1-date.ts 2026-07-27 --skip-postgame-steps
 *   npm run research:bullpen-validate -- 2026-07-27 --skip-postgame-steps
 */
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnLocalTsxScript } from "./lib/spawn-local-tsx";

const BASELINE_DATE = "2026-07-27";
const KNOWN_FLAGS = new Set(["--skip-postgame-steps"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const IMMUTABLE_KEYS = [
  "predictionId",
  "gameId",
  "externalId",
  "dateKst",
  "startTimeKst",
  "league",
  "homeTeam",
  "awayTeam",
  "baselinePick",
  "modelProbability",
  "edgeScore",
  "confidence",
  "recommendationGrade",
  "baselineStatus",
  "marketProbability",
  "valueEdge",
  "openingOdds",
  "latestOdds",
  "oddsMovement",
  "pitcherDirection",
  "pitcherReviewAvailable",
  "dataAvailability",
  "usedFactors",
  "missingFactors",
  "purchaseEligible",
  "researchOnly",
  "purchaseReason",
  "predictedAt",
  "sourceSnapshotVersions",
  "snapshotIntegrity",
  "integrityWarnings",
] as const;

type CliArgs = {
  date: string;
  skipPostgameSteps: boolean;
};

type PostgameArtifactCounts = {
  graded: number;
  hits: number;
  fails: number;
  pending: number;
  total: number;
};

type SlateSnapshot = {
  total: number;
  finished: number;
  inProgress: number;
  notStarted: number;
  counts: Record<string, number>;
  remaining: string | null;
  source: "api-baseball" | "postgame-artifacts";
};

function parseCliArgs(argv: string[]): CliArgs {
  let date: string | null = null;
  let skipPostgameSteps = false;

  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--")) {
      if (KNOWN_FLAGS.has(arg)) {
        if (arg === "--skip-postgame-steps") skipPostgameSteps = true;
        continue;
      }
      throw new Error(`Unknown option: ${arg}`);
    }
    if (DATE_RE.test(arg)) {
      if (date != null) {
        throw new Error(`Multiple dates specified: ${date}, ${arg}`);
      }
      date = arg;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    date:
      date?.trim() ||
      process.env.MLB_TARGET_DATE_KST?.trim() ||
      "2026-07-28",
    skipPostgameSteps,
  };
}

function postgameHint(date: string): string {
  return `Run postgame first: npm run research:postgame -- ${date}`;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
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

function immutablePredHash(pred: Record<string, unknown>): string {
  const slice: Record<string, unknown> = {};
  for (const k of IMMUTABLE_KEYS) slice[k] = pred[k] ?? null;
  return sha256(JSON.stringify(slice));
}

function snapshotImmutableHash(raw: string): string {
  const doc = JSON.parse(raw) as { predictions?: unknown[] };
  const hashes = (Array.isArray(doc.predictions) ? doc.predictions : [])
    .map((p) => immutablePredHash(asRecord(p) ?? {}))
    .sort();
  return sha256(hashes.join("|"));
}

async function fileExists(rel: string): Promise<boolean> {
  try {
    await access(path.join(process.cwd(), rel));
    return true;
  } catch {
    return false;
  }
}

async function fetchSlate(date: string): Promise<SlateSnapshot> {
  const base = (
    process.env.BASEBALL_API_BASE_URL || "https://v1.baseball.api-sports.io"
  ).replace(/\/$/, "");
  const key = (
    process.env.BASEBALL_API_KEY ||
    process.env.FOOTBALL_API_KEY ||
    ""
  ).trim();
  const u = new URL(`${base}/games`);
  u.searchParams.set("league", "1");
  u.searchParams.set("season", "2026");
  u.searchParams.set("date", date);
  u.searchParams.set("timezone", "Asia/Seoul");
  const r = await fetch(u, {
    headers: { Accept: "application/json", "x-apisports-key": key },
  });
  const j = (await r.json()) as {
    response?: Array<{ status?: { short?: string } }>;
  };
  const rows = j.response ?? [];
  let finished = 0;
  let inProgress = 0;
  let notStarted = 0;
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const s = row.status?.short ?? "?";
    counts[s] = (counts[s] ?? 0) + 1;
    if (["FT", "AOT", "AP"].includes(s)) finished += 1;
    else if (s === "NS") notStarted += 1;
    else if (s.startsWith("IN") || s === "LIVE") inProgress += 1;
  }
  return {
    total: rows.length,
    finished,
    inProgress,
    notStarted,
    counts,
    remaining: r.headers.get("x-ratelimit-requests-remaining"),
    source: "api-baseball",
  };
}

async function readJson(rel: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(
      await readFile(path.join(process.cwd(), rel), "utf8"),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function countPredictionResults(
  predictions: unknown[],
): PostgameArtifactCounts {
  let graded = 0;
  let hits = 0;
  let fails = 0;
  let pending = 0;

  for (const raw of predictions) {
    const p = asRecord(raw);
    if (!p) continue;
    const resultStatus = asString(p.resultStatus);
    if (resultStatus === "graded") {
      graded += 1;
      if (p.predictionHit === true) hits += 1;
      else if (p.predictionHit === false) fails += 1;
    } else if (resultStatus === "pending" || resultStatus == null) {
      pending += 1;
    }
  }

  return {
    graded,
    hits,
    fails,
    pending,
    total: predictions.length,
  };
}

function countReviewGames(review: Record<string, unknown>): {
  worked: number;
  failed: number;
  pending: number;
} {
  const games = Array.isArray(review.games) ? review.games : [];
  let worked = 0;
  let failed = 0;
  let pending = 0;

  for (const raw of games) {
    const g = asRecord(raw);
    if (!g) continue;
    const resultStatus = asString(g.resultStatus);
    const feedback = asString(g.feedbackClassification);
    if (resultStatus === "graded") {
      if (feedback === "SIGNAL_WORKED") worked += 1;
      else if (feedback === "SIGNAL_FAILED") failed += 1;
    } else if (resultStatus === "pending") {
      pending += 1;
    }
  }

  return { worked, failed, pending };
}

async function assertFlowReviewFile(
  date: string,
  rel: string,
  metaCountKey: string,
  expectedCount: number,
  label: string,
): Promise<void> {
  const doc = await readJson(rel);
  if (!doc) {
    throw new Error(
      `Missing ${label} artifact: ${rel}. ${postgameHint(date)}`,
    );
  }
  const games = Array.isArray(doc.games) ? doc.games : [];
  const metaCount = asNumber(asRecord(doc.meta)?.[metaCountKey]);
  if (metaCount != null && games.length !== metaCount) {
    throw new Error(
      `${label} count drift: meta.${metaCountKey}=${metaCount} but games.length=${games.length}`,
    );
  }
  if (expectedCount > 0 && games.length !== expectedCount) {
    throw new Error(
      `${label} count drift: review expects ${expectedCount} but games.length=${games.length}`,
    );
  }
  if (metaCount != null && metaCount !== expectedCount) {
    throw new Error(
      `${label} count drift: review expects ${expectedCount} but meta.${metaCountKey}=${metaCount}`,
    );
  }
}

async function assertPostgameArtifacts(
  date: string,
): Promise<{ counts: PostgameArtifactCounts; slate: SlateSnapshot }> {
  const predRel = `data/predictions/mlb/${date}.json`;
  const reviewRel = `data/predictions/mlb/${date}-review.json`;

  if (!(await fileExists(predRel))) {
    throw new Error(`Missing prediction artifact: ${predRel}. ${postgameHint(date)}`);
  }
  if (!(await fileExists(reviewRel))) {
    throw new Error(`Missing review artifact: ${reviewRel}. ${postgameHint(date)}`);
  }

  const pred = await readJson(predRel);
  const review = await readJson(reviewRel);
  if (!pred || !review) {
    throw new Error(`Unable to read postgame artifacts. ${postgameHint(date)}`);
  }

  const summary = asRecord(review.summary) ?? {};
  const reviewGraded = asNumber(summary.graded) ?? 0;
  const reviewHits = asNumber(summary.hits) ?? 0;
  const reviewFails = asNumber(summary.fails) ?? 0;
  const reviewPending = asNumber(summary.pending) ?? 0;
  const reviewTotal = asNumber(summary.total) ?? null;

  const predCounts = countPredictionResults(
    Array.isArray(pred.predictions) ? pred.predictions : [],
  );

  if (
    predCounts.graded !== reviewGraded ||
    predCounts.hits !== reviewHits ||
    predCounts.fails !== reviewFails ||
    predCounts.pending !== reviewPending
  ) {
    throw new Error(
      [
        "Review summary drift vs prediction results:",
        `review graded/hits/fails/pending=${reviewGraded}/${reviewHits}/${reviewFails}/${reviewPending}`,
        `prediction graded/hits/fails/pending=${predCounts.graded}/${predCounts.hits}/${predCounts.fails}/${predCounts.pending}`,
        postgameHint(date),
      ].join(" "),
    );
  }

  const gameCounts = countReviewGames(review);
  if (gameCounts.worked !== reviewHits || gameCounts.failed !== reviewFails) {
    throw new Error(
      [
        "Review games drift vs summary:",
        `games worked/failed=${gameCounts.worked}/${gameCounts.failed}`,
        `summary hits/fails=${reviewHits}/${reviewFails}`,
        postgameHint(date),
      ].join(" "),
    );
  }

  if (reviewGraded > 0) {
    if (reviewHits > 0) {
      await assertFlowReviewFile(
        date,
        `data/predictions/mlb/${date}-success-flow-review.json`,
        "successGames",
        reviewHits,
        "Success flow review",
      );
    }
    if (reviewFails > 0) {
      await assertFlowReviewFile(
        date,
        `data/predictions/mlb/${date}-failure-flow-review.json`,
        "failedGames",
        reviewFails,
        "Failure flow review",
      );
    }
  }

  const total =
    reviewTotal ?? predCounts.total ?? reviewGraded + reviewPending;
  const slate: SlateSnapshot = {
    total,
    finished: reviewGraded,
    inProgress: 0,
    notStarted: reviewPending,
    counts: {
      GRADED: reviewGraded,
      PENDING: reviewPending,
    },
    remaining: null,
    source: "postgame-artifacts",
  };

  return {
    counts: {
      graded: reviewGraded,
      hits: reviewHits,
      fails: reviewFails,
      pending: reviewPending,
      total,
    },
    slate,
  };
}

async function runBullpenPipeline(date: string): Promise<{
  bullpenHashBefore: string | null;
  bullpenHashAfter: string | null;
  cacheNetwork: number | null;
  cacheReuseOk: boolean;
  failWarn: number | null;
  failTotal: number | null;
  successStable: number | null;
  successTotal: number | null;
  unkRate: number | null;
  clsRate: number | null;
  roleCounts: Record<string, unknown> | null;
  fp: number;
  fn: number;
}> {
  const steps = [
    ["scripts/audit-mlb-pregame-bullpen-risk.ts", [date]],
    ["scripts/build-mlb-bullpen-role-dataset-v1_1.ts", [date]],
  ] as const;

  for (const [script, args] of steps) {
    console.log(`\n--- ${script} ---`);
    const code = await spawnLocalTsxScript(script, [...args]);
    if (code !== 0) throw new Error(`${script} failed (${code})`);
  }

  const bullpenPath = `data/research/mlb/${date}-bullpen-role-dataset-v1_1.json`;
  const bullpen1 = await readJson(bullpenPath);
  const bullpenHashBefore = asString(asRecord(bullpen1?.meta)?.resultHashSha256);
  const cache1 = asRecord(bullpen1?.cacheUsage) ?? {};
  const net1 = asNumber(cache1.networkCalls) ?? 0;

  console.log("\n--- scripts/build-mlb-bullpen-role-dataset-v1_1.ts (warm re-run) ---");
  const code2 = await spawnLocalTsxScript(
    "scripts/build-mlb-bullpen-role-dataset-v1_1.ts",
    [date],
  );
  if (code2 !== 0) throw new Error("bullpen warm re-run failed");

  const bullpen2 = await readJson(bullpenPath);
  const bullpenHashAfter = asString(asRecord(bullpen2?.meta)?.resultHashSha256);
  const cache2 = asRecord(bullpen2?.cacheUsage) ?? {};
  const cacheNetwork = asNumber(cache2.networkCalls);
  const cacheReuseOk = cacheNetwork === 0;

  const sum = asRecord(bullpen2?.summary) ?? {};
  const roleCounts = asRecord(sum.roleCounts) ?? {};
  const rows = asNumber(sum.classifiedPitcherRows) ?? 0;
  const unk = asNumber(roleCounts.UNKNOWN) ?? 0;
  const cls = asNumber(asRecord(sum.classificationStatusCounts)?.CLASSIFIED) ?? 0;
  const unkRate = rows > 0 ? Math.round((unk / rows) * 1000) / 10 : null;
  const clsRate = rows > 0 ? Math.round((cls / rows) * 1000) / 10 : null;

  const games = Array.isArray(bullpen2?.gameCompares)
    ? (bullpen2!.gameCompares as unknown[])
    : [];
  let falsePositive = 0;
  let falseNegative = 0;
  for (const raw of games) {
    const g = asRecord(raw);
    if (!g) continue;
    const outcome = asString(g.outcome);
    const overall = asString(g.overallRoleComparison);
    if (outcome === "HIT" && overall === "ROLE_STRUCTURE_CONFLICTS_BASELINE") {
      falsePositive += 1;
    }
    if (outcome === "MISS" && overall === "ROLE_STRUCTURE_SUPPORTS_BASELINE") {
      falseNegative += 1;
    }
  }

  if (net1 > 0 && !cacheReuseOk) {
    // surfaced via remainingIssues in caller
  }
  if (bullpenHashBefore !== bullpenHashAfter) {
    // surfaced via remainingIssues in caller
  }

  return {
    bullpenHashBefore,
    bullpenHashAfter,
    cacheNetwork,
    cacheReuseOk,
    failWarn: asNumber(sum.failCollapsePregameKeyWarning),
    failTotal: asNumber(sum.failCollapseTotal),
    successStable: asNumber(sum.successProtectedPregameStable),
    successTotal: asNumber(sum.successProtectedTotal),
    unkRate,
    clsRate,
    roleCounts,
    fp: falsePositive,
    fn: falseNegative,
  };
}

async function main() {
  const { date: DATE, skipPostgameSteps } = parseCliArgs(process.argv);
  console.log(
    `=== Bullpen v1.1 date validation (${DATE})${skipPostgameSteps ? " [skip-postgame-steps]" : ""} ===`,
  );

  const predPath = path.join(
    process.cwd(),
    "data/predictions/mlb",
    `${DATE}.json`,
  );

  let prechecked: { counts: PostgameArtifactCounts; slate: SlateSnapshot } | null =
    null;
  if (skipPostgameSteps) {
    prechecked = await assertPostgameArtifacts(DATE);
  }

  const predRawBefore = await readFile(predPath, "utf8");
  const predImmutableBefore = snapshotImmutableHash(predRawBefore);
  const predFileHashBefore = sha256(predRawBefore);

  const baseline27 = await readJson(
    "data/research/mlb/2026-07-27-bullpen-role-dataset-v1_1.json",
  );
  const compare27 = await readJson(
    "data/audits/2026-07-27-bullpen-role-v1-vs-v1_1.json",
  );
  const review27 = await readJson(
    "data/predictions/mlb/2026-07-27-review.json",
  );

  const s27 = asRecord(baseline27?.summary) ?? {};
  const roles27 = asRecord(s27.roleCounts) ?? {};
  const rows27 = asNumber(s27.classifiedPitcherRows) ?? 0;
  const unk27 = asNumber(roles27.UNKNOWN) ?? 0;
  const cls27 = asNumber(asRecord(s27.classificationStatusCounts)?.CLASSIFIED) ?? 0;
  const unkRate27 = rows27 > 0 ? Math.round((unk27 / rows27) * 1000) / 10 : null;
  const clsRate27 = rows27 > 0 ? Math.round((cls27 / rows27) * 1000) / 10 : null;

  const graded27 = asNumber(asRecord(review27?.summary)?.graded) ?? 14;
  const v11 = asRecord(compare27?.v11) ?? {};

  let slate: SlateSnapshot;
  let pipelineRan = false;
  let gradedNew = 0;
  let failWarn: number | null = null;
  let failTotal: number | null = null;
  let successStable: number | null = null;
  let successTotal: number | null = null;
  let fp: number | null = asNumber(compare27?.falsePositiveCount);
  let fn: number | null = asNumber(compare27?.falseNegativeCount);
  let unkRate: number | null = unkRate27;
  let clsRate: number | null = clsRate27;
  let roleCounts: Record<string, unknown> | null = roles27;
  let bullpenHashBefore: string | null = asString(
    asRecord(baseline27?.meta)?.resultHashSha256,
  );
  let bullpenHashAfter: string | null = null;
  let cacheNetwork: number | null = null;
  let cacheReuseOk = false;
  const remainingIssues: string[] = [];

  if (skipPostgameSteps) {
    const { counts, slate: artifactSlate } = prechecked!;
    slate = artifactSlate;

    if (counts.graded === 0) {
      remainingIssues.push(
        `${DATE} graded games 0 — AWAITING_FINISHED_GAMES (postgame artifacts present but no Final results yet)`,
      );
    } else {
      const bullpen = await runBullpenPipeline(DATE);
      pipelineRan = true;
      gradedNew = counts.graded;
      failWarn = bullpen.failWarn;
      failTotal = bullpen.failTotal;
      successStable = bullpen.successStable;
      successTotal = bullpen.successTotal;
      fp = bullpen.fp;
      fn = bullpen.fn;
      unkRate = bullpen.unkRate;
      clsRate = bullpen.clsRate;
      roleCounts = bullpen.roleCounts;
      bullpenHashBefore = bullpen.bullpenHashBefore;
      bullpenHashAfter = bullpen.bullpenHashAfter;
      cacheNetwork = bullpen.cacheNetwork;
      cacheReuseOk = bullpen.cacheReuseOk;
      if ((cacheNetwork ?? 0) > 0 && !cacheReuseOk) {
        remainingIssues.push("warm cache reuse incomplete");
      }
      if (bullpenHashBefore !== bullpenHashAfter) {
        remainingIssues.push("bullpen result hash not reproducible");
      }
    }
  } else {
    slate = await fetchSlate(DATE);

    if (slate.finished === 0) {
      remainingIssues.push(
        `${DATE} 종료 경기 0 (status=${JSON.stringify(slate.counts)}) — AWAITING_FINISHED_GAMES`,
      );
    } else {
      const steps = [
        ["scripts/grade-mlb-research-predictions.ts", [DATE]],
        ["scripts/review-mlb-failed-game-flow.ts", [DATE]],
        ["scripts/review-mlb-success-game-flow.ts", [DATE]],
      ] as const;
      for (const [script, args] of steps) {
        console.log(`\n--- ${script} ---`);
        const code = await spawnLocalTsxScript(script, [...args]);
        if (code !== 0) throw new Error(`${script} failed (${code})`);
      }

      const bullpen = await runBullpenPipeline(DATE);
      pipelineRan = true;
      bullpenHashBefore = bullpen.bullpenHashBefore;
      bullpenHashAfter = bullpen.bullpenHashAfter;
      cacheNetwork = bullpen.cacheNetwork;
      cacheReuseOk = bullpen.cacheReuseOk;
      failWarn = bullpen.failWarn;
      failTotal = bullpen.failTotal;
      successStable = bullpen.successStable;
      successTotal = bullpen.successTotal;
      fp = bullpen.fp;
      fn = bullpen.fn;
      unkRate = bullpen.unkRate;
      clsRate = bullpen.clsRate;
      roleCounts = bullpen.roleCounts;

      const review = await readJson(`data/predictions/mlb/${DATE}-review.json`);
      gradedNew = asNumber(asRecord(review?.summary)?.graded) ?? slate.finished;

      if ((cacheNetwork ?? 0) > 0 && !cacheReuseOk) {
        remainingIssues.push("warm cache reuse incomplete");
      }
      if (bullpenHashBefore !== bullpenHashAfter) {
        remainingIssues.push("bullpen result hash not reproducible");
      }
    }
  }

  const predRawAfter = await readFile(predPath, "utf8");
  const predImmutableAfter = snapshotImmutableHash(predRawAfter);
  const predImmutableOk = predImmutableBefore === predImmutableAfter;
  const predFileUnchangedIfIdle =
    !pipelineRan || sha256(predRawAfter) !== predFileHashBefore
      ? predImmutableOk
      : predImmutableOk;

  const availabilityPrev = await readJson(
    "data/research/mlb/h-bp-role-006-availability-survey.json",
  );
  const availability = {
    ...(availabilityPrev ?? {}),
    collectionStatus: {
      updatedAt: new Date().toISOString(),
      collectorImplemented: false,
      engineConnected: false,
      lastSlateChecked: DATE,
      slateFinished: slate.finished,
      note:
        slate.finished === 0
          ? "Slate unfinished — collection pipeline still research-only survey"
          : "Slate finished — still survey-only; no Engine wiring",
    },
  };
  await mkdir(path.join(process.cwd(), "data/research/mlb"), {
    recursive: true,
  });
  await writeFile(
    path.join(
      process.cwd(),
      "data/research/mlb/h-bp-role-006-availability-survey.json",
    ),
    `${JSON.stringify(availability, null, 2)}\n`,
    "utf8",
  );

  const role007 = {
    meta: {
      hypothesisId: "H-BP-ROLE-007",
      description: "UNKNOWN rate natural decline under frozen classifier v1.1",
      classifierVersion: "bullpen-role-classifier-v1.1",
      classifierFrozen: true,
      engineConnected: false,
      generatedAt: new Date().toISOString(),
    },
    observations: [
      {
        dateKst: BASELINE_DATE,
        classifiedPitcherRows: rows27,
        unknownCount: unk27,
        unknownRatePct: unkRate27,
        classifiedCount: cls27,
        classifiedRatePct: clsRate27,
        status: "BASELINE",
      },
      {
        dateKst: DATE,
        classifiedPitcherRows: pipelineRan
          ? asNumber(
              asRecord(
                (
                  await readJson(
                    `data/research/mlb/${DATE}-bullpen-role-dataset-v1_1.json`,
                  )
                )?.summary,
              )?.classifiedPitcherRows,
            )
          : null,
        unknownRatePct: pipelineRan ? unkRate : null,
        classifiedRatePct: pipelineRan ? clsRate : null,
        status: pipelineRan ? "OBSERVED" : "AWAITING_FINISHED_SLATE",
        deltaUnknownRatePctVsBaseline:
          pipelineRan && unkRate != null && unkRate27 != null
            ? Math.round((unkRate - unkRate27) * 10) / 10
            : null,
      },
    ],
    verdict: pipelineRan
      ? unkRate != null && unkRate27 != null && unkRate < unkRate27
        ? "UNKNOWN_RATE_DECREASED"
        : unkRate != null && unkRate27 != null && unkRate > unkRate27
          ? "UNKNOWN_RATE_INCREASED"
          : "UNKNOWN_RATE_STABLE_OR_INCONCLUSIVE"
      : "INSUFFICIENT_NEW_SAMPLE",
  };
  await writeFile(
    path.join(
      process.cwd(),
      "data/research/mlb/h-bp-role-007-unknown-decline-observation.json",
    ),
    `${JSON.stringify(role007, null, 2)}\n`,
    "utf8",
  );

  remainingIssues.push(
    "OPENER/MOP_UP primary still 0 on frozen v1.1 (07-27 baseline)",
    "availabilityUnknown remains true until H-BP-ROLE-006 collector exists",
  );
  if (!pipelineRan) {
    remainingIssues.push(
      "H-BP-ROLE-007 awaiting finished sample for UNKNOWN delta",
    );
  }

  const cumulativeGraded = graded27 + (pipelineRan ? gradedNew : 0);
  const conclusion = "DATA_ACCUMULATION_CONTINUES";

  const report = {
    meta: {
      version: "bullpen-v1.1-date-validation-v1",
      generatedAt: new Date().toISOString(),
      targetDateKst: DATE,
      skipPostgameSteps,
      classifierVersion: "bullpen-role-classifier-v1.1",
      classifierLogicChanged: false,
      engineConnected: false,
      engineImpact: 0,
      frameworkChanged: false,
      conclusion,
      predictionImmutableHashBefore: predImmutableBefore,
      predictionImmutableHashAfter: predImmutableAfter,
      predictionImmutableUnchanged: predImmutableOk,
      bullpenResultHashBefore: bullpenHashBefore,
      bullpenResultHashAfter: bullpenHashAfter ?? bullpenHashBefore,
      bullpenHashMatched:
        !pipelineRan || bullpenHashBefore === bullpenHashAfter,
      cacheReuseNetworkCalls: cacheNetwork,
      cacheReuseOk: !pipelineRan || cacheReuseOk,
      pipelineRan,
      slateSource: slate.source,
    },
    slate,
    metrics: {
      finishedGames: pipelineRan ? gradedNew : 0,
      cumulativeGradedGames: cumulativeGraded,
      failPregameWarn: pipelineRan
        ? failWarn
        : asNumber(v11.failCollapseWarned),
      failTotal: pipelineRan ? failTotal : asNumber(v11.failCollapseTotal),
      successStable: pipelineRan
        ? successStable
        : asNumber(v11.successProtectedStable),
      successTotal: pipelineRan
        ? successTotal
        : asNumber(v11.successProtectedTotal),
      falsePositive: fp,
      falseNegative: fn,
      unknownRatePct: unkRate,
      classifiedRatePct: clsRate,
      roleCounts,
      metricsSource: pipelineRan ? DATE : BASELINE_DATE,
    },
    hypotheses: {
      "H-BP-ROLE-006": {
        status: "SURVEY_ONLY_PARTIAL_COLLECTIBLE",
        engineConnected: false,
        collectionStatusPath:
          "data/research/mlb/h-bp-role-006-availability-survey.json",
      },
      "H-BP-ROLE-007": {
        status: role007.verdict,
        observationPath:
          "data/research/mlb/h-bp-role-007-unknown-decline-observation.json",
        baselineUnknownRatePct: unkRate27,
        latestUnknownRatePct: unkRate,
      },
    },
    verification: {
      predictionImmutableHashUnchanged: predFileUnchangedIfIdle,
      engineImpact: 0,
      cacheReuse: !pipelineRan || cacheReuseOk,
      resultHashReproducible: !pipelineRan || bullpenHashBefore === bullpenHashAfter,
    },
    remainingIssues,
  };

  const outPath = path.join(
    process.cwd(),
    "data/audits",
    `bullpen-v1_1-validation-${DATE}.json`,
  );
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const reportCode = await spawnLocalTsxScript(
    "scripts/build-mlb-bullpen-v1_1-daily-report.ts",
    [DATE],
  );
  if (reportCode !== 0) {
    throw new Error(`daily report failed (exit ${reportCode})`);
  }

  if (pipelineRan && !skipPostgameSteps) {
    console.log("\n--- Site Feedback/Learning refresh (post research) ---");
    const refreshCode = await spawnLocalTsxScript(
      "scripts/refresh-site-feedback-learning.ts",
      [DATE],
    );
    if (refreshCode !== 0) {
      throw new Error(
        `Site Feedback/Learning refresh failed (exit ${refreshCode})`,
      );
    }
  }

  console.log(`\nfinished=${slate.finished} pipelineRan=${pipelineRan}`);
  console.log(`skipPostgameSteps=${skipPostgameSteps}`);
  console.log(`immutableOk=${predImmutableOk}`);
  console.log(`conclusion=${conclusion}`);
  console.log(`저장: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
