"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type NpbStarterGameView = {
  internalGameId: string;
  awayTeam: string;
  homeTeam: string;
  firstPitchAt: string | null;
  joinStatus: string;
  awayStarter: {
    displayName: string;
    originalName: string;
    handedness: string;
  } | null;
  homeStarter: {
    displayName: string;
    originalName: string;
    handedness: string;
  } | null;
  uiStatus: string;
  cutoffLabel: string | null;
  isBeforeFirstPitch: boolean | null;
};

export type NpbStarterIntakeView = {
  dateKst: string;
  scheduleExists: boolean;
  schedulePath: string | null;
  confirmationPath: string;
  sourceBanner: string;
  games: NpbStarterGameView[];
  summary: {
    scheduleGames: number;
    matchedGames: number;
    confirmedStarters: number;
    missingStarters: number;
    lateGames: number;
    joinErrors: number;
    preGameVerifiedStarters: number;
  } | null;
  overlayLine: string;
};

type DraftSide = { originalName: string; displayName: string };

function statusTone(status: string): string {
  switch (status) {
    case "CONFIRMED":
      return "border-emerald-700 bg-emerald-950/40 text-emerald-300";
    case "MISSING":
      return "border-amber-700 bg-amber-950/30 text-amber-300";
    case "LATE":
      return "border-red-800 bg-red-950/40 text-red-300";
    case "JOIN_ERROR":
      return "border-red-800 bg-red-950/40 text-red-300";
    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-400";
  }
}

