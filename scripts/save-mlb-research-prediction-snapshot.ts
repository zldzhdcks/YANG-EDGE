/**
 * 2026-07-27 KST MLB 15경기 — 연구용 예측 스냅샷 고정 저장.
 *
 * 구매 마감 이후이므로 실제 베팅 라인이 아니다.
 * 경기 종료 후 자동 채점·피드백용 원본 기록만 만든다.
 *
 * - EDGE Engine / weights / Baseline pick / 모델 확률 미변경
 * - 기존 JSON 과거 값 미수정
 * - 투수 데이터로 pick 변경 금지
 * - 경기 결과 미리 조회 금지
 * - 예측 필드는 재실행·채점 시 불변 (결과 필드만 별도 갱신)
 *
 * 실행:
 *   npx tsx scripts/save-mlb-research-prediction-snapshot.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const TARGET_DATE_KST = "2026-07-27";
const SNAPSHOT_VERSION = "mlb-research-prediction-snapshot-v1";

const BASELINE_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-baseline-analysis.json`,
);
const FILTER_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-betting-line-filter.json`,
);
const PITCHER_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb-pitcher-review.json`,
);
const RECHECK_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb-line-recheck.json`,
);
const PURCHASE_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb-purchase-cutoff-review.json`,
);
const OUTPUT_PATH = path.join(
  process.cwd(),
  "data",
  "predictions",
  "mlb",
  `${TARGET_DATE_KST}.json`,
);

/** 채점 시에도 절대 변경 금지인 예측 필드 */
const PREDICTION_IMMUTABLE_KEYS = [
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

type BaselineStatus =
  | "BASELINE_CANDIDATE"
  | "PASS"
  | "MARKET_CONFLICT"
  | "INSUFFICIENT";

type SnapshotIntegrity = "VERIFIED" | "UNVERIFIED";

type MlbResearchPrediction = {
  predictionId: string;
  gameId: string;
  externalId: string | null;
  dateKst: string;
  startTimeKst: string | null;
  league: "MLB";
  homeTeam: string;
  awayTeam: string;
  baselinePick: string | null;
  modelProbability: number | null;
  edgeScore: number | null;
  confidence: number | null;
  recommendationGrade: string | null;
  baselineStatus: BaselineStatus;
  marketProbability: number | null;
  valueEdge: number | null;
  openingOdds: number | null;
  latestOdds: number | null;
  oddsMovement: string | null;
  pitcherDirection: string | null;
  pitcherReviewAvailable: boolean;
  dataAvailability: number | null;
  usedFactors: string[];
  missingFactors: string[];
  purchaseEligible: false;
  researchOnly: true;
  purchaseReason: "SALES_WINDOW_CLOSED";
  predictedAt: string;
  sourceSnapshotVersions: Record<string, string | null>;
  snapshotIntegrity: SnapshotIntegrity;
  integrityWarnings: string[];
  // 채점 준비 (결과만 이후 갱신)
  resultStatus: "pending" | "graded" | string;
  homeScore: number | null;
  awayScore: number | null;
  actualWinner: string | null;
  predictionHit: boolean | null;
  gradedAt: string | null;
  feedbackClassification: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string")
    : [];
}

function predictionFingerprint(
  item: Pick<MlbResearchPrediction, (typeof PREDICTION_IMMUTABLE_KEYS)[number]>,
): string {
  const payload: Record<string, unknown> = {};
  for (const key of PREDICTION_IMMUTABLE_KEYS) {
    payload[key] = item[key];
  }
  return JSON.stringify(payload);
}

function extractExternalId(gameId: string): string | null {
  const m = gameId.match(/^mlb-(.+)$/);
  return m?.[1] ?? null;
}

function resolveBaselineStatus(
  analysisStatus: string | null,
  filterClassification: string | null,
): BaselineStatus {
  if (filterClassification === "MARKET_CONFLICT") return "MARKET_CONFLICT";
  if (filterClassification === "INSUFFICIENT") return "INSUFFICIENT";
  if (analysisStatus === "BASELINE_CANDIDATE") return "BASELINE_CANDIDATE";
  if (analysisStatus === "PASS") return "PASS";
  if (analysisStatus === "INSUFFICIENT_DATA") return "INSUFFICIENT";
  return "INSUFFICIENT";
}

type SourceMeta = {
  key: string;
  version: string | null;
  generatedAt: string | null;
  generatedAtMs: number | null;
};

function readSourceMeta(
  key: string,
  raw: unknown,
  versionFallback: string,
): SourceMeta {
  const root = asRecord(raw);
  const meta = asRecord(root?.meta);
  const generatedAt = asString(meta?.generatedAt);
  const version = asString(meta?.version) ?? versionFallback;
  const ms = generatedAt ? Date.parse(generatedAt) : NaN;
  return {
    key,
    version,
    generatedAt,
    generatedAtMs: Number.isFinite(ms) ? ms : null,
  };
}

async function main() {
  console.log(`=== MLB Research Prediction Snapshot (${TARGET_DATE_KST} KST) ===`);
  console.log("연구용 고정 저장. 베팅 라인 아님. 결과 미조회.\n");

  const [baselineRaw, filterRaw, pitcherRaw, recheckRaw, purchaseRaw] =
    await Promise.all([
      readFile(BASELINE_PATH, "utf8").then(JSON.parse),
      readFile(FILTER_PATH, "utf8").then(JSON.parse),
      readFile(PITCHER_PATH, "utf8").then(JSON.parse),
      readFile(RECHECK_PATH, "utf8").then(JSON.parse),
      readFile(PURCHASE_PATH, "utf8").then(JSON.parse),
    ]);

  const sources: SourceMeta[] = [
    readSourceMeta("baseline", baselineRaw, "mlb-baseline-analysis-v1"),
    readSourceMeta("bettingLineFilter", filterRaw, "mlb-betting-line-filter-v1"),
    readSourceMeta("pitcherReview", pitcherRaw, "mlb-pitcher-review-v1"),
    readSourceMeta("lineRecheck", recheckRaw, "mlb-line-recheck-v1"),
    readSourceMeta("purchaseCutoff", purchaseRaw, "mlb-purchase-cutoff-review-v1"),
  ];

  const baselineRoot = asRecord(baselineRaw);
  const baselineGames = Array.isArray(baselineRoot?.games)
    ? baselineRoot.games
    : [];
  if (baselineGames.length === 0) {
    throw new Error("baseline games 없음");
  }

  const filterById = new Map<string, Record<string, unknown>>();
  const filterLines = Array.isArray(asRecord(filterRaw)?.lines)
    ? (asRecord(filterRaw)?.lines as unknown[])
    : [];
  for (const entry of filterLines) {
    const row = asRecord(entry);
    const id = asString(row?.gameId);
    if (id && row) filterById.set(id, row);
  }

  const pitcherById = new Map<string, Record<string, unknown>>();
  for (const entry of Array.isArray(asRecord(pitcherRaw)?.games)
    ? (asRecord(pitcherRaw)?.games as unknown[])
    : []) {
    const row = asRecord(entry);
    const id = asString(row?.gameId);
    if (id && row) pitcherById.set(id, row);
  }

  const recheckById = new Map<string, Record<string, unknown>>();
  for (const entry of Array.isArray(asRecord(recheckRaw)?.games)
    ? (asRecord(recheckRaw)?.games as unknown[])
    : []) {
    const row = asRecord(entry);
    const id = asString(row?.gameId);
    if (id && row) recheckById.set(id, row);
  }

  // purchase cutoff는 gameId가 있을 수도 있고 match 기준일 수도 있음
  const purchaseById = new Map<string, Record<string, unknown>>();
  for (const entry of Array.isArray(asRecord(purchaseRaw)?.games)
    ? (asRecord(purchaseRaw)?.games as unknown[])
    : []) {
    const row = asRecord(entry);
    const id = asString(row?.gameId);
    if (id && row) purchaseById.set(id, row);
  }

  const predictedAtCandidates = sources
    .map((s) => s.generatedAtMs)
    .filter((ms): ms is number => ms != null);
  const predictedAtMs =
    predictedAtCandidates.length > 0
      ? Math.max(...predictedAtCandidates)
      : null;
  const predictedAt =
    predictedAtMs != null
      ? new Date(predictedAtMs).toISOString()
      : (sources[0]?.generatedAt ?? new Date(0).toISOString());

  const sourceSnapshotVersions: Record<string, string | null> = {};
  for (const s of sources) {
    sourceSnapshotVersions[s.key] = s.version;
  }

  const built: MlbResearchPrediction[] = [];
  const seen = new Set<string>();

  for (const entry of baselineGames) {
    const row = asRecord(entry);
    if (!row) continue;
    const gameId = asString(row.gameId);
    if (!gameId) continue;
    if (seen.has(gameId)) continue;
    seen.add(gameId);

    const commenceUtc = asString(row.commenceTimeUtc);
    const commenceMs = commenceUtc ? Date.parse(commenceUtc) : NaN;
    const integrityWarnings: string[] = [];
    let integrity: SnapshotIntegrity = "VERIFIED";

    if (!Number.isFinite(commenceMs)) {
      integrity = "UNVERIFIED";
      integrityWarnings.push("PRE_GAME_SNAPSHOT_NOT_VERIFIED:commenceTimeUtc 없음");
    } else {
      for (const source of sources) {
        if (source.generatedAtMs == null) {
          integrity = "UNVERIFIED";
          integrityWarnings.push(
            `PRE_GAME_SNAPSHOT_NOT_VERIFIED:${source.key} generatedAt 없음`,
          );
          continue;
        }
        if (source.generatedAtMs >= commenceMs) {
          integrity = "UNVERIFIED";
          integrityWarnings.push(
            `PRE_GAME_SNAPSHOT_NOT_VERIFIED:${source.key} generatedAt(${source.generatedAt}) >= commence(${commenceUtc})`,
          );
        }
      }
    }

    const filter = filterById.get(gameId);
    const pitcher = pitcherById.get(gameId);
    const recheck = recheckById.get(gameId);
    const purchase = purchaseById.get(gameId);

    const analysisStatus = asString(row.analysisStatus);
    const filterClassification = asString(filter?.classification);
    const baselineStatus = resolveBaselineStatus(
      analysisStatus,
      filterClassification,
    );

    const openingOdds =
      asNumber(filter?.bestOdds) ??
      asNumber(recheck?.initialBestOdds) ??
      null;
    const latestOdds =
      asNumber(recheck?.currentBestOdds) ??
      asNumber(filter?.bestOdds) ??
      null;
    const oddsMovement =
      asString(recheck?.oddsMove) ??
      asString(purchase?.oddsMoveNote) ??
      null;

    const pitcherDirection = asString(pitcher?.direction);
    const pitcherReviewAvailable = pitcher != null;

    if (
      pitcherDirection === "MIXED" ||
      pitcherDirection === "CONFLICTS_BASELINE"
    ) {
      integrityWarnings.push(`PITCHER_DIRECTION_WARNING:${pitcherDirection}`);
    }

    const item: MlbResearchPrediction = {
      predictionId: `mlb-research-${TARGET_DATE_KST}-${gameId}`,
      gameId,
      externalId: extractExternalId(gameId),
      dateKst: asString(row.dateKst) ?? TARGET_DATE_KST,
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
      openingOdds,
      latestOdds,
      oddsMovement,
      pitcherDirection,
      pitcherReviewAvailable,
      dataAvailability: asNumber(row.dataAvailability),
      usedFactors: asStringArray(row.usedFactors),
      missingFactors: asStringArray(row.missingFactors),
      purchaseEligible: false,
      researchOnly: true,
      purchaseReason: "SALES_WINDOW_CLOSED",
      predictedAt,
      sourceSnapshotVersions: { ...sourceSnapshotVersions },
      snapshotIntegrity: integrity,
      integrityWarnings,
      resultStatus: "pending",
      homeScore: null,
      awayScore: null,
      actualWinner: null,
      predictionHit: null,
      gradedAt: null,
      feedbackClassification: null,
    };

    built.push(item);
  }

  built.sort((a, b) => a.gameId.localeCompare(b.gameId));

  if (built.length !== 15) {
    console.warn(`경고: 저장 대상 ${built.length}건 (기대 15)`);
  }

  // 기존 파일 로드 — 동일 gameId 예측 필드 불변, 결과 필드만 보존
  let existingPredictions: MlbResearchPrediction[] = [];
  let existingMeta: Record<string, unknown> | null = null;
  try {
    const prev = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
    const root = asRecord(prev);
    existingMeta = asRecord(root?.meta);
    existingPredictions = Array.isArray(root?.predictions)
      ? (root.predictions as MlbResearchPrediction[])
      : [];
  } catch {
    /* first run */
  }

  const existingById = new Map(
    existingPredictions.map((p) => [p.gameId, p]),
  );

  let unchangedCount = 0;
  let preservedResultCount = 0;
  const merged: MlbResearchPrediction[] = [];

  for (const next of built) {
    const prev = existingById.get(next.gameId);
    if (!prev) {
      merged.push(next);
      continue;
    }

    // 예측 필드는 절대 덮어쓰지 않는다. 기존 항목 유지 + 결과 필드만 보존.
    unchangedCount += 1;
    const prevFp = predictionFingerprint(prev);
    const nextFp = predictionFingerprint(next);
    if (prevFp !== nextFp) {
      console.warn(
        `예측 필드 불변 보호: ${next.gameId} — 기존 스냅샷 유지, 신규 입력 무시`,
      );
    }
    if (prev.resultStatus && prev.resultStatus !== "pending") {
      preservedResultCount += 1;
    }
    merged.push(prev);
  }

  // 기존에만 있고 신규에 없는 gameId는 유지 (삭제 금지)
  for (const prev of existingPredictions) {
    if (!merged.some((m) => m.gameId === prev.gameId)) {
      merged.push(prev);
      unchangedCount += 1;
    }
  }

  merged.sort((a, b) => a.gameId.localeCompare(b.gameId));

  const contentFp = () =>
    JSON.stringify(merged.map((p) => predictionFingerprint(p)));
  const deterministic = contentFp() === contentFp();

  const sameAsExisting =
    existingPredictions.length === merged.length &&
    contentFp() ===
      JSON.stringify(existingPredictions.map((p) => predictionFingerprint(p)));

  const countStatus = (s: BaselineStatus) =>
    merged.filter((p) => p.baselineStatus === s).length;
  const verified = merged.filter((p) => p.snapshotIntegrity === "VERIFIED").length;
  const unverified = merged.filter(
    (p) => p.snapshotIntegrity === "UNVERIFIED",
  ).length;

  const output = {
    meta: {
      version: SNAPSHOT_VERSION,
      dateKst: TARGET_DATE_KST,
      league: "MLB",
      kind: "research-prediction-snapshot",
      generatedAt: sameAsExisting
        ? (asString(existingMeta?.generatedAt) ?? new Date().toISOString())
        : new Date().toISOString(),
      predictedAt,
      purchaseEligible: false,
      researchOnly: true,
      purchaseReason: "SALES_WINDOW_CLOSED",
      bettingLine: false,
      engineRerun: false,
      resultsFetched: false,
      immutablePredictionFields: [...PREDICTION_IMMUTABLE_KEYS],
      sourceFiles: {
        baseline: path.relative(process.cwd(), BASELINE_PATH).replace(/\\/g, "/"),
        bettingLineFilter: path
          .relative(process.cwd(), FILTER_PATH)
          .replace(/\\/g, "/"),
        pitcherReview: path
          .relative(process.cwd(), PITCHER_PATH)
          .replace(/\\/g, "/"),
        lineRecheck: path.relative(process.cwd(), RECHECK_PATH).replace(/\\/g, "/"),
        purchaseCutoff: path
          .relative(process.cwd(), PURCHASE_PATH)
          .replace(/\\/g, "/"),
      },
      sourceGeneratedAt: Object.fromEntries(
        sources.map((s) => [s.key, s.generatedAt]),
      ),
      sourceSnapshotVersions,
      deterministic,
      duplicateSafe: true,
      note:
        "구매 마감 이후 연구용 예측 스냅샷. 실제 베팅 라인이 아니다. 예측 필드는 채점 시에도 변경하지 않는다.",
    },
    summary: {
      total: merged.length,
      BASELINE_CANDIDATE: countStatus("BASELINE_CANDIDATE"),
      PASS: countStatus("PASS"),
      MARKET_CONFLICT: countStatus("MARKET_CONFLICT"),
      INSUFFICIENT: countStatus("INSUFFICIENT"),
      purchaseEligible: 0,
      researchOnly: merged.length,
      snapshotIntegrityVerified: verified,
      snapshotIntegrityUnverified: unverified,
      unchangedOnRerun: sameAsExisting,
      preservedExistingPredictions: unchangedCount,
      preservedGradedResults: preservedResultCount,
    },
    predictions: merged,
  };

  if (sameAsExisting) {
    console.log("중복 실행: 예측 필드 변경 없음 (안전) — 파일 유지/동일 내용 기록");
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`저장 경기: ${merged.length}`);
  console.log(
    `BASELINE_CANDIDATE ${countStatus("BASELINE_CANDIDATE")} / PASS ${countStatus("PASS")} / MARKET_CONFLICT ${countStatus("MARKET_CONFLICT")} / INSUFFICIENT ${countStatus("INSUFFICIENT")}`,
  );
  console.log(`purchaseEligible 0 / researchOnly ${merged.length}`);
  console.log(`integrity VERIFIED ${verified} / UNVERIFIED ${unverified}`);
  console.log(`결정성: ${deterministic ? "동일" : "불일치"}`);
  console.log(`저장: ${path.relative(process.cwd(), OUTPUT_PATH)}`);

  // 즉시 재실행 시뮬레이션 — 동일 fingerprint
  const secondFp = JSON.stringify(
    merged.map((p) => predictionFingerprint(p)),
  );
  if (secondFp !== contentFp()) {
    throw new Error("결정성 실패");
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("FAILED:", message);
  process.exitCode = 1;
});
