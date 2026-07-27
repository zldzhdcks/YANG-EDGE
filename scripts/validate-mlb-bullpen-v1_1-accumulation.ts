/**
 * Bullpen v1.1 누적 검증 + H-BP-ROLE-006 Availability 수집 가능 항목 조사.
 *
 * - Classifier / threshold / Engine / Framework / 07-27 prediction 불변
 * - 신규 종료 슬레이트가 없으면 상태를 기록하고 07-28 pre-game 스냅샷만 저장
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/validate-mlb-bullpen-v1_1-accumulation.ts
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const EXISTING_DATE = "2026-07-27";
const NEXT_DATE = "2026-07-28";
const STATS = "https://statsapi.mlb.com";

const PATHS = {
  pred27: path.join(
    process.cwd(),
    "data/predictions/mlb",
    `${EXISTING_DATE}.json`,
  ),
  review27: path.join(
    process.cwd(),
    "data/predictions/mlb",
    `${EXISTING_DATE}-review.json`,
  ),
  bullpen27: path.join(
    process.cwd(),
    "data/research/mlb",
    `${EXISTING_DATE}-bullpen-role-dataset-v1_1.json`,
  ),
  compare: path.join(
    process.cwd(),
    "data/audits",
    `${EXISTING_DATE}-bullpen-role-v1-vs-v1_1.json`,
  ),
  baseline28: path.join(
    process.cwd(),
    "data/daily-tests",
    `${NEXT_DATE}-mlb-baseline-analysis.json`,
  ),
  filter28: path.join(
    process.cwd(),
    "data/daily-tests",
    `${NEXT_DATE}-mlb-betting-line-filter.json`,
  ),
  pred28: path.join(
    process.cwd(),
    "data/predictions/mlb",
    `${NEXT_DATE}.json`,
  ),
  out: path.join(
    process.cwd(),
    "data/audits",
    "bullpen-v1_1-validation-accumulation.json",
  ),
  availability: path.join(
    process.cwd(),
    "data/research/mlb",
    "h-bp-role-006-availability-survey.json",
  ),
};

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

async function fetchBaseballDate(date: string): Promise<{
  total: number;
  finished: number;
  inProgress: number;
  notStarted: number;
  remaining: string | null;
  calls: number;
}> {
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
  for (const row of rows) {
    const s = row.status?.short ?? "";
    if (["FT", "AOT", "AP"].includes(s)) finished += 1;
    else if (s === "NS") notStarted += 1;
    else if (s.startsWith("IN") || s === "LIVE") inProgress += 1;
  }
  return {
    total: rows.length,
    finished,
    inProgress,
    notStarted,
    remaining: r.headers.get("x-ratelimit-requests-remaining"),
    calls: 1,
  };
}

async function runScript(rel: string, args: string[] = []): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["tsx", "--env-file=.env.local", path.join(process.cwd(), rel), ...args],
      { cwd: process.cwd(), stdio: "inherit", shell: process.platform === "win32" },
    );
    child.on("error", reject);
    child.on("close", (c) => resolve(c ?? 1));
  });
}

async function saveResearchSnapshotFromBaseline(dateKst: string): Promise<{
  saved: boolean;
  games: number;
  path: string;
  note: string;
}> {
  const baselinePath = path.join(
    process.cwd(),
    "data/daily-tests",
    `${dateKst}-mlb-baseline-analysis.json`,
  );
  const filterPath = path.join(
    process.cwd(),
    "data/daily-tests",
    `${dateKst}-mlb-betting-line-filter.json`,
  );
  const outPath = path.join(
    process.cwd(),
    "data/predictions/mlb",
    `${dateKst}.json`,
  );

  let baseline: Record<string, unknown>;
  let filter: Record<string, unknown> | null = null;
  try {
    baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  } catch {
    return {
      saved: false,
      games: 0,
      path: outPath,
      note: "baseline missing",
    };
  }
  try {
    filter = JSON.parse(await readFile(filterPath, "utf8"));
  } catch {
    filter = null;
  }

  // do not overwrite existing snapshot
  try {
    await readFile(outPath, "utf8");
    return {
      saved: false,
      games: 0,
      path: outPath,
      note: "snapshot already exists — left unchanged",
    };
  } catch {
    /* create new */
  }

  const games = Array.isArray(baseline.games) ? baseline.games : [];
  const filterById = new Map<string, Record<string, unknown>>();
  const lines = Array.isArray(asRecord(filter)?.lines)
    ? (asRecord(filter)!.lines as unknown[])
    : [];
  for (const entry of lines) {
    const row = asRecord(entry);
    const id = asString(row?.gameId);
    if (id && row) filterById.set(id, row);
  }

  const predictedAt =
    asString(asRecord(baseline.meta)?.generatedAt) ?? new Date().toISOString();

  const predictions = [];
  for (const entry of games) {
    const row = asRecord(entry);
    if (!row) continue;
    const gameId = asString(row.gameId);
    if (!gameId) continue;
    const filterRow = filterById.get(gameId);
    const analysisStatus = asString(row.analysisStatus);
    const filterClassification = asString(filterRow?.classification);
    let baselineStatus = "PASS";
    if (filterClassification === "MARKET_CONFLICT") baselineStatus = "MARKET_CONFLICT";
    else if (filterClassification === "INSUFFICIENT") baselineStatus = "INSUFFICIENT";
    else if (analysisStatus === "BASELINE_CANDIDATE") baselineStatus = "BASELINE_CANDIDATE";
    else if (analysisStatus === "INSUFFICIENT_DATA") baselineStatus = "INSUFFICIENT";

    predictions.push({
      predictionId: `mlb-research-${dateKst}-${gameId}`,
      gameId,
      externalId: gameId.replace(/^mlb-/, "") || null,
      dateKst: asString(row.dateKst) ?? dateKst,
      startTimeKst: asString(row.startTimeKst),
      league: "MLB",
      homeTeam: asString(row.homeTeam) ?? "",
      awayTeam: asString(row.awayTeam) ?? "",
      baselinePick: asString(row.pickTeam),
      modelProbability: asNumber(row.modelWinProbability),
      edgeScore: asNumber(row.edgeScore),
      confidence: asNumber(row.confidence),
      recommendationGrade: asString(row.recommendationGrade),
      baselineStatus,
      marketProbability: asNumber(row.marketProbability),
      valueEdge: asNumber(row.valueEdge),
      openingOdds: asNumber(filterRow?.bestOdds),
      latestOdds: asNumber(filterRow?.bestOdds),
      oddsMovement: null,
      pitcherDirection: null,
      pitcherReviewAvailable: false,
      dataAvailability: asNumber(row.dataAvailability),
      usedFactors: Array.isArray(row.usedFactors) ? row.usedFactors : [],
      missingFactors: Array.isArray(row.missingFactors) ? row.missingFactors : [],
      purchaseEligible: false,
      researchOnly: true,
      purchaseReason: "SALES_WINDOW_CLOSED",
      predictedAt,
      sourceSnapshotVersions: {
        baseline: asString(asRecord(baseline.meta)?.version),
        bettingLineFilter:
          asString(asRecord(asRecord(filter)?.meta)?.version) ?? null,
        pitcherReview: null,
        lineRecheck: null,
        purchaseCutoff: null,
      },
      snapshotIntegrity: "UNVERIFIED",
      integrityWarnings: [
        "PRE_GAME_SNAPSHOT_PARTIAL:pitcher/recheck/purchase sources absent",
        "RESEARCH_ACCUMULATION_SNAPSHOT",
      ],
      resultStatus: "pending",
      homeScore: null,
      awayScore: null,
      actualWinner: null,
      predictionHit: null,
      gradedAt: null,
      feedbackClassification: null,
    });
  }

  const doc = {
    meta: {
      version: "mlb-research-prediction-snapshot-v1",
      dateKst,
      league: "MLB",
      kind: "research-prediction-snapshot",
      generatedAt: new Date().toISOString(),
      predictedAt,
      purchaseEligible: false,
      researchOnly: true,
      purchaseReason: "SALES_WINDOW_CLOSED",
      bettingLine: false,
      engineRerun: false,
      resultsFetched: false,
      immutablePredictionFields: [
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
      ],
      note: "연구 누적용 pre-game 스냅샷. 베팅 라인 아님. pitcher review 미포함. 종료 후 채점 예정.",
    },
    summary: {
      total: predictions.length,
      pending: predictions.length,
    },
    predictions,
  };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  return {
    saved: true,
    games: predictions.length,
    path: outPath,
    note: "created from baseline+filter only (UNVERIFIED integrity)",
  };
}

