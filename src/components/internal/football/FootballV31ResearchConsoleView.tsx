import type {
  FixtureView,
  GradeView,
  ModelView,
  ResearchConsoleView,
} from "../../../../scripts/football-v31-internal-research-console-v1/console-v1";

function pct(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function oddsText(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(2);
}

function metric(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(4);
}

function yesNo(value: boolean | null): string {
  if (value === null) return "—";
  return value ? "YES" : "NO";
}

function Badge({label}: {label: string}) {
  return (
    <span className="inline-flex items-center rounded border border-zinc-600 bg-zinc-900 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-zinc-100">
      {label}
    </span>
  );
}

function ModelBlock({name, model}: {name: string; model: ModelView}) {
  if (model.status === "INTEGRITY_BLOCKED") {
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{name}</p>
        <Badge label="INTEGRITY_BLOCKED" />
      </div>
    );
  }
  if (model.status === "PASS") {
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{name}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge label="PASS" />
        </div>
        <p className="mt-1 font-mono text-xs text-zinc-400">HOME — · DRAW — · AWAY —</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{name}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        <Badge label={model.status} />
        <Badge label={model.predictedClass ?? "—"} />
      </div>
      <p className="mt-1 font-mono text-xs text-zinc-200">
        HOME {pct(model.homePct)} · DRAW {pct(model.drawPct)} · AWAY {pct(model.awayPct)}
      </p>
    </div>
  );
}

function GradeBlock({name, grade}: {name: string; grade: GradeView}) {
  if (grade.status === "PREGAME_PASS_PRESERVED") {
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{name}</p>
        <Badge label="PREGAME_PASS_PRESERVED" />
      </div>
    );
  }
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{name}</p>
      <p className="mt-1 font-mono text-xs text-zinc-200">
        correct {yesNo(grade.correct)} · log loss {metric(grade.logLoss)} · Brier {metric(grade.brier)}
      </p>
    </div>
  );
}

function deltaText(
  modelName: string,
  selection: string,
  modelP: number | null,
  marketP: number | null,
): string {
  if (modelP == null || marketP == null) return `${modelName} ${selection} —`;
  const diff = (modelP - marketP) * 100;
  const sign = diff > 0 ? "+" : "";
  return `${modelName} ${selection} ${(modelP * 100).toFixed(1)}% · Market ${selection} ${(marketP * 100).toFixed(1)}% · Difference ${sign}${diff.toFixed(1)}%p`;
}

