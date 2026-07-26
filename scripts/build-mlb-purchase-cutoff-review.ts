/**
 * 2026-07-27 KST MLB 관찰 라인 — 국내 구매 가능 시간(배트맨 08:00~23:00 KST) 반영.
 *
 * 시간 정책과 최종 재확인 스케줄만 수정한다.
 * EDGE Engine·Baseline pick·모델 확률·Value Edge·기존 FINAL 분류 로직은 변경하지 않는다.
 *
 * 새벽 MLB 경기(01:15~03:10)는 전날 23:00 이전에 최종 분류해야 하므로
 * 기존 재확인 시각(01:10/01:40/05:20 등)은 구매용 시각으로 사용하지 않는다.
 *
 * 실행:
 *   npx tsx scripts/build-mlb-purchase-cutoff-review.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  computePurchaseSchedule,
  DECISION_COMPLETE_DEADLINE_KST,
  formatKstDateTime,
  PURCHASE_WINDOW_CLOSE_KST,
  PURCHASE_WINDOW_OPEN_KST,
  RECOMMENDED_FINAL_REVIEW_KST,
  type PurchaseSchedule,
} from "../src/lib/betting/purchase-window";

const TARGET_DATE_KST = "2026-07-27";

const FINAL_LINES_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb-final-lines.json`,
);
const RECHECK_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb-line-recheck.json`,
);
const WATCHLIST_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb.json`,
);
const OUTPUT_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb-purchase-cutoff-review.json`,
);

type PurchaseClass = "PURCHASE_REVIEW" | "PURCHASE_HOLD" | "PURCHASE_DROP";

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

type FinalLineGame = {
  gameId: string;
  match: string;
  baselinePick: string | null;
  classification: string;
  classificationReasons: string[];
  lineupStatus: string | null;
  starterStatus: string | null;
  pitcherDirection: string | null;
  latestBestOdds: number | null;
  currentValueEdge: number | null;
  carriedForward: boolean;
};

function loadFinalLines(raw: unknown): FinalLineGame[] {
  const root = asRecord(raw);
  const games = Array.isArray(root?.games) ? root.games : [];
  return games
    .map((entry) => {
      const row = asRecord(entry);
      const gameId = asString(row?.gameId);
      if (!row || !gameId) return null;
      return {
        gameId,
        match: asString(row.match) ?? "",
        baselinePick: asString(row.baselinePick),
        classification: asString(row.classification) ?? "",
        classificationReasons: Array.isArray(row.classificationReasons)
          ? row.classificationReasons.filter(
              (x): x is string => typeof x === "string",
            )
          : [],
        lineupStatus: asString(row.lineupStatus),
        starterStatus: asString(row.starterStatus),
        pitcherDirection: asString(row.pitcherDirection),
        latestBestOdds: asNumber(row.latestBestOdds),
        currentValueEdge: asNumber(row.currentValueEdge),
        carriedForward: row.carriedForward === true,
      } satisfies FinalLineGame;
    })
    .filter((g): g is FinalLineGame => g != null);
}

/** "YYYY-MM-DD HH:mm KST" → ms */
function parseKstLabel(label: string | null): number | null {
  if (!label) return null;
  const m = label.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) KST$/);
  if (!m) return null;
  const ms = Date.parse(`${m[1]}T${m[2]}:00+09:00`);
  return Number.isFinite(ms) ? ms : null;
}

function loadIdealRechecks(raw: unknown): Map<string, number | null> {
  const root = asRecord(raw);
  const games = Array.isArray(root?.games) ? root.games : [];
  const map = new Map<string, number | null>();
  for (const entry of games) {
    const row = asRecord(entry);
    const gameId = asString(row?.gameId);
    if (!gameId) continue;
    const recheck = asRecord(row?.recheck);
    map.set(gameId, parseKstLabel(asString(recheck?.recommendedRecheckAtKst)));
  }
  return map;
}

function loadStartTimes(raw: unknown): Map<string, string> {
  const root = asRecord(raw);
  const games = Array.isArray(root?.games) ? root.games : [];
  const map = new Map<string, string>();
  for (const entry of games) {
    const row = asRecord(entry);
    const gameId = asString(row?.gameId);
    const startTimeKst = asString(row?.startTimeKst);
    if (gameId && startTimeKst && /^\d{2}:\d{2}/.test(startTimeKst)) {
      map.set(gameId, startTimeKst.slice(0, 5));
    }
  }
  return map;
}