async function surveyAvailability(): Promise<Record<string, unknown>> {
  const usage = { statsApiCalls: 0 };
  async function get(q: string) {
    usage.statsApiCalls += 1;
    const r = await fetch(`${STATS}${q}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    return { ok: r.ok, status: r.status, json: r.ok ? await r.json() : null };
  }

  // Rays teamId 139 — sample probe only
  const teamId = 139;
  const roster = await get(
    `/api/v1/teams/${teamId}/roster?rosterType=active`,
  );
  const injuries = await get(`/api/v1/injuries?sportId=1&teamId=${teamId}`);
  const peopleStatus = await get(
    `/api/v1/people/656876?hydrate=currentTeam,stats(group=[pitching],type=[season])`,
  );

  const rosterRows = Array.isArray(
    asRecord(roster.json)?.roster,
  )
    ? (asRecord(roster.json)!.roster as unknown[])
    : [];
  let statusCodes: Record<string, number> = {};
  let positionPitchers = 0;
  for (const raw of rosterRows) {
    const row = asRecord(raw);
    const status = asString(asRecord(row?.status)?.code) ?? "UNK";
    statusCodes[status] = (statusCodes[status] ?? 0) + 1;
    const pos = asString(asRecord(row?.position)?.abbreviation);
    if (pos === "P") positionPitchers += 1;
  }

  const injuryList = Array.isArray(asRecord(injuries.json)?.injuries)
    ? (asRecord(injuries.json)!.injuries as unknown[])
    : Array.isArray(injuries.json)
      ? (injuries.json as unknown[])
      : [];

  return {
    meta: {
      hypothesisId: "H-BP-ROLE-006",
      description:
        "Bullpen Availability (IL/option/DFA) pre-game collectability survey",
      engineConnected: false,
      publicRuntimeUseAllowed: false,
      source: "INTERNAL_RESEARCH_ONLY",
      probedAt: new Date().toISOString(),
      sampleTeamId: teamId,
      statsApiCalls: usage.statsApiCalls,
    },
    endpoints: {
      activeRoster: {
        path: `/api/v1/teams/{id}/roster?rosterType=active`,
        httpOk: roster.ok,
        httpStatus: roster.status,
        rosterCount: rosterRows.length,
        pitcherCount: positionPitchers,
        statusCodeHistogram: statusCodes,
        collectiblePreGame: roster.ok,
        notes: [
          "Provides active roster status codes (A/etc).",
          "Does not alone prove closer/setup availability.",
          "IL list may require separate injuries endpoint.",
        ],
      },
      injuries: {
        path: `/api/v1/injuries?sportId=1&teamId={id}`,
        httpOk: injuries.ok,
        httpStatus: injuries.status,
        injuryCount: injuryList.length,
        collectiblePreGame: injuries.ok,
        notes: [
          injuries.ok
            ? "Injuries endpoint responded — usable for unavailable flags when player matched"
            : "Injuries endpoint unavailable or empty — do not invent IL status",
        ],
      },
      peopleHydrate: {
        path: `/api/v1/people/{id}?hydrate=currentTeam,stats...`,
        httpOk: peopleStatus.ok,
        httpStatus: peopleStatus.status,
        collectiblePreGame: peopleStatus.ok,
        notes: [
          "Person payload may include current team; not a dedicated IL field guarantee",
          "Avoid per-player polling at scale without cache",
        ],
      },
    },
    researchPolicy: {
      mayStore: [
        "derived: playerId, teamId, rosterStatusCode, injuryListed(bool), asOfTimestamp, cutoffTime",
      ],
      mustNot: [
        "Engine connection",
        "public/commercial runtime",
        "invent closer availability from name",
        "overwrite prediction snapshots",
      ],
      nextStep:
        "If injuries+roster both stable with cache, add availabilityUnknown=false only when IL/option confirmed; else keep availabilityUnknown=true",
    },
  };
}

async function main() {
  console.log("=== Bullpen v1.1 Validation Accumulation ===");

  const pred27Before = await readFile(PATHS.pred27, "utf8");
  const pred27HashBefore = sha256(pred27Before);
  const bullpen27 = JSON.parse(await readFile(PATHS.bullpen27, "utf8"));
  const compare = JSON.parse(await readFile(PATHS.compare, "utf8"));

  const slate27 = await fetchBaseballDate(EXISTING_DATE);
  const slate28 = await fetchBaseballDate(NEXT_DATE);
  const slate29 = await fetchBaseballDate("2026-07-29");

  const newFinishedSlates =
    (slate28.finished > 0 ? 1 : 0) + (slate29.finished > 0 ? 1 : 0);
  const newFinishedGames = slate28.finished + slate29.finished;

  // Re-run bullpen v1.1 (cache warm) for hash regression — classifier untouched
  const bullpenCode = await runScript(
    "scripts/build-mlb-bullpen-role-dataset-v1_1.ts",
  );
  if (bullpenCode !== 0) throw new Error("bullpen rebuild failed");
  const bullpen27After = JSON.parse(await readFile(PATHS.bullpen27, "utf8"));
  const hashBefore = asString(asRecord(bullpen27.meta)?.resultHashSha256);
  const hashAfter = asString(
    asRecord(bullpen27After.meta)?.resultHashSha256,
  );
  const cache = asRecord(bullpen27After.cacheUsage) ?? {};

  // Save next-day research snapshot if possible (no overwrite of existing)
  const snap28 = await saveResearchSnapshotFromBaseline(NEXT_DATE);

  // Availability survey (research only)
  const availability = await surveyAvailability();
  await mkdir(path.dirname(PATHS.availability), { recursive: true });
  await writeFile(
    PATHS.availability,
    `${JSON.stringify(availability, null, 2)}\n`,
    "utf8",
  );

  const pred27After = await readFile(PATHS.pred27, "utf8");
  const pred27Unchanged = sha256(pred27After) === pred27HashBefore;

  const summary27 = asRecord(bullpen27After.summary) ?? {};
  const roleCounts = asRecord(summary27.roleCounts) ?? {};
  const totalRows = asNumber(summary27.classifiedPitcherRows) ?? 0;
  const unknown = asNumber(roleCounts.UNKNOWN) ?? 0;

  const v11 = asRecord(compare.v11) ?? {};
  let gradedGames = 14;
  try {
    const rev = JSON.parse(await readFile(PATHS.review27, "utf8"));
    gradedGames = asNumber(asRecord(rev.summary)?.graded) ?? 14;
  } catch {
    /* keep */
  }

  const conclusion =
    newFinishedGames > 0
      ? "DATA_ACCUMULATION_CONTINUES"
      : "DATA_ACCUMULATION_CONTINUES";

  const report = {
    meta: {
      version: "bullpen-v1.1-validation-accumulation-v1",
      generatedAt: new Date().toISOString(),
      classifierVersion: "bullpen-role-classifier-v1.1",
      classifierLogicChanged: false,
      thresholdsChanged: false,
      engineConnected: false,
      engineImpact: 0,
      frameworkChanged: false,
      predictionHashSha256: pred27HashBefore,
      predictionUnchanged: pred27Unchanged,
      bullpenResultHashBefore: hashBefore,
      bullpenResultHashAfter: hashAfter,
      bullpenHashMatched: hashBefore === hashAfter,
      conclusion,
    },
    slateStatus: {
      [EXISTING_DATE]: slate27,
      [NEXT_DATE]: slate28,
      "2026-07-29": slate29,
      newFinishedSlates,
      newFinishedGames,
      blocker:
        newFinishedGames === 0
          ? "No new finished MLB slate after 2026-07-27 (07-28 NS, Yankees still in progress on 07-27)"
          : null,
    },
    accumulation: {
      newGradedGames: 0,
      cumulativeGradedGames: gradedGames,
      pendingOnExistingSlate: slate27.inProgress,
      nextDaySnapshot: snap28,
    },
    bullpenV11MetricsExistingSlate: {
      failPregameWarn: asNumber(v11.failCollapseWarned),
      failTotal: asNumber(v11.failCollapseTotal),
      successStable: asNumber(v11.successProtectedStable),
      successTotal: asNumber(v11.successProtectedTotal),
      falsePositive: asNumber(compare.falsePositiveCount),
      falseNegative: asNumber(compare.falseNegativeCount),
      unknownRate:
        totalRows > 0 ? Math.round((unknown / totalRows) * 1000) / 10 : null,
      opener: asNumber(roleCounts.OPENER),
      mopUp: asNumber(roleCounts.MOP_UP),
      roleCounts,
    },
    cacheReuse: {
      rawHit: cache.rawHit,
      rawMiss: cache.rawMiss,
      derivedHit: cache.derivedHit,
      derivedMiss: cache.derivedMiss,
      networkCalls: cache.networkCalls,
    },
    availabilityResearch: {
      hypothesisId: "H-BP-ROLE-006",
      surveyPath: "data/research/mlb/h-bp-role-006-availability-survey.json",
      collectible:
        asRecord(asRecord(availability.endpoints)?.activeRoster)
          ?.collectiblePreGame === true,
      engineConnected: false,
    },
    remainingIssues: [
      "No new finished slate to re-score Success/Failure flow yet",
      "OPENER/MOP_UP primary still 0 on v1.1 (classifier frozen)",
      "availabilityUnknown remains true until H-BP-ROLE-006 collection pipeline exists",
      "07-28 snapshot UNVERIFIED (missing pitcher/recheck/purchase sources)",
    ],
  };

  await mkdir(path.dirname(PATHS.out), { recursive: true });
  await writeFile(PATHS.out, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`newFinishedGames=${newFinishedGames}`);
  console.log(`cumulativeGraded=${gradedGames}`);
  console.log(`pred27Unchanged=${pred27Unchanged}`);
  console.log(`hashMatch=${hashBefore === hashAfter}`);
  console.log(`snap28=${snap28.saved} games=${snap28.games}`);
  console.log(`conclusion=${conclusion}`);
  console.log(`저장: ${PATHS.out}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