function MarketBlock({row}: {row: FixtureView}) {
  const market = row.marketComparison;
  return (
    <div className="mt-4 rounded-lg border border-dashed border-zinc-600 bg-zinc-900/40 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
        Market comparison
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge label={market.status} />
        <Badge label="1X2_ONLY" />
        <Badge label="ROUND_IDENTITY_CONFIRMED = NO" />
        {market.captureTimeUnverified ? <Badge label="CAPTURE_TIME_UNVERIFIED" /> : null}
      </div>
      {market.status === "MATCHED" && market.impliedNormalized ? (
        <div className="mt-3 space-y-2">
          <p className="font-mono text-xs text-zinc-400">
            observedAt {market.observedAt ?? "—"}
          </p>
          <p className="font-mono text-sm text-zinc-200">
            Home odds {market.homeOdds} · Draw odds {market.drawOdds} · Away odds {market.awayOdds}
          </p>
          <p className="font-mono text-xs text-zinc-400">
            Market implied raw HOME {pct(market.impliedRaw?.home ?? null)} · DRAW{" "}
            {pct(market.impliedRaw?.draw ?? null)} · AWAY {pct(market.impliedRaw?.away ?? null)}
          </p>
          <p className="font-mono text-sm text-zinc-200">
            Normalized market HOME {pct(market.impliedNormalized.home)} · DRAW{" "}
            {pct(market.impliedNormalized.draw)} · AWAY {pct(market.impliedNormalized.away)}
          </p>
          <p className="font-mono text-xs text-zinc-400">
            Fair odds V1 HOME {oddsText(market.v1?.fairOdds.home ?? null)} · DRAW{" "}
            {oddsText(market.v1?.fairOdds.draw ?? null)} · AWAY {oddsText(market.v1?.fairOdds.away ?? null)}
          </p>
          <p className="font-mono text-xs text-zinc-400">
            Fair odds H2 HOME {oddsText(market.h2?.fairOdds.home ?? null)} · DRAW{" "}
            {oddsText(market.h2?.fairOdds.draw ?? null)} · AWAY {oddsText(market.h2?.fairOdds.away ?? null)}
          </p>
          <p className="font-mono text-xs text-zinc-400">
            Fair odds R1 HOME {oddsText(market.r1?.fairOdds.home ?? null)} · DRAW{" "}
            {oddsText(market.r1?.fairOdds.draw ?? null)} · AWAY {oddsText(market.r1?.fairOdds.away ?? null)}
          </p>
          <div className="space-y-1 font-mono text-xs text-zinc-300">
            <p>{deltaText("V1", "HOME", row.v1.homePct, market.impliedNormalized.home)}</p>
            <p>{deltaText("H2", "HOME", row.h2.homePct, market.impliedNormalized.home)}</p>
            <p>{deltaText("R1", "HOME", row.r1.homePct, market.impliedNormalized.home)}</p>
            <p>{deltaText("V1", "DRAW", row.v1.drawPct, market.impliedNormalized.draw)}</p>
            <p>{deltaText("H2", "DRAW", row.h2.drawPct, market.impliedNormalized.draw)}</p>
            <p>{deltaText("R1", "DRAW", row.r1.drawPct, market.impliedNormalized.draw)}</p>
            <p>{deltaText("V1", "AWAY", row.v1.awayPct, market.impliedNormalized.away)}</p>
            <p>{deltaText("H2", "AWAY", row.h2.awayPct, market.impliedNormalized.away)}</p>
            <p>{deltaText("R1", "AWAY", row.r1.awayPct, market.impliedNormalized.away)}</p>
          </div>
          <p className="text-xs text-zinc-500">
            Probability difference · Model vs normalized market. Research comparison only.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-400">
          No 1X2 market comparison for this fixture. Totals and handicap are not compared in this V1.
        </p>
      )}
    </div>
  );
}

function FixtureCard({row}: {row: FixtureView}) {
  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-zinc-400">{row.kickoffKst}</p>
          <h3 className="mt-1 text-base font-semibold text-white">
            {row.homeTeam} vs {row.awayTeam}
          </h3>
          <p className="text-sm text-zinc-400">
            {row.league} · fixture {row.fixtureId}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge label={row.evidence} />
          <Badge label={row.consensus} />
          <Badge label={row.integrity === "verified" ? "verified" : "INTEGRITY_BLOCKED"} />
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ModelBlock name="V1" model={row.v1} />
        <ModelBlock name="H2" model={row.h2} />
        <ModelBlock name="R1" model={row.r1} />
      </div>
      <div className="mt-4 border-t border-zinc-800 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          Comparison / postgame
        </p>
        {row.postgame.status === "RESULT_PENDING" ? (
          <div className="mt-2">
            <Badge label="RESULT_PENDING" />
          </div>
        ) : row.postgame.status === "INTEGRITY_BLOCKED" ? (
          <div className="mt-2">
            <Badge label="INTEGRITY_BLOCKED" />
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <p className="font-mono text-sm text-zinc-200">
              actual {row.postgame.actualResult} · {row.postgame.actualClass}
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <GradeBlock name="V1" grade={row.postgame.v1} />
              <GradeBlock name="H2" grade={row.postgame.h2} />
              <GradeBlock name="R1" grade={row.postgame.r1} />
            </div>
          </div>
        )}
      </div>
      <MarketBlock row={row} />
    </article>
  );
}

function StatusCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-2 font-mono text-2xl text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function Section({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: FixtureView[];
  empty: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
          {empty}
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <FixtureCard key={row.fixtureId} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function FootballV31ResearchConsoleView({
  data,
}: {
  data: ResearchConsoleView;
}) {
  if (data.gate !== "OK") {
    return (
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap gap-2">
          <Badge label="INTERNAL" />
          <Badge label="RESEARCH VIEWER ONLY" />
        </div>
        <h1 className="text-2xl font-bold text-white">Football V3.1 Internal Research Console</h1>
        <p className="text-sm text-zinc-400">{data.disclaimer}</p>
        <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-6">
          <Badge label={data.gate} />
          <p className="mt-3 text-sm text-zinc-300">
            Fail closed. This screen does not generate predictions, call a provider, or connect a
            recommendation engine.
          </p>
        </div>
      </main>
    );
  }

  const s = data.summary;
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-3 border-b border-zinc-800 pb-6">
        <div className="flex flex-wrap gap-2">
          <Badge label="INTERNAL" />
          <Badge label="RESEARCH VIEWER ONLY" />
          <Badge label="LOCAL_ONLY" />
          <Badge label={`MODEL_PROMOTED = ${data.modelPromoted}`} />
          <Badge label={`R1_ROLE = ${data.r1Role}`} />
          <Badge label="ROUND_IDENTITY_CONFIRMED = NO" />
          <Badge label="CAPTURE_TIME_UNVERIFIED" />
          <Badge label="1X2_ONLY" />
          <Badge label="MARKET_INPUT_TO_MODEL = NO" />
          <Badge label="TOTALS_RECOMMENDATION_ENABLED = NO" />
          <Badge label="HANDICAP_COMPARISON_ENABLED = NO" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Football V3.1 Internal Research Console
        </h1>
        <p className="max-w-3xl text-sm text-amber-200/90">{data.disclaimer}</p>
        <p className="max-w-3xl text-sm text-zinc-300">{data.marketDisclaimer}</p>
        <p className="text-sm text-zinc-500">
          Independent model first, then market comparison. Market odds are not model input. Totals
          and handicap are not compared in this V1.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Research status</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatusCard label="SEALED TARGETS" value={s.sealedTargets} />
          <StatusCard label="R1 PREDICTED" value={s.r1Predicted} />
          <StatusCard label="R1 PASS" value={s.r1Pass} />
          <StatusCard label="RESULT PENDING" value={s.resultPending} />
          <StatusCard label="RESULT GRADED" value={s.resultGraded} />
          <StatusCard label="RESULT BLOCKED" value={s.resultBlocked} />
          <StatusCard
            label="MATCHED 1X2"
            value={data.marketSummary.matched}
          />
          <StatusCard
            label="UNMATCHED 1X2"
            value={data.marketSummary.unmatched}
          />
          <StatusCard
            label="IDENTITY BLOCKED"
            value={data.marketSummary.identityBlocked}
          />
        </div>
        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            First checkpoint
          </p>
          <p className="mt-2 font-mono text-lg text-white">
            R1 graded PREDICTED / {s.checkpoint.next}
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Current {s.checkpoint.current} / {s.checkpoint.next}. Research progress is not model
            validation.
          </p>
        </div>
      </section>

      <Section
        title="Upcoming / Pending"
        rows={data.pending}
        empty="No pending sealed fixtures in this local store."
      />
      <Section
        title="Graded / Historical prospective results"
        rows={data.graded}
        empty="No postgame-v1.json grades yet. Pending fixtures stay RESULT_PENDING."
      />
      {data.blocked.length > 0 ? (
        <Section
          title="Blocked"
          rows={data.blocked}
          empty="No blocked fixtures."
        />
      ) : null}
    </main>
  );
}