export default function NpbStarterIntakeForm({
  initial,
}: {
  initial: NpbStarterIntakeView;
}) {
  const router = useRouter();
  const [dateKst, setDateKst] = useState(initial.dateKst);
  const [sourceLabel, setSourceLabel] = useState(
    "수동 확인 · MANUAL VERIFIED",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [drafts, setDrafts] = useState<
    Record<string, { away: DraftSide; home: DraftSide }>
  >(() => {
    const out: Record<string, { away: DraftSide; home: DraftSide }> = {};
    for (const g of initial.games) {
      out[g.internalGameId] = {
        away: {
          originalName: g.awayStarter?.originalName ?? "",
          displayName: g.awayStarter?.displayName ?? "",
        },
        home: {
          originalName: g.homeStarter?.originalName ?? "",
          displayName: g.homeStarter?.displayName ?? "",
        },
      };
    }
    return out;
  });

  const counts = useMemo(() => {
    let confirmed = 0;
    let missing = 0;
    for (const g of initial.games) {
      const d = drafts[g.internalGameId];
      const awayOk = Boolean(d?.away.originalName.trim());
      const homeOk = Boolean(d?.home.originalName.trim());
      if (awayOk) confirmed++;
      else missing++;
      if (homeOk) confirmed++;
      else missing++;
    }
    return { confirmed, missing, games: initial.games.length };
  }, [drafts, initial.games]);

  function updateSide(
    gameId: string,
    side: "away" | "home",
    field: keyof DraftSide,
    value: string,
  ) {
    setDrafts((prev) => {
      const cur = prev[gameId] ?? {
        away: { originalName: "", displayName: "" },
        home: { originalName: "", displayName: "" },
      };
      return {
        ...prev,
        [gameId]: {
          ...cur,
          [side]: { ...cur[side], [field]: value },
        },
      };
    });
  }

  async function onSave() {
    setSaving(true);
    setMessage(null);
    setErrors([]);
    try {
      const payload = {
        dateKst: initial.dateKst,
        sourceLabel,
        drafts: initial.games.map((g) => {
          const d = drafts[g.internalGameId]!;
          return {
            internalGameId: g.internalGameId,
            awayStarter: d.away.originalName.trim()
              ? {
                  originalName: d.away.originalName.trim(),
                  displayName: d.away.displayName.trim() || null,
                }
              : null,
            homeStarter: d.home.originalName.trim()
              ? {
                  originalName: d.home.originalName.trim(),
                  displayName: d.home.displayName.trim() || null,
                }
              : null,
          };
        }),
      };
      const res = await fetch("/internal/research/npb/starter/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        ok: boolean;
        message?: string;
        errors?: string[];
        overlayLine?: string;
      };
      if (!json.ok) {
        setErrors(json.errors ?? ["SAVE_FAILED"]);
        setMessage(json.message ?? "저장 실패");
      } else {
        setMessage(json.message ?? "저장 완료");
        router.refresh();
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "SAVE_ERROR");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-amber-700 px-2 py-0.5 text-xs font-semibold text-amber-300">
            수동 확인
          </span>
          <span className="rounded border border-amber-700 px-2 py-0.5 text-xs font-semibold tracking-wide text-amber-200">
            MANUAL VERIFIED
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-300">
          Provider 자동 수집이 아닙니다. 관리자가 확인한 예고 선발만 저장합니다.
          일본어 원문을 반드시 입력하세요.
        </p>
        <p className="mt-2 font-mono text-xs text-zinc-500">
          {initial.overlayLine}
        </p>
      </section>

      <section className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-zinc-400">
          날짜 (KST)
          <input
            type="date"
            value={dateKst}
            onChange={(e) => setDateKst(e.target.value)}
            className="mt-1 block rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
          />
        </label>
        <a
          href={`/internal/research/npb/starter?date=${encodeURIComponent(dateKst)}`}
          className="rounded bg-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
        >
          날짜 로드
        </a>
        <label className="min-w-[240px] flex-1 text-sm text-zinc-400">
          Source Label
          <input
            value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)}
            className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
          />
        </label>
        <button
          type="button"
          disabled={saving || !initial.scheduleExists}
          onClick={() => void onSave()}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </section>

      <div className="grid gap-2 text-sm sm:grid-cols-4">
        <div className="rounded border border-zinc-800 px-3 py-2">
          Games <span className="font-semibold text-white">{counts.games}</span>
        </div>
        <div className="rounded border border-zinc-800 px-3 py-2">
          Draft Confirmed{" "}
          <span className="font-semibold text-white">{counts.confirmed}</span>
        </div>
        <div className="rounded border border-zinc-800 px-3 py-2">
          Missing{" "}
          <span className="font-semibold text-white">{counts.missing}</span>
        </div>
        <div className="rounded border border-zinc-800 px-3 py-2 text-xs text-zinc-500">
          {initial.confirmationPath}
        </div>
      </div>

      {!initial.scheduleExists ? (
        <p className="rounded border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          NPB Schedule artifact가 없습니다. Schedule join 후 입력하세요.
        </p>
      ) : null}

      {message ? (
        <p className="text-sm text-zinc-200">{message}</p>
      ) : null}
      {errors.length > 0 ? (
        <ul className="text-xs text-red-300">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-4">
        {initial.games.map((g) => {
          const d = drafts[g.internalGameId] ?? {
            away: { originalName: "", displayName: "" },
            home: { originalName: "", displayName: "" },
          };
          return (
            <section
              key={g.internalGameId}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-white">
                    {g.awayTeam} @ {g.homeTeam}
                  </h3>
                  <p className="font-mono text-[11px] text-zinc-500">
                    {g.internalGameId}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${statusTone(g.uiStatus)}`}
                >
                  {g.uiStatus}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-zinc-500">
                    원정 선발 · {g.awayTeam}
                  </p>
                  <input
                    placeholder="originalName (일본어 원문)"
                    value={d.away.originalName}
                    onChange={(e) =>
                      updateSide(
                        g.internalGameId,
                        "away",
                        "originalName",
                        e.target.value,
                      )
                    }
                    className="mb-2 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                  />
                  <input
                    placeholder="displayName (선택)"
                    value={d.away.displayName}
                    onChange={(e) =>
                      updateSide(
                        g.internalGameId,
                        "away",
                        "displayName",
                        e.target.value,
                      )
                    }
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-zinc-500">
                    홈 선발 · {g.homeTeam}
                  </p>
                  <input
                    placeholder="originalName (일본어 원문)"
                    value={d.home.originalName}
                    onChange={(e) =>
                      updateSide(
                        g.internalGameId,
                        "home",
                        "originalName",
                        e.target.value,
                      )
                    }
                    className="mb-2 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                  />
                  <input
                    placeholder="displayName (선택)"
                    value={d.home.displayName}
                    onChange={(e) =>
                      updateSide(
                        g.internalGameId,
                        "home",
                        "displayName",
                        e.target.value,
                      )
                    }
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