function classifyPurchase(
  final: FinalLineGame,
  schedule: PurchaseSchedule,
): { classification: PurchaseClass; reasons: string[] } {
  // 구매 마감 경과 → DROP (사후 연구용)
  if (schedule.status === "NO_PURCHASE_WINDOW") {
    return {
      classification: "PURCHASE_DROP",
      reasons: [
        "구매 판단 마감 경과 — 사후 연구용 (researchOnly)",
        `기존 분류 ${final.classification} 참고: ${final.classificationReasons.join("; ") || "없음"}`,
      ],
    };
  }
  if (final.classification === "FINAL_OBSERVE") {
    return {
      classification: "PURCHASE_REVIEW",
      reasons: [
        "기존 FINAL_OBSERVE 조건 충족",
        "구매 가능 시간 내 판단 가능",
        "확정 추천·수익 보장 아님",
      ],
    };
  }
  if (final.classification === "FINAL_HOLD") {
    return {
      classification: "PURCHASE_HOLD",
      reasons: final.classificationReasons.length
        ? final.classificationReasons
        : ["기존 FINAL_HOLD"],
    };
  }
  return {
    classification: "PURCHASE_DROP",
    reasons: final.classificationReasons.length
      ? final.classificationReasons
      : ["기존 FINAL_DROP"],
  };
}

