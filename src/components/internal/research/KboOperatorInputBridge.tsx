"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type GameView = {
  internalGameId: string;
  providerGameId: string | null;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  startTimeKst: string | null;
  domesticHomeOdds: string;
  domesticAwayOdds: string;
  overseasHomeOdds: string;
  overseasAwayOdds: string;
  oddsSourceNote: string;
  oddsConfirmed: boolean;
  homeStarter: string | null;
  awayStarter: string | null;
  homeLineupStatus: string;
  awayLineupStatus: string;
  homeLineupPaste: string;
  awayLineupPaste: string;
  homeLineupSourceNote: string;
  awayLineupSourceNote: string;
  homeLineupParsedCount: number;
  awayLineupParsedCount: number;
};

export type BridgeData = {
  dateKst: string;
  schedulePath: string | null;
  marketsPath: string;
  lineupPath: string;
  scheduleExists: boolean;
  games: GameView[];
  inputStatus: {
    domestic: "PASS" | "PARTIAL" | "MISSING";
    overseas: "PASS" | "PARTIAL" | "MISSING";
    lineup: "PASS" | "PARTIAL" | "MISSING";
  };
  builderCommand: string;
};

type SaveResponse = {
  ok: boolean;
  path: string | null;
  savedAtKst: string | null;
  status: "PASS" | "PARTIAL" | "FAIL";
  message: string;
  errors: string[];
};

function parseLineupPaste(text: string): { parsedCount: number; invalidLines: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let parsedCount = 0;
  const invalidLines: string[] = [];
  for (const line of lines) {
    const match = line.match(/^(\d{1,2})[.)]?\s+(.+?)(?:\s+([^\s].*))?$/u);
    if (!match) {
      invalidLines.push(line);
      continue;
    }
    const slot = Number(match[1]);
    if (!Number.isInteger(slot) || slot < 1 || slot > 9) {
      invalidLines.push(line);
      continue;
    }
    parsedCount += 1;
  }
  return { parsedCount, invalidLines };
}

function statusTone(status: string): string {
  switch (status) {
    case "PASS":
    case "CONFIRMED":
      return "text-green-400 border-green-800 bg-green-950/30";
    case "PARTIAL":
      return "text-amber-400 border-amber-800 bg-amber-950/30";
    case "FAIL":
    case "MISSING":
    case "NOT_CONFIRMED":
      return "text-red-400 border-red-800 bg-red-950/30";
    default:
      return "text-zinc-400 border-zinc-700 bg-zinc-900/30";
  }
}

