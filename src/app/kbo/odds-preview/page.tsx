import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Card from "@/components/ui/Card";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  kboOddsDebugPass,
  loadKboOddsComparisonViewModel,
} from "@/lib/kbo/odds-ui/load-kbo-odds-ui-view";
import { loadKboOddsComparisonDocument } from "@/lib/kbo/odds-comparison/load-kbo-odds-comparison";
import KboOddsComparisonCard from "@/components/kbo/KboOddsComparisonCard";

export const metadata: Metadata = {
  title: "KBO 국내·해외 배당 | YANG EDGE",
  description:
    "운영자 입력 국내 배당과 해외 Provider 배당의 단순 비교입니다. 추천·구매 지시가 아닙니다.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DEFAULT_TARGET_DATE = "2026-07-31";

type PreviewRow = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  domesticLabel: string;
  overseasLabel: string;
  domesticHome: number | null;
  domesticAway: number | null;
  overseasHome: number | null;
  overseasAway: number | null;
  domesticPass: boolean;
  overseasPass: boolean;
};

async function loadPreviewRows(dateKst: string): Promise<PreviewRow[]> {
  const document = await loadKboOddsComparisonDocument(dateKst);
  if (document?.rows?.length) {
    return document.rows.map((row) => {
      const domHome =
        row.domestic?.selections?.find((s) => s.selectionCode === "HOME")?.odds ??
        null;
      const domAway =
        row.domestic?.selections?.find((s) => s.selectionCode === "AWAY")?.odds ??
        null;
      const ovsHome =
        row.overseas?.selections?.find((s) => s.selectionCode === "HOME")?.odds ??
        null;
      const ovsAway =
        row.overseas?.selections?.find((s) => s.selectionCode === "AWAY")?.odds ??
        null;
      return {
        gameId: row.gameId,
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        domesticLabel: "국내 프로토 — 관리자 입력",
        overseasLabel: "해외 시장 · API",
        domesticHome: domHome,
        domesticAway: domAway,
        overseasHome: ovsHome,
        overseasAway: ovsAway,
        domesticPass: domHome != null && domAway != null,
        overseasPass: ovsHome != null && ovsAway != null,
      };
    });
  }

  const identityPath = path.join(
    process.cwd(),
    "data/research/kbo",
    `${dateKst}-schedule-result-identity-v1-api-baseball.json`,
  );
  let rows: Array<Record<string, unknown>> = [];
  try {
    const doc = JSON.parse(await readFile(identityPath, "utf8")) as {
      rows?: Array<Record<string, unknown>>;
    };
    rows = Array.isArray(doc.rows) ? doc.rows : [];
  } catch {
    return [];
  }

  const out: PreviewRow[] = [];
  for (const raw of rows) {
    const home = raw.homeTeam as Record<string, unknown> | undefined;
    const away = raw.awayTeam as Record<string, unknown> | undefined;
    const time = raw.time as Record<string, unknown> | undefined;
    const gameId = String(raw.internalGameId ?? raw.gameId ?? "");
    const homeTeam = String(home?.canonicalNameKo ?? home?.providerName ?? "");
    const awayTeam = String(away?.canonicalNameKo ?? away?.providerName ?? "");
    if (!gameId || !homeTeam || !awayTeam) continue;
    const vm = await loadKboOddsComparisonViewModel({
      dateKst,
      gameId,
      homeTeam,
      awayTeam,
      scheduledStartTime:
        typeof time?.startTimeKst === "string" ? time.startTimeKst : null,
    });
    out.push({
      gameId,
      homeTeam: vm.homeTeam,
      awayTeam: vm.awayTeam,
      domesticLabel: vm.domestic.sourceLabel,
      overseasLabel: vm.overseas.sourceLabel,
      domesticHome: vm.domestic.homePrice,
      domesticAway: vm.domestic.awayPrice,
      overseasHome: vm.overseas.homePrice,
      overseasAway: vm.overseas.awayPrice,
      domesticPass: kboOddsDebugPass(vm.domestic),
      overseasPass: kboOddsDebugPass(vm.overseas),
    });
  }
  return out;
}

export default async function KboOddsPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const targetDate =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : DEFAULT_TARGET_DATE;
  const document = await loadKboOddsComparisonDocument(targetDate);
  const previewRows = await loadPreviewRows(targetDate);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 space-y-2">
          <p className="text-sm font-medium text-zinc-400">KBO 국내·해외 배당</p>
          <h1 className="text-2xl font-semibold text-white">
            KBO 시장 배당 비교
          </h1>
          <p className="max-w-3xl text-sm text-zinc-400">
            운영자 입력 국내 배당과 해외 Provider 배당의 단순 비교입니다.
            추천·구매 지시가 아닙니다.
          </p>
        </div>

        {previewRows.length === 0 ? (
          <Card padding="md">
            <p className="text-sm text-zinc-400">
              배당 비교 artifact가 없습니다. 먼저{" "}
              <code>{`npm run research:kbo-odds-comparison -- ${targetDate}`}</code>
              {" "}를 실행하세요. (또는 domestic-proto / odds-history primary 확인)
            </p>
          </Card>
        ) : document?.rows?.length ? (
          <div className="space-y-4">
            {document.rows.map((row) => (
              <KboOddsComparisonCard key={row.gameId} row={row} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {previewRows.map((row) => (
              <Card key={row.gameId} padding="md">
                <p className="text-sm font-medium text-white">
                  {row.awayTeam} @ {row.homeTeam}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{row.gameId}</p>
                <div className="mt-3 space-y-2 text-sm tabular-nums text-zinc-300">
                  <div>
                    <p className="text-xs text-zinc-500">{row.domesticLabel}</p>
                    <p>
                      {row.homeTeam} {row.domesticHome ?? "—"}
                      <span className="mx-1.5 text-zinc-600">·</span>
                      {row.awayTeam} {row.domesticAway ?? "—"}
                    </p>
                    <p className="text-[11px] text-zinc-600">
                      {row.domesticPass ? "AVAILABLE" : "MISSING/PARTIAL"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">{row.overseasLabel}</p>
                    <p>
                      {row.homeTeam} {row.overseasHome ?? "—"}
                      <span className="mx-1.5 text-zinc-600">·</span>
                      {row.awayTeam} {row.overseasAway ?? "—"}
                    </p>
                    <p className="text-[11px] text-zinc-600">
                      {row.overseasPass ? "AVAILABLE" : "MISSING/PARTIAL"}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
