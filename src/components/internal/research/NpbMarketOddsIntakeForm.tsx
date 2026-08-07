"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type NpbOddsGameView = {
  internalGameId: string;
  awayTeam: string;
  homeTeam: string;
  firstPitchAt: string | null;
  awayOdds: number | null;
  homeOdds: number | null;
  uiStatus: string;
  cutoffLabel: string | null;
};

export type NpbOddsIntakeView = {
  dateKst: string;
  scheduleExists: boolean;
  confirmationPath: string;
  sourceBanner: string;
  games: NpbOddsGameView[];
  readinessLines: string[];
};

function statusTone(status: string): string {
  switch (status) {
    case "VERIFIED":
      return "border-emerald-700 bg-emerald-950/40 text-emerald-300";
    case "MISSING":
      return "border-amber-700 bg-amber-950/30 text-amber-300";
    case "LATE":
    case "JOIN_ERROR":
    case "INVALID":
      return "border-red-800 bg-red-950/40 text-red-300";
    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-400";
  }
}

export default function NpbMarketOddsIntakeForm({
  initial,
}: {
  initial: NpbOddsIntakeView;
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
    Record<string, { awayOdds: string; homeOdds: string }>
  >(() => {
    const out: Record<string, { awayOdds: string; homeOdds: string }> = {};
    for (const g of initial.games) {
      out[g.internalGameId] = {
        awayOdds: g.awayOdds != null ? String(g.awayOdds) : "",
        homeOdds: g.homeOdds != null ? String(g.homeOdds) : "",
      };
    }
    return out;
  });

  const verifiedCount = useMemo(() => {
    let n = 0;
    for (const g of initial.games) {
      const d = drafts[g.internalGameId];
      if (d?.awayOdds.trim() && d?.homeOdds.trim()) n++;
    }
    return n;
  }, [drafts, initial.games]);

  function update(
    gameId: string,
    side: "awayOdds" | "homeOdds",
    value: string,
  ) {
    setDrafts((prev) => ({
      ...prev,
      [gameId]: {
        awayOdds: prev[gameId]?.awayOdds ?? "",
        homeOdds: prev[gameId]?.homeOdds ?? "",
        [side]: value,
      },
    }));
  }

  async function onSave() {
    setSaving(true);
    setMessage(null);
    setErrors([]);
    try {
      const res = await fetch("/internal/research/npb/odds/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dateKst: initial.dateKst,
          sourceLabel,
          drafts: initial.games.map((g) => ({
            internalGameId: g.internalGameId,
            awayOdds: drafts[g.internalGameId]?.awayOdds ?? "",
            homeOdds: drafts[g.internalGameId]?.homeOdds ?? "",
          })),
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        message?: string;
        errors?: string[];
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
        <div className="flex flex-wrap gap-2">
          <span className="rounded border border-amber-700 px-2 py-0.5 text-xs font-semibold text-amber-300">
            수동 확인
          </span>
          <span className="rounded border border-amber-700 px-2 py-0.5 text-xs font-semibold tracking-wide text-amber-200">
            MANUAL VERIFIED
          </span>
          <span className="rounded border border-zinc-600 px-2 py-0.5 text-xs text-zinc-400">
            MONEYLINE ONLY
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-300">
          Provider Odds와 별도 provenance입니다. Market implied ≠ Model
          Probability. 승①패/핸디/U·O/SUM은 입력하지 않습니다.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-zinc-400">
          {initial.readinessLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
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
          href={`/internal/research/npb/odds?date=${encodeURIComponent(dateKst)}`}
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

      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded border border-zinc-800 px-3 py-2">
          Games{" "}
          <span className="font-semibold text-white">
            {initial.games.length}
          </span>
        </div>
        <div className="rounded border border-zinc-800 px-3 py-2">
          Draft Verified{" "}
          <span className="font-semibold text-white">
            {verifiedCount}/{initial.games.length}
          </span>
        </div>
        <div className="rounded border border-zinc-800 px-3 py-2 text-xs text-zinc-500">
          {initial.confirmationPath}
        </div>
      </div>

      {!initial.scheduleExists ? (
        <p className="rounded border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          NPB Schedule이 없습니다. Schedule join 후 입력하세요.
        </p>
      ) : null}
      {message ? <p className="text-sm text-zinc-200">{message}</p> : null}
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
            awayOdds: "",
            homeOdds: "",
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
                <label className="text-xs text-zinc-500">
                  {g.awayTeam} · Away decimal
                  <input
                    inputMode="decimal"
                    placeholder="e.g. 1.49"
                    value={d.awayOdds}
                    onChange={(e) =>
                      update(g.internalGameId, "awayOdds", e.target.value)
                    }
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-zinc-500">
                  {g.homeTeam} · Home decimal
                  <input
                    inputMode="decimal"
                    placeholder="e.g. 2.15"
                    value={d.homeOdds}
                    onChange={(e) =>
                      update(g.internalGameId, "homeOdds", e.target.value)
                    }
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
