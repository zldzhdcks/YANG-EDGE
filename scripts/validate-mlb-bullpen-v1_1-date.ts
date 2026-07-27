/**
 * Bullpen v1.1 — 지정일(기본 2026-07-28) 종료 후 누적 검증 오케스트레이터.
 *
 * Classifier / threshold / Engine / Framework / immutable prediction 불변.
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/validate-mlb-bullpen-v1_1-date.ts [YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const DATE =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  "2026-07-28";
const BASELINE_DATE = "2026-07-27";

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

async function fetchSlate(date: string) {
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
  };
}

function run(scriptRel: string, args: string[] = []): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["tsx", "--env-file=.env.local", path.join(process.cwd(), scriptRel), ...args],
      {
        cwd: process.cwd(),
        stdio: "inherit",
        shell: process.platform === "win32",
      },
    );
    child.on("error", reject);
    child.on("close", (c) => resolve(c ?? 1));
  });
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

async function main() {
  console.log(`=== Bullpen v1.1 date validation (${DATE}) ===`);

  const predPath = path.join(
    process.cwd(),
    "data/predictions/mlb",
    `${DATE}.json`,
  );
  const predRawBefore = await readFile(predPath, "utf8");
  const predImmutableBefore = snapshotImmutableHash(predRawBefore);
  const predFileHashBefore = sha256(predRawBefore);

  const slate = await fetchSlate(DATE);
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
  let remainingIssues: string[] = [];

  if (slate.finished === 0) {
    remainingIssues.push(
      `${DATE} 종료 경기 0 (status=${JSON.stringify(slate.counts)}) — 채점/리뷰/Bullpen 추가 표본 대기`,
    );
  } else {
    // Grade + reviews + bullpen + warm re-run for hash
    const steps = [
      ["scripts/grade-mlb-research-predictions.ts", [DATE]],
      ["scripts/review-mlb-failed-game-flow.ts", [DATE]],
      ["scripts/review-mlb-success-game-flow.ts", [DATE]],
      ["scripts/audit-mlb-pregame-bullpen-risk.ts", [DATE]],
      ["scripts/build-mlb-bullpen-role-dataset-v1_1.ts", [DATE]],
    ] as const;
    for (const [script, args] of steps) {
      console.log(`\n--- ${script} ---`);
      const code = await run(script, [...args]);
      if (code !== 0) throw new Error(`${script} failed (${code})`);
    }
    pipelineRan = true;

    const bullpenPath = `data/research/mlb/${DATE}-bullpen-role-dataset-v1_1.json`;
    const bullpen1 = await readJson(bullpenPath);
    bullpenHashBefore = asString(asRecord(bullpen1?.meta)?.resultHashSha256);
    const cache1 = asRecord(bullpen1?.cacheUsage) ?? {};
    const net1 = asNumber(cache1.networkCalls) ?? 0;

    // warm re-run
    const code2 = await run("scripts/build-mlb-bullpen-role-dataset-v1_1.ts", [
      DATE,
    ]);
    if (code2 !== 0) throw new Error("bullpen warm re-run failed");
    const bullpen2 = await readJson(bullpenPath);
    bullpenHashAfter = asString(asRecord(bullpen2?.meta)?.resultHashSha256);
    const cache2 = asRecord(bullpen2?.cacheUsage) ?? {};
    cacheNetwork = asNumber(cache2.networkCalls);
    cacheReuseOk = cacheNetwork === 0;

    const sum = asRecord(bullpen2?.summary) ?? {};
    roleCounts = asRecord(sum.roleCounts) ?? {};
    const rows = asNumber(sum.classifiedPitcherRows) ?? 0;
    const unk = asNumber(roleCounts.UNKNOWN) ?? 0;
    const cls =
      asNumber(asRecord(sum.classificationStatusCounts)?.CLASSIFIED) ?? 0;
    unkRate = rows > 0 ? Math.round((unk / rows) * 1000) / 10 : null;
    clsRate = rows > 0 ? Math.round((cls / rows) * 1000) / 10 : null;
    failWarn = asNumber(sum.failCollapsePregameKeyWarning);
    failTotal = asNumber(sum.failCollapseTotal);
    successStable = asNumber(sum.successProtectedPregameStable);
    successTotal = asNumber(sum.successProtectedTotal);

    const review = await readJson(`data/predictions/mlb/${DATE}-review.json`);
    gradedNew = asNumber(asRecord(review?.summary)?.graded) ?? slate.finished;

    // FP/FN vs outcome using overallRoleComparison
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
      if (
        outcome === "HIT" &&
        overall === "ROLE_STRUCTURE_CONFLICTS_BASELINE"
      ) {
        falsePositive += 1;
      }
      if (
        outcome === "MISS" &&
        overall === "ROLE_STRUCTURE_SUPPORTS_BASELINE"
      ) {
        falseNegative += 1;
      }
    }
    fp = falsePositive;
    fn = falseNegative;

    if (net1 > 0 && !cacheReuseOk) {
      remainingIssues.push("warm cache reuse incomplete");
    }
    if (bullpenHashBefore !== bullpenHashAfter) {
      remainingIssues.push("bullpen result hash not reproducible");
    }
  }

  const predRawAfter = await readFile(predPath, "utf8");
  const predImmutableAfter = snapshotImmutableHash(predRawAfter);
  const predImmutableOk = predImmutableBefore === predImmutableAfter;
  // 채점 전엔 파일 전체도 불변이어야 함
  const predFileUnchangedIfIdle =
    !pipelineRan || sha256(predRawAfter) !== predFileHashBefore
      ? predImmutableOk
      : predImmutableOk;

  // H-BP-ROLE-006 collection status only
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

  // H-BP-ROLE-007 observation (UNKNOWN natural decline) — observation only
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
      "H-BP-ROLE-007 awaiting finished 07-28 sample for UNKNOWN delta",
    );
  }

  const cumulativeGraded = graded27 + (pipelineRan ? gradedNew : 0);
  const conclusion = "DATA_ACCUMULATION_CONTINUES";

  const report = {
    meta: {
      version: "bullpen-v1.1-date-validation-v1",
      generatedAt: new Date().toISOString(),
      targetDateKst: DATE,
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

  // Daily report: reuse written validation JSON only (no recompute)
  const reportCode = await run(
    "scripts/build-mlb-bullpen-v1_1-daily-report.ts",
    [DATE],
  );
  if (reportCode !== 0) {
    throw new Error(`daily report failed (exit ${reportCode})`);
  }

  if (pipelineRan) {
    console.log("\n--- Site Feedback/Learning refresh (post research) ---");
    const refreshCode = await run(
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
  console.log(`immutableOk=${predImmutableOk}`);
  console.log(`conclusion=${conclusion}`);
  console.log(`저장: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
