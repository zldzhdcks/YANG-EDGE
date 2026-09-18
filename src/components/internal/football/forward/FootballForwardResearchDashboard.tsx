import type { FootballForwardEvidenceReadModel } from "@/lib/football/forward-read-model-v1";
import {
  formatResearchPercent,
  formatYesNo,
  orderOfficialForwardEvents,
} from "@/lib/football/forward-internal-prototype-v1";
import FootballForwardEventCard from "./FootballForwardEventCard";

function Fact({
  label,
  value,
  testId,
}: {
  label: string;
  value: string | number;
  testId?: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-zinc-800 bg-zinc-950/80 p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd
        className="mt-1 break-words font-mono text-sm text-zinc-100"
        data-forward-fact={testId}
      >
        {value}
      </dd>
    </div>
  );
}

export default function FootballForwardResearchDashboard({
  model,
}: {
  model: FootballForwardEvidenceReadModel;
}) {
  const events = orderOfficialForwardEvents(model.gradedEvents);
  const accuracyPct = formatResearchPercent(model.sample.accuracy);
  const engineAllowed = model.checkpoint.engineChangeAllowed;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="min-w-0">
        <div className="flex flex-wrap gap-1">
          <span className="rounded border border-amber-700 bg-amber-950 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-amber-200">
            INTERNAL
          </span>
          <span className="rounded border border-zinc-600 bg-zinc-900 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-zinc-200">
            NOINDEX
          </span>
          <span className="rounded border border-sky-700 bg-sky-950 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-sky-200">
            OFFICIAL FORWARD
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Official Forward Football Research
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Research evidence / pregame-sealed evaluation
        </p>
        <p className="mt-2 font-mono text-sm text-zinc-200" data-forward-model-version>
          {model.model.version}
        </p>
      </header>

      <section className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
        <h2 className="text-sm font-semibold text-white">표본 / Checkpoint</h2>
        <p className="mt-2 text-sm text-zinc-200">
          현재 공식 평가 표본: {model.checkpoint.currentN} / {model.checkpoint.targetN}
        </p>
        <p
          className="mt-1 font-mono text-xs text-zinc-400"
          data-forward-checkpoint={`${model.checkpoint.currentN}/${model.checkpoint.targetN}`}
        >
          N={model.checkpoint.currentN} / {model.checkpoint.targetN}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="totalPredicted" value={model.sample.totalPredicted} />
          <Fact label="totalGraded" value={model.sample.totalGraded} />
          <Fact label="pendingPredicted" value={model.sample.pendingPredicted} />
          <Fact label="pass" value={model.sample.pass} />
          <Fact label="정답" value={model.sample.correct} testId="correct" />
          <Fact label="오답" value={model.sample.wrong} testId="wrong" />
          <Fact label="remaining" value={model.checkpoint.remaining} />
          <Fact
            label="checkpoint reached"
            value={formatYesNo(model.checkpoint.reached)}
          />
        </dl>
        <div className="mt-4 rounded-md border border-zinc-800 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            현재 기록
          </p>
          <p className="mt-1 font-mono text-lg text-white" data-forward-accuracy>
            {model.sample.correct} / {model.sample.totalGraded}
            <span className="ml-2 text-base text-zinc-300">{accuracyPct}</span>
          </p>
          <p className="mt-2 text-sm text-zinc-300">표본 상태</p>
          <p className="font-mono text-xs text-zinc-400">
            N={model.checkpoint.currentN} / {model.checkpoint.targetN}
          </p>
          {model.sample.sampleInsufficient ? (
            <p className="mt-2 text-sm text-amber-300" data-forward-sample-insufficient="true">
              EARLY DESCRIPTIVE ONLY
              <span className="mt-1 block text-zinc-300">
                표본 부족 — Engine 변경 근거로 사용하지 않음
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-zinc-300" data-forward-sample-insufficient="false">
              Sample checkpoint not marked insufficient
            </p>
          )}
          <p
            className="mt-3 font-mono text-xs text-zinc-300"
            data-engine-change-allowed={String(engineAllowed)}
          >
            engineChangeAllowed={String(engineAllowed)}
          </p>
          <p className="text-sm text-zinc-200">
            Engine 변경 허용: {formatYesNo(engineAllowed)}
          </p>
        </div>
        <p className="mt-3 font-mono text-xs text-zinc-500">
          evaluatedAt {model.evaluatedAt}
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
        <h2 className="text-sm font-semibold text-white">Research integrity</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Fact
            label="Odds role"
            value="Observation only"
            testId="odds-role"
          />
          <Fact
            label="oddsRole"
            value={model.integrity.oddsRole}
            testId="odds-role-token"
          />
          <Fact
            label="Odds used"
            value={formatYesNo(model.integrity.oddsUsed)}
            testId="odds-used"
          />
          <Fact
            label="Market used"
            value={formatYesNo(model.integrity.marketUsed)}
          />
          <Fact
            label="Provider prediction used"
            value={formatYesNo(model.integrity.providerPredictionUsed)}
            testId="provider-prediction"
          />
          <Fact
            label="Target result used"
            value={formatYesNo(model.integrity.targetResultDataUsed)}
            testId="target-result"
          />
          <Fact
            label="Postgame data used in prediction"
            value={formatYesNo(model.integrity.postgameDataUsedInPrediction)}
          />
          <Fact
            label="Integrity exclusions"
            value={model.integrity.integrityExclusions}
          />
        </dl>
      </section>

      {model.hypotheses.length > 0 ? (
        <section className="mt-6 rounded-lg border border-dashed border-zinc-700 bg-zinc-950/20 p-4">
          <h2 className="text-sm font-semibold text-white">연구 관찰</h2>
          <ul className="mt-3 space-y-2">
            {model.hypotheses.map((item) => (
              <li key={item.flag} className="text-sm text-zinc-300">
                <span className="font-mono text-xs text-zinc-400">
                  {item.flag} · HYPOTHESIS_ONLY
                </span>
                <span className="mt-1 block">{item.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-white">
          Graded events
          <span className="ml-2 font-mono text-xs font-normal text-zinc-500">
            {events.length}
          </span>
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Ordering: kickoffUtc descending, then fixtureId descending
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4">
          {events.map((event) => (
            <FootballForwardEventCard key={event.fixtureId} event={event} />
          ))}
        </div>
      </section>
    </div>
  );
}