export default function KboOperatorInputBridge({ initialData }: { initialData: BridgeData }) {
  const router = useRouter();
  const [dateKst, setDateKst] = useState(initialData.dateKst);
  const [games, setGames] = useState<GameView[]>(initialData.games);
  const [saving, setSaving] = useState<null | "markets" | "lineup">(null);
  const [saveResponse, setSaveResponse] = useState<SaveResponse | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  useEffect(() => {
    setDateKst(initialData.dateKst);
    setGames(initialData.games);
  }, [initialData]);

  const lineupStats = useMemo(
    () =>
      games.map((game) => ({
        internalGameId: game.internalGameId,
        home: parseLineupPaste(game.homeLineupPaste),
        away: parseLineupPaste(game.awayLineupPaste),
      })),
    [games],
  );

  function updateGame(internalGameId: string, patch: Partial<GameView>) {
    setGames((prev) =>
      prev.map((game) =>
        game.internalGameId === internalGameId ? { ...game, ...patch } : game,
      ),
    );
  }

  async function save(kind: "markets" | "lineup") {
    setSaving(kind);
    setSaveResponse(null);
    const payload =
      kind === "markets"
        ? {
            dateKst,
            sourceLabel: "OPERATOR_INPUT_BRIDGE",
            enteredBy: "operator",
            games: games.map((game) => ({
              internalGameId: game.internalGameId,
              providerGameId: game.providerGameId,
              homeTeam: game.homeTeam,
              awayTeam: game.awayTeam,
              canonicalHomeTeamId: game.homeTeamId,
              canonicalAwayTeamId: game.awayTeamId,
              startTimeKst: game.startTimeKst,
              domesticHomeOdds: game.domesticHomeOdds,
              domesticAwayOdds: game.domesticAwayOdds,
              overseasHomeOdds: game.overseasHomeOdds,
              overseasAwayOdds: game.overseasAwayOdds,
              sourceNote: game.oddsSourceNote,
              confirmed: game.oddsConfirmed,
            })),
          }
        : {
            dateKst,
            games: games.map((game) => ({
              internalGameId: game.internalGameId,
              providerGameId: game.providerGameId,
              homeTeam: game.homeTeam,
              awayTeam: game.awayTeam,
              startTimeKst: game.startTimeKst,
              homeSourceNote: game.homeLineupSourceNote,
              awaySourceNote: game.awayLineupSourceNote,
              homeVerified: game.homeLineupStatus === "CONFIRMED",
              awayVerified: game.awayLineupStatus === "CONFIRMED",
              homePaste: game.homeLineupPaste,
              awayPaste: game.awayLineupPaste,
            })),
          };

    const response = await fetch("/internal/research/kbo/input/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, payload }),
    });
    const result = (await response.json()) as SaveResponse;
    setSaveResponse(result);
    setSaving(null);
    if (result.ok) router.refresh();
  }

  async function copyCommand() {
    await navigator.clipboard.writeText(initialData.builderCommand);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1500);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-4">
        <h1 className="text-xl font-semibold text-white">KBO Operator Input Bridge</h1>
        <p className="mt-2 text-sm text-zinc-400">
          대화에 제공한 이미지는 프로젝트 데이터에 자동 반영되지 않습니다. 확인한 값을 이 화면에 입력해 저장해 주세요.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm text-zinc-300">
            날짜
            <input
              type="date"
              value={dateKst}
              onChange={(e) => setDateKst(e.target.value)}
              className="mt-1 block rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            />
          </label>
          <button
            type="button"
            onClick={() => router.push(`/internal/research/kbo/input?date=${dateKst}`)}
            className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500"
          >
            날짜 이동
          </button>
          <a
            href={`/internal/research?date=${dateKst}&view=operator`}
            className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            Research Lab으로 돌아가기
          </a>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className={`rounded border px-3 py-2 ${statusTone(initialData.inputStatus.domestic)}`}>
            국내 배당 입력 {initialData.inputStatus.domestic}
          </div>
          <div className={`rounded border px-3 py-2 ${statusTone(initialData.inputStatus.overseas)}`}>
            해외 배당 입력 {initialData.inputStatus.overseas}
          </div>
          <div className={`rounded border px-3 py-2 ${statusTone(initialData.inputStatus.lineup)}`}>
            라인업 {initialData.inputStatus.lineup}
          </div>
        </div>
        <div className="mt-4 text-xs text-zinc-500">
          <p>Schedule source: {initialData.schedulePath ?? "없음"}</p>
          <p>Odds output: {initialData.marketsPath}</p>
          <p>Lineup output: {initialData.lineupPath}</p>
        </div>
      </section>

      {!initialData.scheduleExists ? (
        <section className="rounded-lg border border-red-800 bg-red-950/20 px-5 py-4 text-sm text-red-300">
          Schedule artifact가 없어 입력 화면을 열 수 없습니다. 먼저 `npm run research:kbo-identity -- {dateKst}`를 실행해 주세요.
        </section>
      ) : null}

      {games.map((game) => {
        const stat = lineupStats.find((item) => item.internalGameId === game.internalGameId);
        return (
          <section
            key={game.internalGameId}
            className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-white">
                {game.homeTeam} vs {game.awayTeam}
              </h2>
              <span className="text-sm text-zinc-500">{game.startTimeKst ?? "시간 미확인"}</span>
              <span className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
                {game.internalGameId}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              선발: 홈 {game.homeStarter ?? "미확인"} / 원정 {game.awayStarter ?? "미확인"}
            </p>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded border border-zinc-800 px-4 py-3">
                <h3 className="text-sm font-semibold text-zinc-200">국내·해외 배당 입력</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-zinc-400">
                    국내 홈
                    <input
                      value={game.domesticHomeOdds}
                      onChange={(e) =>
                        updateGame(game.internalGameId, { domesticHomeOdds: e.target.value })
                      }
                      className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-zinc-400">
                    국내 원정
                    <input
                      value={game.domesticAwayOdds}
                      onChange={(e) =>
                        updateGame(game.internalGameId, { domesticAwayOdds: e.target.value })
                      }
                      className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-zinc-400">
                    해외 홈
                    <input
                      value={game.overseasHomeOdds}
                      onChange={(e) =>
                        updateGame(game.internalGameId, { overseasHomeOdds: e.target.value })
                      }
                      className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-zinc-400">
                    해외 원정
                    <input
                      value={game.overseasAwayOdds}
                      onChange={(e) =>
                        updateGame(game.internalGameId, { overseasAwayOdds: e.target.value })
                      }
                      className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                    />
                  </label>
                </div>
                <label className="mt-3 block text-xs text-zinc-400">
                  입력 출처 메모
                  <input
                    value={game.oddsSourceNote}
                    onChange={(e) => updateGame(game.internalGameId, { oddsSourceNote: e.target.value })}
                    className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={game.oddsConfirmed}
                    onChange={(e) => updateGame(game.internalGameId, { oddsConfirmed: e.target.checked })}
                  />
                  운영자 확인 완료
                </label>
              </div>

              <div className="rounded border border-zinc-800 px-4 py-3">
                <h3 className="text-sm font-semibold text-zinc-200">라인업 입력</h3>
                <div className="mt-3 grid gap-4">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <p className="text-xs font-semibold text-zinc-300">홈 {game.homeTeam}</p>
                      <span className={`rounded border px-2 py-0.5 text-[11px] ${statusTone(game.homeLineupStatus)}`}>
                        {game.homeLineupStatus}
                      </span>
                    </div>
                    <textarea
                      value={game.homeLineupPaste}
                      onChange={(e) => updateGame(game.internalGameId, { homeLineupPaste: e.target.value })}
                      rows={6}
                      className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                    />
                    <div className="mt-1 text-[11px] text-zinc-500">
                      파싱 성공 {stat?.home.parsedCount ?? 0}행
                      {stat && stat.home.invalidLines.length > 0 ? ` · 확인 필요 ${stat.home.invalidLines.length}행` : ""}
                    </div>
                    <input
                      value={game.homeLineupSourceNote}
                      onChange={(e) => updateGame(game.internalGameId, { homeLineupSourceNote: e.target.value })}
                      placeholder="출처 메모"
                      className="mt-2 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                    />
                    <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                      <input
                        type="checkbox"
                        checked={game.homeLineupStatus === "CONFIRMED"}
                        onChange={(e) =>
                          updateGame(game.internalGameId, {
                            homeLineupStatus: e.target.checked ? "CONFIRMED" : "PARTIAL",
                          })
                        }
                      />
                      홈 라인업 확인 완료
                    </label>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <p className="text-xs font-semibold text-zinc-300">원정 {game.awayTeam}</p>
                      <span className={`rounded border px-2 py-0.5 text-[11px] ${statusTone(game.awayLineupStatus)}`}>
                        {game.awayLineupStatus}
                      </span>
                    </div>
                    <textarea
                      value={game.awayLineupPaste}
                      onChange={(e) => updateGame(game.internalGameId, { awayLineupPaste: e.target.value })}
                      rows={6}
                      className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                    />
                    <div className="mt-1 text-[11px] text-zinc-500">
                      파싱 성공 {stat?.away.parsedCount ?? 0}행
                      {stat && stat.away.invalidLines.length > 0 ? ` · 확인 필요 ${stat.away.invalidLines.length}행` : ""}
                    </div>
                    <input
                      value={game.awayLineupSourceNote}
                      onChange={(e) => updateGame(game.internalGameId, { awayLineupSourceNote: e.target.value })}
                      placeholder="출처 메모"
                      className="mt-2 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                    />
                    <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                      <input
                        type="checkbox"
                        checked={game.awayLineupStatus === "CONFIRMED"}
                        onChange={(e) =>
                          updateGame(game.internalGameId, {
                            awayLineupStatus: e.target.checked ? "CONFIRMED" : "PARTIAL",
                          })
                        }
                      />
                      원정 라인업 확인 완료
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })}

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-4">
        <h2 className="text-lg font-semibold text-white">저장 상태</h2>
        {saveResponse ? (
          <div className={`mt-3 rounded border px-3 py-2 ${statusTone(saveResponse.status)}`}>
            <p className="text-sm font-semibold">{saveResponse.message}</p>
            {saveResponse.path ? <p className="mt-1 text-xs">{saveResponse.path}</p> : null}
            {saveResponse.savedAtKst ? <p className="text-xs">{saveResponse.savedAtKst} KST</p> : null}
            {saveResponse.errors.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs">
                {saveResponse.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">아직 저장하지 않았습니다.</p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => save("markets")}
            disabled={saving != null}
            className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
          >
            {saving === "markets" ? "배당 저장 중..." : "배당 저장"}
          </button>
          <button
            type="button"
            onClick={() => save("lineup")}
            disabled={saving != null}
            className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
          >
            {saving === "lineup" ? "라인업 저장 중..." : "라인업 저장"}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-4">
        <h2 className="text-lg font-semibold text-white">Daily Builder 실행 안내</h2>
        <p className="mt-2 text-sm text-zinc-400">
          저장 후 아래 명령으로 Daily KBO Research Builder를 실행하세요.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="rounded bg-zinc-950 px-3 py-2 text-sm text-zinc-200">
            {initialData.builderCommand}
          </code>
          <button
            type="button"
            onClick={copyCommand}
            className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500"
          >
            {copyState === "copied" ? "복사됨" : "명령어 복사"}
          </button>
        </div>
      </section>
    </div>
  );
}
