import type { YangEdgeOsPresentation } from "@/lib/internal/yang-edge-os-presenter";
import type { OperationMemoryV0 } from "@/lib/internal/operation-memory-v0";
import {
  koreanChecklistTitle,
  koreanFieldLabel,
  koreanOwnerCopy,
  koreanStatusLabel,
} from "@/lib/internal/korean-status-display";
import { osHref } from "@/constants/yang-edge-os-nav";
import { AdvancedDisclosure } from "./OwnerMode";
import { StatusPill, levelSurface } from "./StatusPill";

function isOrdinaryGap(title: string, detail: string): boolean {
  return (
    title.includes("대기") ||
    detail.includes("아직 생성되지 않음") ||
    /not entered/i.test(detail)
  );
}

export default function DashboardView({
  os,
  memory,
}: {
  os: YangEdgeOsPresentation;
  memory: OperationMemoryV0;
}) {
  const ds = memory.dashboardSummary;
  const fb = memory.footballIdentity;
  const odds = memory.footballOdds;
  const result = memory.footballResult;
  const review = memory.footballReviewScorecard;

  const actionable = os.checklist.filter((item) => !item.done).slice(0, 5);
  const shownChecklist = actionable.length > 0 ? actionable : os.checklist.slice(0, 5);

  const attentionFromMemory = memory.currentRisks.filter(
    (r) => r.level === "BLOCKED" || (r.level === "WARNING" && !isOrdinaryGap(r.title, r.plainLanguage)),
  );
  const attentionFromOs = os.risks.filter(
    (r) => r.level === "BLOCKED" || (r.level === "WARNING" && !isOrdinaryGap(r.title, r.detail)),
  );
  const mlbCritical =
    os.mlbDailyOps?.lifecycle === "NO_PREGAME_SNAPSHOT" ||
    os.mlbDailyOps?.lifecycle === "OPS_FAILURE";

  const nextStep =
    shownChecklist.find((c) => !c.done)?.title ??
    os.mlbDailyOps?.nextAction ??
    null;

  return (
    <div className="space-y-6">
      {/* A. 오늘 운영 현황 */}
      <section className={`rounded-xl border px-5 py-4 ${levelSurface(os.overallLevel)}`}>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-white">오늘 운영 현황</h2>
          <StatusPill level={os.overallLevel} label={os.overallLabel} />
        </div>
        <p className="mt-2 text-sm text-zinc-300">{koreanOwnerCopy(os.canPredictReason)}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-zinc-500">현재 운영 단계</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-100">
              {os.overallLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">오늘 진행률</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-100">
              {os.progressPercent != null ? `${os.progressPercent}%` : "집계 준비 중"}
            </dd>
            <p className="mt-0.5 text-[11px] text-zinc-600">
              오늘 작업 체크리스트 기준 · 필수 운영 완료율(60%)과 다름
            </p>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">다음 주요 단계</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-100">
              {nextStep ? koreanChecklistTitle(nextStep) : "표시할 다음 단계 없음"}
            </dd>
          </div>
        </dl>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {os.leagueStatuses.map((l) => (
            <div
              key={l.league}
              className={`rounded-lg border px-3 py-3 ${levelSurface(l.level)}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-white">{l.league}</span>
                <StatusPill level={l.level} label={l.label} />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                {koreanOwnerCopy(l.detail)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* B. 지금 해야 할 일 */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">지금 해야 할 일</h2>
          <a
            href={osHref("/internal/mission", memory.dateKst)}
            className="text-xs text-sky-400 hover:underline"
          >
            작업 관리 보기 →
          </a>
        </div>
        <ul className="mt-3 space-y-2">
          {shownChecklist.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2"
            >
              <span className="mt-0.5 text-base" aria-hidden>
                {item.done ? "☑" : "☐"}
              </span>
              <div className="min-w-0 flex-1">
                {item.href ? (
                  <a href={item.href} className="font-medium text-zinc-100 hover:underline">
                    {koreanChecklistTitle(item.title)}
                  </a>
                ) : (
                  <span className="font-medium text-zinc-400">
                    {koreanChecklistTitle(item.title)}
                  </span>
                )}
                <div className="mt-1">
                  <StatusPill
                    level={item.done ? "READY" : item.level}
                    label={item.done ? "DONE" : item.level}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* C. 주의가 필요한 항목 */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="mb-2 text-lg font-semibold text-white">주의가 필요한 항목</h2>
        {attentionFromMemory.length === 0 &&
        attentionFromOs.length === 0 &&
        !mlbCritical ? (
          <p className="text-sm text-zinc-500">지금 표시할 운영 주의 항목이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {mlbCritical && os.mlbDailyOps ? (
              <li className={`rounded-lg border px-3 py-2 ${levelSurface("BLOCKED")}`}>
                <div className="flex items-center gap-2">
                  <StatusPill level="BLOCKED" label={os.mlbDailyOps.lifecycle} />
                  <span className="text-sm font-medium text-zinc-100">MLB 오늘 운영</span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">{os.mlbDailyOps.nextAction}</p>
              </li>
            ) : null}
            {(attentionFromMemory.length > 0
              ? attentionFromMemory
              : attentionFromOs
            )
              .slice(0, 4)
              .map((r) => (
                <li
                  key={r.id}
                  className={`rounded-lg border px-3 py-2 ${levelSurface(r.level)}`}
                >
                  <div className="flex items-center gap-2">
                    <StatusPill level={r.level} label={r.level} />
                    <span className="text-sm font-medium text-zinc-100">{r.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    {"plainLanguage" in r ? r.plainLanguage : r.detail}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* D. 대표 승인 필요 */}
      <section className="rounded-xl border border-amber-900/40 bg-amber-950/15 px-5 py-4">
        <h2 className="mb-2 text-lg font-semibold text-white">대표 승인 필요</h2>
        {ds.approvalTop.length === 0 ? (
          <p className="text-sm text-zinc-500">현재 승인 대기 없음</p>
        ) : (
          <ul className="space-y-2 text-sm text-zinc-300">
            {ds.approvalTop.map((a) => (
              <li key={a.id} className="rounded border border-zinc-800 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-100">{a.title}</span>
                  <StatusPill level="WARNING" label={a.status} />
                </div>
                <p className="text-xs text-zinc-500">{a.plainLanguage}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* E. 최근 결정 / 오늘 기억 */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">오늘 기억 · 결정 기록</h2>
          <a
            href={`/internal/cto?date=${memory.dateKst}#decision-center`}
            className="text-xs text-sky-400 hover:underline"
          >
            운영 결정 보기 →
          </a>
        </div>
        <p className="mt-1 text-sm text-zinc-400">{ds.goalOneLiner}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full border border-emerald-800 bg-emerald-950/40 px-3 py-1 text-emerald-300">
            완료 {ds.completedCount}건
          </span>
          <span className="rounded-full border border-amber-800 bg-amber-950/40 px-3 py-1 text-amber-300">
            대기 {ds.pendingCount}건
          </span>
          <span className="rounded-full border border-red-800 bg-red-950/40 px-3 py-1 text-red-300">
            차단 {ds.blockedCount}건
          </span>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-zinc-300">
          {ds.decisionTop.map((d) => (
            <li key={d.id} className="rounded border border-zinc-800 px-3 py-2">
              <div className="flex items-center gap-2">
                <StatusPill level="READY" label={d.status} />
                <span className="font-medium text-zinc-100">{d.title}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{d.reason}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* F. 상세 운영 / 연구 현황 */}
      {os.mlbDailyOps ? (
        <section
          className={`rounded-xl border px-5 py-4 ${
            mlbCritical
              ? "border-red-900/50 bg-red-950/20"
              : os.mlbDailyOps.lifecycle === "AWAITING_RESULT" ||
                  os.mlbDailyOps.lifecycle === "READY"
                ? "border-emerald-900/40 bg-emerald-950/10"
                : "border-zinc-800 bg-zinc-900/50"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-white">MLB 오늘 운영</h2>
            <StatusPill
              level={
                mlbCritical
                  ? "BLOCKED"
                  : os.mlbDailyOps.lifecycle === "NOT_STARTED" ||
                      os.mlbDailyOps.lifecycle === "IN_PROGRESS"
                    ? "WARNING"
                    : "READY"
              }
              label={os.mlbDailyOps.lifecycle}
            />
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-zinc-500">{koreanFieldLabel("Schedule")}</dt>
              <dd className="font-medium text-zinc-100">
                {os.mlbDailyOps.schedule.replace(/games/i, "경기")}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">{koreanFieldLabel("Starter")}</dt>
              <dd className="font-medium text-zinc-100">{os.mlbDailyOps.starter}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">{koreanFieldLabel("Odds")}</dt>
              <dd className="font-medium text-zinc-100">{os.mlbDailyOps.odds}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">{koreanFieldLabel("Lineup")}</dt>
              <dd className="font-medium text-zinc-100">{os.mlbDailyOps.lineup}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">{koreanFieldLabel("Prediction")}</dt>
              <dd className="font-medium text-zinc-100">
                {koreanStatusLabel(os.mlbDailyOps.prediction)}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">{koreanFieldLabel("Recommendation Record")}</dt>
              <dd className="font-medium text-zinc-100">
                {os.mlbDailyOps.recommendationRecord}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-400">
            <span>
              추천 Strong {os.mlbDailyOps.strongPickCount} · Good{" "}
              {os.mlbDailyOps.goodPickCount}
            </span>
            <span>
              연구 데이터 준비도{" "}
              {os.mlbDailyOps.researchReadyPercent != null
                ? `${os.mlbDailyOps.researchReadyPercent}%`
                : "집계 준비 중"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-600">
            연구 데이터 준비도는 예측 신뢰도가 아닙니다.
          </p>
          {!/^(RUN_|npm |ops:)/i.test(os.mlbDailyOps.nextAction) ? (
            <p className="mt-2 text-xs text-zinc-500">
              다음: {koreanOwnerCopy(os.mlbDailyOps.nextAction)}
            </p>
          ) : null}
          {os.mlbDailyOps.recentDays.length > 0 ? (
            <ul className="mt-3 space-y-1 border-t border-zinc-800 pt-3 text-xs text-zinc-400">
              {os.mlbDailyOps.recentDays.map((d) => (
                <li key={d.dateKst} className="flex flex-wrap gap-2">
                  <span className="font-mono text-zinc-300">{d.dateKst}</span>
                  <span
                    className={
                      d.lifecycle === "NO_PREGAME_SNAPSHOT" ||
                      d.lifecycle === "OPS_FAILURE"
                        ? "text-red-300"
                        : "text-zinc-400"
                    }
                    title={d.lifecycle}
                  >
                    {koreanStatusLabel(d.lifecycle)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3">
            <AdvancedDisclosure title="상세 정보 · MLB 운영">
              <p>Hash {os.mlbDailyOps.predictionHashShort ?? "—"}</p>
              <p>lifecycle={os.mlbDailyOps.lifecycle}</p>
              <p>nextAction={os.mlbDailyOps.nextAction}</p>
              <p>npm run ops:mlb-daily — 사전 Snapshot Continuity 최우선</p>
            </AdvancedDisclosure>
          </div>
        </section>
      ) : null}

      <section
        className={`rounded-xl border px-5 py-4 ${
          os.predictionContinuity.opsFailure
            ? "border-red-900/50 bg-red-950/20"
            : "border-zinc-800 bg-zinc-900/50"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">MLB 예측 연속성</h2>
          <StatusPill
            level={
              os.predictionContinuity.opsFailure
                ? "BLOCKED"
                : os.predictionContinuity.snapshotExists
                  ? "READY"
                  : "WARNING"
            }
            label={os.predictionContinuity.status}
          />
        </div>
        <p className="mt-2 text-sm text-zinc-300">
          {os.predictionContinuity.plainLanguage}
        </p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-zinc-500">스냅샷 생성</dt>
            <dd className="font-medium text-zinc-100">
              {koreanStatusLabel(os.predictionContinuity.snapshotExists ? "YES" : "NO")}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">생성 시각</dt>
            <dd className="font-mono text-xs text-zinc-200">
              {os.predictionContinuity.generatedAt ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">경기 시작 전 생성</dt>
            <dd className="font-medium text-zinc-100">
              {os.predictionContinuity.createdBeforeFirstStart === true
                ? koreanStatusLabel("YES")
                : os.predictionContinuity.createdBeforeFirstStart === false
                  ? koreanStatusLabel("NO")
                  : "—"}
            </dd>
          </div>
        </dl>
        <div className="mt-3">
          <AdvancedDisclosure title="고급 정보 · 예측 해시">
            <p className="break-all font-mono">
              {os.predictionContinuity.predictionHashSha256 ?? "—"}
            </p>
            <p className="mt-1">
              Continuity Guard · LIMITED_INPUT도 research prediction 저장 · 전날
              Snapshot 대체 금지
            </p>
          </AdvancedDisclosure>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">축구</h2>
          <StatusPill level={review.gateStatus} label={review.reviewStage} />
        </div>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">{koreanFieldLabel("Identity")}</dt>
            <dd className="text-zinc-200">{koreanStatusLabel(fb.stage)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">{koreanFieldLabel("1X2 Odds")}</dt>
            <dd className="text-zinc-200">{koreanStatusLabel(odds.oddsStage)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">{koreanFieldLabel("Result")}</dt>
            <dd className="text-zinc-200">{koreanStatusLabel(result.resultStage)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">{koreanFieldLabel("Review Foundation")}</dt>
            <dd className="text-zinc-200">{koreanStatusLabel(review.reviewStage)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">{koreanFieldLabel("Scorecard Foundation")}</dt>
            <dd className="text-zinc-200">{koreanStatusLabel(review.scorecardStage)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">{koreanFieldLabel("Prediction")}</dt>
            <dd className="text-zinc-200">{koreanStatusLabel(review.prediction)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-zinc-300">{review.plainLanguage}</p>
        <p className="mt-1 text-xs text-zinc-500">진행률 % 없음 · 연구 ≠ 공식</p>
      </section>

      <section className="rounded-xl border border-indigo-900/40 bg-indigo-950/20 px-5 py-4">
        <h2 className="mb-2 text-lg font-semibold text-indigo-200">운영 브리핑</h2>
        <p className="text-xs text-indigo-300/70">해석 참고 · 아직 결정이 아닙니다</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">{os.aiBrief}</p>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="mb-2 text-lg font-semibold text-white">이번 주 요약</h2>
        <ul className="space-y-1 text-sm text-zinc-300">
          {os.weekSummaryLines.map((line, i) => (
            <li key={i}>• {line}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-zinc-600">
          {memory.thisWeek.researchObservationNote}
        </p>
      </section>

      <p className="text-xs text-zinc-600">
        제품 준비 현황(출시 준비도)은{" "}
        <a
          href={osHref("/internal/admin", memory.dateKst)}
          className="text-sky-500 hover:underline"
        >
          관리자 도구
        </a>
        에서 확인할 수 있습니다. Hash·Artifact·Runtime은{" "}
        <a
          href={osHref("/internal/developer", memory.dateKst)}
          className="text-sky-500 hover:underline"
        >
          개발자 진단
        </a>
        에 있습니다.
      </p>
    </div>
  );
}
