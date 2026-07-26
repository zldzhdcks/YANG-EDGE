import { NextResponse } from "next/server";
import { loadTodayPick } from "@/lib/api/today-pick";

/**
 * GET /api/today-pick
 *
 * 응답 본문 공통: { status, data, message?, provider }
 * - success (200): data = TodayPickData
 * - empty-games | empty-pick (200): 정상 빈 상태, data = null
 * - error (502|503): 외부 API/네트워크 오류, data = null
 *
 * 빈 상태와 오류를 동일 응답으로 섞지 않는다. Dummy 자동 대체 없음.
 */
export async function GET() {
  const result = await loadTodayPick();

  if (result.status === "success") {
    return NextResponse.json(
      {
        status: "success",
        data: result.pick,
        provider: result.providerKind,
      },
      { status: 200 },
    );
  }

  if (result.status === "empty-games") {
    return NextResponse.json(
      {
        status: "empty-games",
        data: null,
        provider: result.providerKind,
        message: "오늘 등록된 경기 일정이 없습니다.",
      },
      { status: 200 },
    );
  }

  if (result.status === "empty-pick") {
    return NextResponse.json(
      {
        status: "empty-pick",
        data: null,
        provider: result.providerKind,
        message: "오늘은 추천 기준을 충족한 경기가 없습니다.",
      },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      status: "error",
      data: null,
      provider: result.providerKind,
      message: result.message,
    },
    { status: result.httpStatus },
  );
}
