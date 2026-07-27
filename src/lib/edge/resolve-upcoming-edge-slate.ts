import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getKstDateString } from "@/lib/datetime/kst";
import { isUpcomingGame } from "@/lib/edge/game-upcoming";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

const DAILY_PREDICTION = /^\d{4}-\d{2}-\d{2}\.json$/;

export type EdgeSlateStatus =
  | "UPCOMING"
  | "NO_UPCOMING_SNAPSHOT"
  | "NO_ELIGIBLE_PICKS";

export type ResolvedUpcomingEdgeSlate = {
  targetDateKst: string | null;
  nextScheduledDateKst: string | null;
  upcomingGameCount: number;
  slateStatus: EdgeSlateStatus;
  availableDates: string[];
};

async function listPredictionDates(): Promise<string[]> {
  const dir = path.join(/*turbopackIgnore: true*/ process.cwd(), "data/predictions/mlb");
  try {
    const names = await readdir(dir);
    return names
      .filter((n) => DAILY_PREDICTION.test(n))
      .map((n) => n.replace(".json", ""))
      .sort();
  } catch {
    return [];
  }
}

async function countUpcomingGamesOnDate(
  dateKst: string,
  nowMs: number,
): Promise<number> {
  const rel = `data/predictions/mlb/${dateKst}.json`;
  let raw: string;
  try {
    raw = await readFile(
      path.join(/*turbopackIgnore: true*/ process.cwd(), rel),
      "utf8",
    );
  } catch {
    return 0;
  }

  const doc = asRecord(JSON.parse(raw));
  if (!doc) return 0;
  const preds = Array.isArray(doc.predictions) ? doc.predictions : [];
  let count = 0;
  for (const row of preds) {
    const pred = asRecord(row);
    if (!pred) continue;
    const gameDate = asString(pred.dateKst) ?? dateKst;
    const startTime = asString(pred.startTimeKst) ?? "";
    const resultStatus = asString(pred.resultStatus) ?? "pending";
    if (
      isUpcomingGame({
        dateKst: gameDate,
        startTimeKst: startTime,
        resultStatus,
        nowMs,
      })
    ) {
      count += 1;
    }
  }
  return count;
}

export type ResolveUpcomingEdgeSlateOptions = {
  now?: Date;
  /** 연구 verification script 전용 — runtime 홈/API에서는 사용하지 않는다 */
  forceDateKst?: string;
};

/**
 * Runtime 홈/API: 현재 KST 이후 시작하는 경기가 있는 가장 가까운 snapshot 날짜.
 * 과거 snapshot fallback 금지. MLB_TARGET_DATE_KST도 종료 슬레이트면 무시(호출측).
 */
export async function resolveUpcomingEdgeSlate(
  options: ResolveUpcomingEdgeSlateOptions = {},
): Promise<ResolvedUpcomingEdgeSlate> {
  const nowMs = (options.now ?? new Date()).getTime();
  const todayKst = getKstDateString(options.now ?? new Date());
  const availableDates = await listPredictionDates();

  if (options.forceDateKst) {
    const forced = options.forceDateKst.trim();
    const upcomingGameCount = await countUpcomingGamesOnDate(forced, nowMs);
    const nextScheduledDateKst =
      upcomingGameCount > 0
        ? forced
        : await findNextScheduledSnapshotDate(options.now);
    return {
      targetDateKst: upcomingGameCount > 0 ? forced : null,
      nextScheduledDateKst,
      upcomingGameCount,
      slateStatus:
        upcomingGameCount > 0 ? "UPCOMING" : "NO_UPCOMING_SNAPSHOT",
      availableDates,
    };
  }

  const futureDates = availableDates.filter((d) => d >= todayKst);

  for (const dateKst of futureDates) {
    const upcomingGameCount = await countUpcomingGamesOnDate(dateKst, nowMs);
    if (upcomingGameCount > 0) {
      return {
        targetDateKst: dateKst,
        nextScheduledDateKst: dateKst,
        upcomingGameCount,
        slateStatus: "UPCOMING",
        availableDates,
      };
    }
  }

  const nextScheduledDateKst = await findNextScheduledSnapshotDate(options.now);

  return {
    targetDateKst: null,
    nextScheduledDateKst,
    upcomingGameCount: 0,
    slateStatus: "NO_UPCOMING_SNAPSHOT",
    availableDates,
  };
}

/** nextScheduledDateKst with actual upcoming count check */
export async function findNextScheduledSnapshotDate(
  now?: Date,
): Promise<string | null> {
  const nowMs = (now ?? new Date()).getTime();
  const todayKst = getKstDateString(now ?? new Date());
  const dates = await listPredictionDates();
  for (const dateKst of dates) {
    if (dateKst < todayKst) continue;
    const count = await countUpcomingGamesOnDate(dateKst, nowMs);
    if (count > 0) return dateKst;
  }
  return null;
}
