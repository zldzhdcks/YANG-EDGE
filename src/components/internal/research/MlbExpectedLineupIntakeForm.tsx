"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type MlbExpectedLineupIntakeGame = {
  gamePk: number;
  awayTeam: string;
  homeTeam: string;
  firstPitchAt: string | null;
  joinStatus: string;
  awayLineup: Array<{
    battingOrder: number;
    displayName: string;
    position: string | null;
    bats: string | null;
  }>;
  homeLineup: Array<{
    battingOrder: number;
    displayName: string;
    position: string | null;
    bats: string | null;
  }>;
  cutoffLabel: string | null;
};

function lineupToPaste(
  batters: MlbExpectedLineupIntakeGame["awayLineup"],
): string {
  return batters
    .map(
      (b) =>
        `${b.battingOrder}. ${b.displayName}${b.position ? ` ${b.position}` : ""}${b.bats ? ` ${b.bats}` : ""}`,
    )
    .join("\n");
}

export default function MlbExpectedLineupIntakeForm({
  initial,
}: {
  initial: {
    dateKst: string;
    scheduleExists: boolean;
    observationPath: string;
    sourceBanner: string;
    games: MlbExpectedLineupIntakeGame[];
    summaryLine: string | null;
  };
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<
    Record<number, { awayPaste: string; homePaste: string }>
  >(() => {
    const out: Record<number, { awayPaste: string; homePaste: string }> = {};
    for (const g of initial.games) {
      out[g.gamePk] = {
        awayPaste: lineupToPaste(g.awayLineup),
        homePaste: lineupToPaste(g.homeLineup),
      };
    }
    return out;
  });

  const filled = useMemo(() => {
    let n = 0;
    for (const g of initial.games) {
      const d = drafts[g.gamePk];
      if (d?.awayPaste.trim() && d?.homePaste.trim()) n++;
    }
    return n;
  }, [drafts, initial.games]);

  async function onSave() {
    setSaving(true);
    setMessage(null);
    setErrors([]);
    try {
      const res = await fetch("/internal/research/mlb/expected-lineup/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateKst: initial.dateKst,
          drafts: initial.games
            .filter((g) => {
              const d = drafts[g.gamePk];
              return Boolean(
                d?.awayPaste.trim() || d?.homePaste.trim(),
              );
            })
            .map((g) => ({
              gamePk: g.gamePk,
              awayPaste: drafts[g.gamePk]?.awayPaste ?? "",
              homePaste: drafts[g.gamePk]?.homePaste ?? "",
            })),
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        errors?: string[];
        summary?: { expectedBattingSlots?: number };
      };
      if (!res.ok || !body.ok) {
        setErrors(body.errors ?? [`HTTP_${res.status}`]);
        setMessage("저장 실패");
        return;
      }
      setMessage(
        `저장 완료 · slots=${body.summary?.expectedBattingSlots ?? "?"} · EXPECTED only`,
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
      <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
        <p className="font-semibold">{initial.sourceBanner}</p>
        <p className="mt-1 text-xs text-amber-200/80">
          예상 라인업 — 확정 아님 · Prediction / Recommendation 불변 · paste:
          `1. Name POS Bats`
        </p>
        <p className="mt-1 font-mono text-[11px] text-zinc-500">
          {initial.observationPath}
        </p>
        {initial.summaryLine ? (
          <p className="mt-2 text-xs text-emerald-300/90">{initial.summaryLine}</p>
        ) : null}
        <p className="mt-1 text-xs text-zinc-400">
          Filled games: {filled}/{initial.games.length} · 미입력 경기는
          NOT_OBSERVED · 한 쪽만 입력하면 거부됩니다
        </p>
      </div>

      {!initial.scheduleExists ? (
        <p className="text-sm text-red-300">Schedule artifact missing.</p>
      ) : null}

      {initial.games.map((g) => (
        <section
          key={g.gamePk}
          className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-4"
        >
          <h3 className="text-sm font-semibold text-white">
            {g.awayTeam} @ {g.homeTeam}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            gamePk={g.gamePk}
            {g.firstPitchAt ? ` · firstPitch ${g.firstPitchAt}` : ""}
            {g.cutoffLabel ? ` · ${g.cutoffLabel}` : ""}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-zinc-400">
              Away paste
              <textarea
                className="mt-1 h-40 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-100"
                value={drafts[g.gamePk]?.awayPaste ?? ""}
                onChange={(e) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [g.gamePk]: {
                      awayPaste: e.target.value,
                      homePaste: prev[g.gamePk]?.homePaste ?? "",
                    },
                  }))
                }
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Home paste
              <textarea
                className="mt-1 h-40 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-100"
                value={drafts[g.gamePk]?.homePaste ?? ""}
                onChange={(e) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [g.gamePk]: {
                      awayPaste: prev[g.gamePk]?.awayPaste ?? "",
                      homePaste: e.target.value,
                    },
                  }))
                }
              />
            </label>
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving || !initial.scheduleExists}
          onClick={() => void onSave()}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save EXPECTED Observation"}
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
