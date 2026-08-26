import type { Metadata } from "next";
import OsShell from "@/components/internal/os/OsShell";
import ResearchAnalysisViewer from "@/components/analysis/ResearchAnalysisViewer";
import SampleAnalysisNotice from "@/components/home/SampleAnalysisNotice";
import { buildGamesBackPath, isValidKstDateString } from "@/lib/datetime/games-date";
import { getKstToday } from "@/lib/datetime/kst";
import { loadResearchAnalysisView } from "@/lib/research/load-research-analysis-view";

type PageProps = {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ fromDate?: string; date?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { gameId } = await params;
  const view = await loadResearchAnalysisView(gameId);
  const titleBase =
    view.gameInfo.availability === "COLLECTED"
      ? view.gameInfo.matchLabel
      : gameId;

  return {
    title: `${titleBase} · 경기 연구 상세 | YANG EDGE OS`,
    robots: { index: false, follow: false },
  };
}

export default async function InternalResearchGamePage({
  params,
  searchParams,
}: PageProps) {
  const { gameId } = await params;
  const query = await searchParams;
  const dateParam = query.date ?? query.fromDate;
  const dateKst =
    dateParam && isValidKstDateString(dateParam) ? dateParam : getKstToday();
  const view = await loadResearchAnalysisView(gameId);
  const gamesBackHref = buildGamesBackPath(
    query.fromDate,
    view.gameInfo.dateKst ?? dateKst,
  );
  const publicHref = `/analysis/${encodeURIComponent(gameId)}${
    query.fromDate
      ? `?fromDate=${encodeURIComponent(query.fromDate)}`
      : dateKst
        ? `?fromDate=${encodeURIComponent(dateKst)}`
        : ""
  }`;

  return (
    <OsShell
      active="research"
      dateKst={view.gameInfo.dateKst ?? dateKst}
      title="경기 연구 상세"
      subtitle="연구 증거 · 데이터 상태"
    >
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <a
          href={`/internal/research?date=${encodeURIComponent(dateKst)}`}
          className="text-sky-400 hover:underline"
        >
          ← 연구실
        </a>
        <span className="text-zinc-600">·</span>
        <a href={publicHref} className="text-sky-400 hover:underline">
          공개 분석 보기
        </a>
      </div>
      <SampleAnalysisNotice />
      <ResearchAnalysisViewer view={view} gamesBackHref={gamesBackHref} />
    </OsShell>
  );
}
