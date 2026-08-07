import { getKstToday } from "@/lib/datetime/kst";
import { loadResearchLabData } from "@/lib/internal/research-lab-reader";
import { buildOperatorPresentation } from "@/lib/internal/research-lab-presenter";
import { buildYangEdgeOsPresentation } from "@/lib/internal/yang-edge-os-presenter";
import { loadOperationMemoryV0 } from "@/lib/internal/operation-memory-v0";
import { assessMlbPredictionContinuity } from "@/lib/mlb/prediction-continuity-guard-v1";
import {
  assessMlbDailyOpsDay,
  assessRecentMlbDailyOpsDays,
} from "@/lib/mlb/daily-ops-v1";

function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
}

function addDaysKst(dateKst: string, delta: number): string {
  const [y, m, d] = dateKst.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export async function resolveOsDate(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<string> {
  const dateParam =
    typeof searchParams.date === "string" ? searchParams.date.trim() : "";
  return isValidDate(dateParam) ? dateParam : getKstToday();
}

export async function loadYangEdgeOsPage(dateKst: string) {
  const data = await loadResearchLabData(dateKst);
  const op = buildOperatorPresentation(data);
  const continuity = await assessMlbPredictionContinuity({ dateKst });
  const recentDates = [
    addDaysKst(dateKst, -2),
    addDaysKst(dateKst, -1),
    dateKst,
  ];
  const [mlbDailyOpsDay, mlbDailyOpsRecent] = await Promise.all([
    assessMlbDailyOpsDay({ dateKst, sealDeliveryRecord: false }),
    assessRecentMlbDailyOpsDays({ dates: recentDates }),
  ]);
  const os = buildYangEdgeOsPresentation(data, op, {
    continuity,
    mlbDailyOpsDay,
    mlbDailyOpsRecent,
  });
  const memory = await loadOperationMemoryV0({ dateKst, os });
  return { data, op, os, memory, dateKst, continuity, mlbDailyOpsDay };
}
