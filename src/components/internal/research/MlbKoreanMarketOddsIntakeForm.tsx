"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type MlbKoreanOddsGameView = {
  gamePk: number;
  awayTeam: string;
  homeTeam: string;
  firstPitchAt: string | null;
  awayOdds: number | null;
  homeOdds: number | null;
  joinStatus: string;
  observationStatus: string | null;
  isBeforeFirstPitch: boolean | null;
};

function statusLabel(g: MlbKoreanOddsGameView, draftFilled: boolean): string {
  if (g.observationStatus === "LATE_OBSERVATION") return "LATE";
  if (g.observationStatus === "PRE_GAME_OBSERVATION") return "PRE-GAME";
  if (draftFilled) return "READY";
  return "MISSING";
}

function statusTone(status: string): string {
  switch (status) {
    case "PRE-GAME":
    case "READY":
      return "border-emerald-700 bg-emerald-950/40 text-emerald-300";
    case "MISSING":
      return "border-amber-700 bg-amber-950/30 text-amber-300";
    case "LATE":
      return "border-red-800 bg-red-950/40 text-red-300";
    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-400";
  }
}

export default function MlbKoreanMarketOddsIntakeForm({
  initial,
}: {
  initial: {
    dateKst: string;
    scheduleExists: boolean;
    observationPath: string;
    sourceBanner: string;
    games: MlbKoreanOddsGameView[];
    summaryLine: string | null;
  };
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [joinReview, setJoinReview] = useState<Record<number, boolean>>({});
  const [drafts, setDrafts] = useState<
    Record<number, { awayOdds: string; homeOdds: string }>
  >(() => {
    const out: Record<number, { awayOdds: string; homeOdds: string }> = {};
    for (const g of initial.games) {
      out[g.gamePk] = {
        awayOdds: g.awayOdds != null ? String(g.awayOdds) : "",
        homeOdds: g.homeOdds != null ? String(g.homeOdds) : "",
      };
    }
    return out;
  });

  const filled = useMemo(() => {
    let n = 0;
    for (const g of initial.games) {
      const d = drafts[g.gamePk];
      if (d?.awayOdds.trim() && d?.homeOdds.trim() && !joinReview[g.gamePk]) {
        n++;
      }
    }
    return n;
  }, [drafts, initial.games, joinReview]);

  async function onSave() {
    setSaving(true);
    setMessage(null);
    setErrors([]);
    try {
      const res = await fetch("/internal/research/mlb/korean-odds/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateKst: initial.dateKst,
          drafts: initial.games.map((g) => ({
            gamePk: g.gamePk,
            awayOdds: drafts[g.gamePk]?.awayOdds ?? "",
            homeOdds: drafts[g.gamePk]?.homeOdds ?? "",
            joinReviewRequired: Boolean(joinReview[g.gamePk]),
          })),
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        errors?: string[];
        summary?: { observedGames?: number; preGameObservations?: number };
      };
      if (!res.ok || !body.ok) {
        setErrors(body.errors ?? [`HTTP_${res.status}`]);
        setMessage("저장 실패");
        return;
      }
      setMessage(
        `저장 완료 · observed=${body.summary?.observedGames ?? "?"} · pregame=${body.summary?.preGameObservations ?? "?"}`,
      );
      router.refresh();
    } catch (e) {
      setErrors([String(e)]);
      setMessage("저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-rose-800/50 bg-rose-950/20 px-4 py-3 text-sm text-rose-100">
        <p className="font-semibold">{initial.sourceBanner}</p>
        <p className="mt-1 text-xs text-rose-200/80">
          기본 승패(Moneyline)만 · 승①패/H/UO/SUM 혼합 금지 · Schedule away/home
          방향으로 입력 · Provider Odds와 병합하지 않음
        </p>
        <p className="mt-1 font-mono text-[11px] text-zinc-500">
          {initial.observationPath}
        </p>
        {initial.summaryLine ? (
          <p className="mt-2 text-xs text-emerald-300/90">{initial.summaryLine}</p>
        ) : null}
        <p className="mt-1 text-xs text-zinc-400">
          Draft filled: {filled}/{initial.games.length}
        </p>
      </div>

      {!initial.scheduleExists ? (
        <p className="text-sm text-red-300">Schedule artifact missing.</p>
      ) : null}

      {initial.games.map((g) => {
        const d = drafts[g.gamePk];
        const draftFilled = Boolean(d?.awayOdds.trim() && d?.homeOdds.trim());
        const status = joinReview[g.gamePk]
          ? "JOIN_REVIEW"
          : statusLabel(g, draftFilled);
        return (
          <section
            key={g.gamePk}
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">
                {g.awayTeam} @ {g.homeTeam}
              </h3>
              <span
                className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${statusTone(status === "JOIN_REVIEW" ? "LATE" : status)}`}
              >
                {status === "JOIN_REVIEW" ? "JOIN_REVIEW_REQUIRED" : status}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              gamePk={g.gamePk}
              {g.firstPitchAt ? ` · firstPitch ${g.firstPitchAt}` : ""}
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-zinc-400">
                {g.awayTeam} (AWAY odds)
                <input
                  type="text"
                  inputMode="decimal"
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
                  placeholder="e.g. 2.02"
                  value={d?.awayOdds ?? ""}
                  disabled={Boolean(joinReview[g.gamePk])}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [g.gamePk]: {
                        awayOdds: e.target.value,
                        homeOdds: prev[g.gamePk]?.homeOdds ?? "",
                      },
                    }))
                  }
                />
              </label>
              <label className="block text-xs text-zinc-400">
                {g.homeTeam} (HOME odds)
                <input
                  type="text"
                  inputMode="decimal"
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
                  placeholder="e.g. 1.56"
                  value={d?.homeOdds ?? ""}
                  disabled={Boolean(joinReview[g.gamePk])}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [g.gamePk]: {
                        awayOdds: prev[g.gamePk]?.awayOdds ?? "",
                        homeOdds: e.target.value,
                      },
                    }))
                  }
                />
              </label>
            </div>

            <label className="mt-3 flex items-center gap-2 text-xs text-amber-200/90">
              <input
                type="checkbox"
                checked={Boolean(joinReview[g.gamePk])}
                onChange={(e) =>
                  setJoinReview((prev) => ({
                    ...prev,
                    [g.gamePk]: e.target.checked,
                  }))
                }
              />
              팀 매핑 불명확 → JOIN_REVIEW_REQUIRED (저장 차단)
            </label>
          </section>
        );
      })}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving || !initial.scheduleExists}
          onClick={() => void onSave()}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Korean Market Observation"}
        </button>
        {message ? <span className="text-sm text-zinc-300">{message}</span> : null}
      </div>
      {errors.length > 0 ? (
        <ul className="space-y-1 text-xs text-red-300">
          {errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
