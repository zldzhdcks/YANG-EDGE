import type { ReleaseChecklistView } from "@/lib/internal/release-checklist-v0";
import type { OsLevel } from "@/lib/internal/yang-edge-os-presenter";
import { StatusPill, levelSurface } from "./StatusPill";

function toOsLevel(status: string): OsLevel {
  const s = status.toUpperCase();
  if (s.startsWith("READY")) return "READY";
  if (s.includes("IN_PROGRESS") || s === "OPEN") return "WARNING";
  if (s.startsWith("BLOCKED")) return "BLOCKED";
  return "OFF";
}

function shortCriticalTitle(title: string): string {
  if (/starter.*hash/i.test(title) || /deterministic hash/i.test(title)) {
    return "Starter Hash";
  }
  if (/pregame usability|usability gate/i.test(title)) {
    return "Pregame Validity";
  }
  if (/repository hygiene/i.test(title)) return "Repository Hygiene";
  if (/provider/i.test(title) && /approv/i.test(title)) {
    return "Provider Approval";
  }
  if (/football prediction/i.test(title)) return "Football Prediction";
  if (/frozen artifact/i.test(title)) return "Frozen Artifact";
  if (/doubleheader/i.test(title)) return "Doubleheader ID";
  if (/표본/i.test(title)) return "Sample Size";
  if (/kbo prediction/i.test(title)) return "KBO Prediction";
  if (/engine/i.test(title)) return "Engine Approval";
  if (/legal|commercial|terms/i.test(title)) return "Legal / Terms";
  return title.length > 28 ? `${title.slice(0, 26)}…` : title;
}

/** Actionable criticals for the 5-second glance (IN_PROGRESS / OPEN first). */
function pickCriticalDisplay(release: ReleaseChecklistView) {
  const ranked = [...release.criticalIssues].sort((a, b) => {
    const rank = (s: string) => {
      const u = s.toUpperCase();
      if (u.includes("IN_PROGRESS")) return 0;
      if (u.startsWith("OPEN")) return 1;
      if (u.includes("NOT_STARTED")) return 2;
      if (u.startsWith("READY")) return 3;
      return 4;
    };
    return rank(a.status) - rank(b.status);
  });
  return ranked.slice(0, 6);
}

export default function ReleaseStatusCard({
  release,
}: {
  release: ReleaseChecklistView;
}) {
  const criticals = pickCriticalDisplay(release);
  const overallLevel = toOsLevel(release.overallStatus);

  return (
    <section
      className={`rounded-xl border px-5 py-4 ${levelSurface(overallLevel)}`}
      aria-label="제품 준비 현황"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-zinc-500">
            제품 준비 현황
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            YANG EDGE {release.currentVersion}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            읽기 전용 기준 문서: {release.sourcePath}
            {release.readOnly ? " · 수정 없음" : ""}
          </p>
        </div>
        <StatusPill
          level={overallLevel}
          label={release.overallStatus}
        />
      </div>

      {!release.loaded ? (
        <p className="mt-3 text-sm text-red-300">
          Checklist를 읽지 못했습니다. {release.error}
        </p>
      ) : null}

      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs text-zinc-500">현재 버전</dt>
          <dd className="mt-0.5 text-base font-semibold text-zinc-100">
            {release.currentVersion}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">목표 단계</dt>
          <dd className="mt-0.5 text-base font-semibold text-zinc-100">
            {release.targetRelease}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">전체 상태</dt>
          <dd className="mt-0.5 text-base font-semibold text-zinc-100">
            {release.overallStatus}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-200">출시 준비도</h3>
          <span className="text-2xl font-bold tabular-nums text-white">
            {release.overallProgressPercent}%
          </span>
        </div>
        <p
          className="mt-1 font-mono text-sm tracking-tight text-sky-300/90"
          aria-hidden
        >
          {release.progressBar}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Private Beta 조건 {release.privateBetaMet}/{release.privateBetaTotal}{" "}
          충족 (출시 체크리스트 · 오늘 운영 완료율 아님)
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">현재 우선 작업</h3>
          <p className="mt-0.5 text-xs text-zinc-500">이번 주 집중 · 문서 다음 액션</p>
          {release.currentFocus.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">표시할 Focus 없음</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-300">
              {release.currentFocus.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-zinc-600" aria-hidden>
                    •
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-zinc-200">주요 준비 과제</h3>
          <p className="mt-0.5 text-xs text-zinc-500">체크리스트 Critical Issues</p>
          {criticals.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">표시할 Critical 없음</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {criticals.map((c) => (
                <li key={c.id}>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${levelSurface(toOsLevel(c.status))}`}
                    title={`${c.title} — ${c.status}`}
                  >
                    <StatusPill level={toOsLevel(c.status)} label={c.status} />
                    <span className="font-medium text-zinc-100">
                      {shortCriticalTitle(c.title)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-zinc-200">준비 영역</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {release.sections.map((s) => (
            <div
              key={s.id}
              className={`rounded-lg border px-3 py-2 ${levelSurface(toOsLevel(s.status))}`}
              title={s.detail}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-semibold text-white">{s.label}</span>
                <StatusPill level={toOsLevel(s.status)} label={s.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
