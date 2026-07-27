import { NextResponse } from "next/server";
import { loadTodayEdgePicks } from "@/lib/api/today-edge-picks";

export const dynamic = "force-dynamic";

/**
 * GET /api/today-edge-picks
 *
 * Research snapshot 기반 TODAY EDGE PICK (최대 3경기).
 * Prediction / Engine 점수는 변경하지 않는다.
 */
export async function GET() {
  const loaded = await loadTodayEdgePicks();

  if (loaded.status === "success") {
    const { meta, picks, excluded } = loaded.result;
    return NextResponse.json(
      {
        status: "success",
        targetDateKst: meta.targetDateKst,
        generatedAt: meta.generatedAt,
        slateStatus: meta.slateStatus,
        nextScheduledDateKst: meta.nextScheduledDateKst,
        selectedCount: meta.selectedCount,
        strictSelectedCount: meta.strictSelectedCount,
        researchCandidateCount: meta.researchCandidateCount,
        selectionMode: meta.selectionMode,
        candidateCount: meta.candidateCount,
        excludedCount: meta.excludedCount,
        strictExclusionCounts: meta.strictExclusionCounts,
        predictionHashSha256: meta.predictionHashSha256,
        picks,
        excluded,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  if (loaded.status === "empty") {
    const { meta, picks, excluded } = loaded.result;
    return NextResponse.json(
      {
        status: "empty",
        message: loaded.message,
        targetDateKst: meta.targetDateKst || null,
        generatedAt: meta.generatedAt,
        slateStatus: meta.slateStatus,
        nextScheduledDateKst: meta.nextScheduledDateKst,
        selectedCount: meta.selectedCount,
        strictSelectedCount: meta.strictSelectedCount,
        researchCandidateCount: meta.researchCandidateCount,
        selectionMode: meta.selectionMode,
        candidateCount: meta.candidateCount,
        excludedCount: meta.excludedCount,
        strictExclusionCounts: meta.strictExclusionCounts,
        predictionHashSha256: meta.predictionHashSha256,
        picks,
        excluded,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    {
      status: "error",
      message: loaded.message,
    },
    {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
