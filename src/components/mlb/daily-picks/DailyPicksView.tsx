import type { DailyPickCard, DailyPicksView } from "@/lib/mlb/daily-picks-v1";

const MEDALS = ["🥇", "🥈", "🥉"] as const;

function PickCard({
  card,
  medal,
}: {
  card: DailyPickCard;
  medal?: string;
}) {
  const eng = card.provenance.sourceType === "ENGINE_SNAPSHOT";
  const inner = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium tracking-wide text-amber-300/90">
            {medal ? `${medal} ` : ""}
            {card.starLabel}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">
            {card.pickTeam ?? card.matchupLine}
          </h3>
          <p className="text-xs text-zinc-500">{card.matchupLine}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {card.researchOnly ? (
            <span className="rounded border border-sky-800 bg-sky-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
              RESEARCH ONLY
            </span>
          ) : null}
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
              eng
                ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                : card.provenance.sourceType === "RECONSTRUCTED"
                  ? "border-amber-800 bg-amber-950/30 text-amber-200"
                  : "border-zinc-700 text-zinc-400"
            }`}
          >
            {card.provenance.sourceType}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            Model Probability
          </p>
          <p className="text-sm font-semibold text-white">
            {card.modelProbabilityPercent != null
              ? `${card.modelProbabilityPercent}%`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            Confidence
          </p>
          <p className="text-sm font-semibold text-emerald-300">
            {card.confidence != null ? `${card.confidence}/100` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Side</p>
          <p className="text-sm font-semibold text-zinc-200">
            {card.pickSide ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            Hash
          </p>
          <p className="font-mono text-[10px] text-zinc-400">
            {card.provenance.predictionHash
              ? `${card.provenance.predictionHash.slice(0, 8)}…`
              : "—"}
          </p>
        </div>
      </div>

      {card.reasonChips.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {card.reasonChips.map((chip) => (
            <li
              key={chip}
              className="rounded-md border border-zinc-700/80 bg-zinc-900/60 px-2 py-0.5 text-[11px] text-zinc-300"
            >
              {chip}
            </li>
          ))}
        </ul>
      ) : null}

      {(card.tier === "PASS" ||
        card.tier === "AVOID" ||
        card.tier === "LEAN") &&
      card.passReasonLabels.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {card.passReasonLabels.map((label) => (
            <li
              key={label}
              className="rounded-md border border-amber-900/50 bg-amber-950/30 px-2 py-0.5 text-[11px] text-amber-200/90"
            >
              {label}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 text-sm leading-relaxed text-zinc-300">
        <span className="text-zinc-500">AI Summary · </span>
        {card.aiSummary}
      </p>

      {card.detailHref ? (
        <p className="mt-3 text-xs text-sky-400/90">Game Detail →</p>
      ) : (
        <p className="mt-3 text-xs text-zinc-600">gamePk 없음 · Detail 연결 불가</p>
      )}
    </>
  );

  const className =
    "block rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-4 transition-colors hover:border-zinc-600 hover:bg-zinc-900";

  if (card.detailHref) {
    return (
      <a href={card.detailHref} className={className}>
        {inner}
      </a>
    );
  }
  return <div className={className}>{inner}</div>;
}

function PickSection({
  title,
  subtitle,
  cards,
  empty,
  medals,
}: {
  title: string;
  subtitle: string;
  cards: DailyPickCard[];
  empty: string;
  medals?: boolean;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-xs text-zinc-500">{subtitle}</p>
      </div>
      {cards.length === 0 ? (
        <p className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-500">
          {empty}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {cards.map((c, i) => (
            <PickCard
              key={c.gameId}
              card={c}
              medal={medals ? MEDALS[i] : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function DailyPicksView({ view }: { view: DailyPicksView }) {
  const { hero, provenanceBanner: ban } = view;
  const engineOk = ban.allowEngineRecommendations;
  const noRec =
    view.loaded &&
    engineOk &&
    view.strongPicks.length + view.goodPicks.length === 0;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 px-5 py-6 sm:px-8 sm:py-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90">
          YANG EDGE
        </p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Daily Picks
        </h2>
        <p className="mt-1 font-mono text-sm text-zinc-400">{hero.dateKst}</p>

        {/* Provenance banner */}
        <div
          className={`mt-5 rounded-xl border px-4 py-3 ${
            ban.status === "PRE_GAME_SNAPSHOT_VERIFIED" && engineOk
              ? "border-emerald-900/50 bg-emerald-950/20"
              : ban.status === "NO_PREGAME_SNAPSHOT"
                ? "border-red-900/50 bg-red-950/20"
                : "border-amber-900/40 bg-amber-950/20"
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Prediction Status
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {ban.predictionStatusLine}
          </p>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-zinc-500">Snapshot</dt>
              <dd className="font-mono text-zinc-200">
                {ban.snapshotDate ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Generated</dt>
              <dd className="text-zinc-200">{ban.generatedLine}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Hash</dt>
              <dd className="font-mono text-zinc-200">
                {ban.predictionHashShort ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Recommendation Source</dt>
              <dd className="font-medium text-zinc-100">
                {ban.recommendationSourceLine}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-3">
            <p className="text-[10px] uppercase text-zinc-500">오늘 경기</p>
            <p className="mt-1 text-2xl font-bold text-white">{hero.totalGames}</p>
          </div>
          <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-3">
            <p className="text-[10px] uppercase text-emerald-500/80">
              엔진 추천
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-300">
              {hero.recommendCount}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-3">
            <p className="text-[10px] uppercase text-zinc-500">PASS</p>
            <p className="mt-1 text-2xl font-bold text-zinc-200">{hero.passCount}</p>
          </div>
          <div className="rounded-lg border border-sky-900/40 bg-sky-950/20 px-3 py-3">
            <p className="text-[10px] uppercase text-sky-500/80">Research Ready</p>
            <p className="mt-1 text-2xl font-bold text-sky-300">
              {hero.researchReadyPercent != null
                ? `${hero.researchReadyPercent}%`
                : "—"}
            </p>
          </div>
        </div>

        {noRec ? (
          <p className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300">
            오늘 YANG EDGE 추천 없음 — Strong/Good 구간에 ENGINE_SNAPSHOT 경기가
            없습니다. 강제 승격하지 않습니다.
          </p>
        ) : null}

        {!view.loaded && view.error ? (
          <p className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
            {view.error}
          </p>
        ) : null}
      </section>

      <PickSection
        title="Today's Strong Pick"
        subtitle="★★★★★ · ENGINE_SNAPSHOT only · Confidence ≥ 80 · 최대 1~2 · 강제 승격 없음"
        cards={view.strongPicks}
        empty="오늘 Strong Pick 없음 (ENGINE_SNAPSHOT)."
      />

      <PickSection
        title="Good Picks"
        subtitle="★★★★☆ · ENGINE_SNAPSHOT only · Confidence ≥ 70 · 최대 2~3 · RESEARCH ONLY 명시"
        cards={view.goodPicks}
        empty={
          engineOk
            ? "오늘 Good Pick 없음 — YANG EDGE 추천을 채우지 않습니다."
            : "ENGINE_SNAPSHOT 추천 불가 (Snapshot/Epoch 조건 미충족)."
        }
        medals
      />

      {view.reconstructedPicks.length > 0 ? (
        <PickSection
          title="RECONSTRUCTED (추천 아님)"
          subtitle="현재 presenter로 Snapshot을 재구성한 결과 · 사용자 추천·성적 제외"
          cards={view.reconstructedPicks}
          empty=""
        />
      ) : null}

      {view.leanPicks.length > 0 ? (
        <PickSection
          title="Lean"
          subtitle="★★★☆☆ · 참고용 · 추천 아님"
          cards={view.leanPicks}
          empty=""
        />
      ) : null}

      <PickSection
        title="PASS Games"
        subtitle="★★☆☆☆ · 추천하지 않음 · 사유 필수"
        cards={view.passGames}
        empty="PASS로 분류된 경기가 없습니다."
      />

      {view.avoidGames.length > 0 ? (
        <PickSection
          title="Avoid"
          subtitle="★☆☆☆☆ · Confidence 40 미만"
          cards={view.avoidGames}
          empty=""
        />
      ) : null}

      <section className="rounded-xl border border-violet-900/40 bg-violet-950/20 px-5 py-4">
        <h2 className="text-lg font-semibold text-violet-100">
          {view.todaysResearch.title}
        </h2>
        <p className="mt-1 text-xl font-bold text-white">
          {view.todaysResearch.focus}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          {view.todaysResearch.plain}
        </p>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="text-lg font-semibold text-white">CTO Commentary</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          {view.ctoCommentary}
        </p>
        {view.predictionHash ? (
          <p className="mt-3 font-mono text-[10px] text-zinc-600">
            predictionHash · {view.predictionHash}
          </p>
        ) : null}
      </section>
    </div>
  );
}