async function main() {
  console.log(`=== MLB Purchase Cutoff Review (${TARGET_DATE_KST} KST) ===`);
  console.log(
    `구매 가능 ${PURCHASE_WINDOW_OPEN_KST}~${PURCHASE_WINDOW_CLOSE_KST} KST. Engine·pick·모델 확률 미변경.\n`,
  );

  const finalRaw = JSON.parse(await readFile(FINAL_LINES_PATH, "utf8"));
  const recheckRaw = JSON.parse(await readFile(RECHECK_PATH, "utf8"));
  const watchRaw = JSON.parse(await readFile(WATCHLIST_PATH, "utf8"));

  const finalGames = loadFinalLines(finalRaw);
  const idealMap = loadIdealRechecks(recheckRaw);
  const startMap = loadStartTimes(watchRaw);

  if (finalGames.length === 0) throw new Error("final-lines games 없음");

  const nowMs = Date.now();

  const buildAll = () =>
    finalGames.map((final) => {
      const startTime = startMap.get(final.gameId);
      if (!startTime) {
        throw new Error(`startTimeKst 없음: ${final.gameId}`);
      }
      const lineupUnavailable =
        final.lineupStatus == null
          ? null
          : final.lineupStatus !== "LINEUP_COMPLETE";
      const schedule = computePurchaseSchedule({
        gameDateKst: TARGET_DATE_KST,
        gameStartTimeKst: startTime,
        idealRecheckMs: idealMap.get(final.gameId) ?? null,
        nowMs,
        lineupUnavailableBeforeCutoff: lineupUnavailable,
      });
      const purchase = classifyPurchase(final, schedule);
      return {
        gameId: final.gameId,
        match: final.match,
        baselinePick: final.baselinePick,
        finalClassification: final.classification,
        purchaseClassification: purchase.classification,
        purchaseReasons: purchase.reasons,
        latestBestOdds: final.latestBestOdds,
        currentValueEdge: final.currentValueEdge,
        starterStatus: final.starterStatus,
        pitcherDirection: final.pitcherDirection,
        lineupStatus: final.lineupStatus,
        schedule,
      };
    });

  const first = buildAll();
  const second = buildAll();
  const fingerprint = (rows: ReturnType<typeof buildAll>) =>
    JSON.stringify(
      rows.map((r) => ({
        gameId: r.gameId,
        purchase: r.purchaseClassification,
        status: r.schedule.status,
        review: r.schedule.purchaseFinalReviewKst,
        deadline: r.schedule.finalActionDeadlineKst,
        flags: r.schedule.flags,
      })),
    );
  const deterministic = fingerprint(first) === fingerprint(second);

  // ── 검증 ──────────────────────────────────────────────
  const errors: string[] = [];
  for (const row of first) {
    const s = row.schedule;
    // 새벽 경기 구매용 조회가 다음 날 01시 이후로 나오지 않아야 함
    const reviewMs = parseKstLabel(s.purchaseFinalReviewKst);
    if (reviewMs != null && reviewMs > s.purchaseCutoffMs) {
      errors.push(`${row.gameId}: 구매용 조회가 23:00 이후 (${s.purchaseFinalReviewKst})`);
    }
    // 모든 구매용 판단 시각이 결정일 23:00 이전
    if (s.finalActionDeadlineMs > s.purchaseCutoffMs) {
      errors.push(`${row.gameId}: 판단 마감이 구매 마감 이후`);
    }
    // 23:00 이후 조회는 researchOnly=true
    if (nowMs > s.purchaseCutoffMs && !s.researchOnly) {
      errors.push(`${row.gameId}: 마감 경과인데 researchOnly=false`);
    }
    // 공식 발매 마감 미확인 경고
    if (!s.flags.includes("OFFICIAL_CLOSE_UNVERIFIED")) {
      errors.push(`${row.gameId}: OFFICIAL_CLOSE_UNVERIFIED 누락`);
    }
    if (s.officialCloseVerified !== false || s.officialSalesCloseKst !== null) {
      errors.push(`${row.gameId}: 공식 마감 필드 불일치`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`검증 실패:\n${errors.join("\n")}`);
  }

  const count = (c: PurchaseClass) =>
    first.filter((r) => r.purchaseClassification === c).length;
  const review = first.filter(
    (r) => r.purchaseClassification === "PURCHASE_REVIEW",
  );
  const lineupIssues = first.filter((r) =>
    r.schedule.flags.includes("LINEUP_UNAVAILABLE_BEFORE_PURCHASE_CUTOFF"),
  );

  const output = {
    meta: {
      version: "mlb-purchase-cutoff-review-v1",
      generatedAt: new Date(nowMs).toISOString(),
      generatedAtKst: formatKstDateTime(nowMs),
      targetDateKst: TARGET_DATE_KST,
      kind: "purchase-cutoff-review",
      timeZone: "Asia/Seoul",
      engineRerun: false,
      baselinePickChanged: false,
      modelProbabilityChanged: false,
      finalClassificationLogicChanged: false,
      inputs: {
        finalLines: path
          .relative(process.cwd(), FINAL_LINES_PATH)
          .replace(/\\/g, "/"),
        lineRecheck: path.relative(process.cwd(), RECHECK_PATH).replace(/\\/g, "/"),
        watchlist: path.relative(process.cwd(), WATCHLIST_PATH).replace(/\\/g, "/"),
      },
      purchasePolicy: {
        openKst: PURCHASE_WINDOW_OPEN_KST,
        closeKst: PURCHASE_WINDOW_CLOSE_KST,
        recommendedFinalReviewKst: RECOMMENDED_FINAL_REVIEW_KST,
        decisionCompleteDeadlineKst: DECISION_COMPLETE_DEADLINE_KST,
        officialSalesCloseKst: null,
        officialCloseVerified: false,
        officialCloseNote:
          "실제 Betman 회차 마감 데이터 미연결 — 회차별 공식 발매 마감을 확인하지 못함. 23:00까지 무조건 구매 가능하다고 단정하지 않는다.",
        dawnGameRule:
          "새벽 경기는 전날 23:00 이전에 최종 분류. 기존 01:10/01:40/05:20 재확인 시각은 구매용으로 사용 금지.",
        afterCutoffRule:
          "23:00 이후 데이터는 사후 연구용(researchOnly)이며 구매 결정에 사용하지 않는다.",
      },
      deterministic,
    },
    userFacing: {
      purchaseDecisionDeadline: `국내 구매 판단 마감: ${DECISION_COMPLETE_DEADLINE_KST} KST`,
      salesCloseBasis: `판매 종료 기준: ${PURCHASE_WINDOW_CLOSE_KST} KST`,
      officialCloseWarning: "공식 회차별 마감 미확인",
      afterCutoffNote: "마감 이후 변경 데이터는 참고용",
      emptyLineMessage:
        review.length === 0
          ? "구매 가능 시간 내 기준을 충족한 MLB 라인이 없습니다."
          : null,
    },
    summary: {
      totalGames: first.length,
      PURCHASE_REVIEW: count("PURCHASE_REVIEW"),
      PURCHASE_HOLD: count("PURCHASE_HOLD"),
      PURCHASE_DROP: count("PURCHASE_DROP"),
      statusCounts: {
        DECISION_BEFORE_CUTOFF: first.filter(
          (r) => r.schedule.status === "DECISION_BEFORE_CUTOFF",
        ).length,
        EARLY_DECISION_REQUIRED: first.filter(
          (r) => r.schedule.status === "EARLY_DECISION_REQUIRED",
        ).length,
        NO_PURCHASE_WINDOW: first.filter(
          (r) => r.schedule.status === "NO_PURCHASE_WINDOW",
        ).length,
      },
      lineupUnavailableBeforeCutoff: lineupIssues.map((r) => ({
        gameId: r.gameId,
        match: r.match,
        lineupStatus: r.lineupStatus,
      })),
      officialCloseUnverifiedAllGames: true,
    },
    games: first,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`현재 시각: ${formatKstDateTime(nowMs)}`);
  console.log(
    `PURCHASE_REVIEW ${count("PURCHASE_REVIEW")} / HOLD ${count("PURCHASE_HOLD")} / DROP ${count("PURCHASE_DROP")}`,
  );
  if (review.length === 0) {
    console.log("구매 가능 시간 내 기준을 충족한 MLB 라인이 없습니다.");
  }
  console.log("");
  for (const r of first) {
    const s = r.schedule;
    console.log(
      `${r.match}\n` +
        `  시작 ${s.gameStartKst} | 구매조회 ${s.purchaseFinalReviewKst} | 판단마감 ${s.finalActionDeadlineKst}` +
        ` (${s.minutesBeforeGameAtDeadline}분 전)\n` +
        `  ${s.status} | ${r.finalClassification} → ${r.purchaseClassification}` +
        ` | researchOnly=${s.researchOnly} | flags=${s.flags.join(",")}`,
    );
  }
  console.log(`\n공식 발매 마감: 미확인 (officialCloseVerified=false, 전 경기 경고)`);
  console.log(`결정성: ${deterministic ? "동일" : "불일치"}`);
  console.log(`저장: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("FAILED:", message);
  process.exitCode = 1;
});
