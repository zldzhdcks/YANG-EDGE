import type { ReactNode } from 'react';
import type { loadResearchExplorer } from '@/lib/public-analysis/load-research-explorer';
import { researchHref, type ResearchLine } from '@/lib/public-analysis/research-explorer-contract';
import { dashboardView, qualityLabel, sportLabel, researchTime } from './dashboard-view';

const panel = 'min-w-0 rounded-2xl bg-zinc-900/80';
const link = 'rounded-lg text-sm font-medium text-emerald-300 transition hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div><p className="text-[10px] font-medium tracking-[0.18em] text-zinc-500">{eyebrow}</p><h2 className="mt-2 text-xl font-semibold tracking-tight text-white">{title}</h2></div>{children}
  </div>;
}

function Probability({ line }: { line: ResearchLine }) {
  return <div>
    <p className="text-[11px] text-zinc-400">YANG EDGE Model Probability</p>
    {line.probability ? <dl className="mt-3 grid grid-cols-3 gap-2">
      {(['home', 'draw', 'away'] as const).map(side => <div key={side} className="min-w-0 rounded-lg bg-black/20 px-2 py-3">
        <dt className="text-[10px] tracking-wider text-zinc-500">{side.toUpperCase()}</dt>
        <dd className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-emerald-300 sm:text-2xl">{(line.probability![side] * 100).toFixed(2)}<span className="text-xs">%</span></dd>
      </div>)}
    </dl> : <p className="mt-3 text-sm text-zinc-500">모델 확률 준비 전</p>}
  </div>;
}

export default function ResearchHome({ data }: { data: ReturnType<typeof loadResearchExplorer> }) {
  const view = dashboardView(data);
  const explorerHref = `/research?batch=${encodeURIComponent(data.batch)}&date=${encodeURIComponent(data.date)}`;
  return <main className="mx-auto max-w-6xl space-y-10 px-4 pb-12 pt-10 text-zinc-300 sm:px-6 sm:pt-14 [overflow-wrap:anywhere]">
    <section data-dashboard-section="hero" className="max-w-3xl">
      <p className="text-xs font-semibold tracking-[0.24em] text-emerald-400">YANG EDGE</p>
      <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">데이터 기반 스포츠 리서치</h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400">경기 데이터와 모델을 바탕으로 사용자가 직접 판단할 수 있는 연구·분석 정보를 제공합니다.</p>
      <a href={explorerHref} className="mt-6 inline-flex items-center gap-6 rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">오늘의 리서치 보기 <span aria-hidden>↗</span></a>
    </section>

    <section data-dashboard-section="today">
      <SectionHeading eyebrow="TODAY'S RESEARCH" title="오늘의 리서치"><p className="text-xs tabular-nums text-zinc-500">{data.date} · KST 기준</p></SectionHeading>
      <div data-dashboard-grid="stats" className="grid gap-3 md:grid-cols-5">
        {[{ label: '오늘 연구 경기', value: view.covered }, ...view.sports].map((item, i) => <div key={item.label} className={`${panel} flex items-center justify-between gap-3 px-5 py-3 md:block md:py-5 ${i === 0 ? 'ring-1 ring-inset ring-emerald-400/20' : ''}`}>
          <p className="text-xs text-zinc-400">{item.label}</p><p className={`text-2xl font-semibold tabular-nums md:mt-2 md:text-3xl ${i === 0 ? 'text-emerald-300' : 'text-white'}`}>{item.value}<span className="ml-1 text-xs font-normal text-zinc-500">경기</span></p>
        </div>)}
      </div>
      <p className="mt-4 text-xs leading-6 text-zinc-400">전체 연구 커버리지 <span className="text-white">{view.covered} / {data.total}</span><span className="mx-3 text-zinc-700">·</span>축구 기본 분석 {view.standard} · 경기 정보 {view.basic}</p>
    </section>

    <section data-dashboard-section="featured">
      <SectionHeading eyebrow="FEATURED RESEARCH" title="주요 경기 리서치"><span className="text-xs text-zinc-500">우선 확인 경기 · 확률순 선정 아님</span></SectionHeading>
      <div data-dashboard-grid="featured" className="grid gap-4 md:grid-cols-2">
        {view.featured.map(d => <article key={d.line.targetId} data-featured-target={d.line.targetId} className={`${panel} flex flex-col p-5 sm:p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><p className="text-zinc-400">{sportLabel(d.line.sport)} · {d.line.competition}</p><span className="rounded-full bg-white/5 px-3 py-1 text-zinc-300">{qualityLabel(d.line.tier)}</span></div>
          <p className="mt-4 text-xs tabular-nums text-zinc-500">{researchTime(d.line.kickoff)}</p>
          <h3 className="mb-6 mt-2 text-xl font-semibold leading-8 tracking-tight text-white"><span>{d.preview?.teams[0].name ?? d.line.home}</span><span className="mx-2 text-sm font-normal text-zinc-600">vs</span><span>{d.preview?.teams[1].name ?? d.line.away}</span></h3>
          <Probability line={d.line} />
          <dl className="mb-5 mt-5 space-y-2 text-xs leading-5">
            <div className="flex flex-wrap justify-between gap-x-3"><dt className="text-zinc-500">모델 상태</dt><dd>{d.line.probability ? 'V1 모델 분석 제공' : '모델 확률 준비 전'}</dd></div>
            <div className="flex flex-wrap justify-between gap-x-3"><dt className="text-zinc-500">모델 기준 시점</dt><dd>{researchTime(d.line.engineAsOf)}</dd></div>
            <div className="flex flex-wrap justify-between gap-x-3"><dt className="text-zinc-500">최신 분석 반영 시점</dt><dd>{researchTime(d.line.previewAsOf)}</dd></div>
            <div className="flex flex-wrap justify-between gap-x-3"><dt className="text-zinc-500">라인업</dt><dd>{d.line.lineupStatus === 'CONFIRMED' ? '공식 발표 확인' : '공식 라인업 확인 전'}</dd></div>
          </dl>
          <a href={researchHref(d.line.targetId, data.batch, data.date)} className={`${link} mt-auto border-t border-white/5 pt-4`}>상세 리서치 보기 <span aria-hidden>→</span></a>
        </article>)}
      </div>
      {view.featured.length === 0 && <p className={`${panel} p-5 text-sm text-zinc-400`}>이 연구 묶음에는 우선 확인 경기가 없습니다. 전체 목록에서 경기 정보를 확인하세요.</p>}
    </section>

    <section data-dashboard-section="explorer">
      <SectionHeading eyebrow="RESEARCH EXPLORER" title="Research Explorer"><a href={explorerHref} className={link}>전체 {data.total}경기 보기 <span aria-hidden>→</span></a></SectionHeading>
      <p className="mb-4 text-sm leading-6 text-zinc-400">모델 확률, 종목, 대회, 경기 시간 기준으로 Research를 탐색할 수 있습니다.</p>
      <p className="mb-4 text-xs text-zinc-500">분석 자료 수준 · 최신 반영 순으로 {view.preview.length}경기를 미리 보여드립니다.</p>
      <div className="space-y-2">
        {view.preview.map(l => <a data-dashboard-preview={l.targetId} key={l.targetId} href={researchHref(l.targetId, data.batch, data.date)} className={`${panel} grid gap-3 px-5 py-4 transition hover:bg-zinc-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 md:grid-cols-[minmax(0,1fr)_150px_180px] md:items-center`}>
          <div className="min-w-0"><p className="text-[11px] text-zinc-500">{sportLabel(l.sport)} · {l.competition}</p><h3 className="mt-1 text-sm font-medium text-white">{l.home} <span className="px-1 text-zinc-600">vs</span> {l.away}</h3></div>
          <div className="text-xs leading-6"><p className="text-zinc-300">{qualityLabel(l.tier)}</p><p className="tabular-nums text-zinc-500">{researchTime(l.kickoff)}</p></div>
          <div className="text-xs leading-6 text-zinc-400"><p>{l.probability ? 'V1 모델 분석 제공' : '모델 확률 준비 전'}</p>{l.probability && <p className="tabular-nums text-emerald-300">H {(l.probability.home * 100).toFixed(2)}% · D {(l.probability.draw * 100).toFixed(2)}% · A {(l.probability.away * 100).toFixed(2)}%</p>}</div>
        </a>)}
      </div>
    </section>

    <section id="engine-research" data-dashboard-section="engine" className="scroll-mt-24">
      <SectionHeading eyebrow="YANG EDGE ENGINE RESEARCH" title="모델을 검증하는 과정" />
      <div data-dashboard-grid="engines" className="grid gap-4 md:grid-cols-3">
        <article className={`${panel} p-5`}><p className="text-xs text-emerald-400">현재 공식 모델</p><h3 className="mt-3 text-xl font-semibold text-white">V1 <span className="text-sm font-normal text-zinc-400">Poisson Baseline</span></h3><p className="mt-4 text-sm leading-7 text-zinc-400">과거 득실점과 홈·원정 기록을 기반으로 하는 기본 비교 모델입니다.</p><p className="mt-4 text-xs text-zinc-500">봉인된 모델 확률 유지 · Official Baseline</p></article>
        <article className={`${panel} p-5`}><p className="text-xs text-zinc-400">연구 완료 · 공식 모델 미적용</p><h3 className="mt-3 text-xl font-semibold text-white">V3 / V3.1</h3><p className="mt-1 text-xs text-zinc-500">Advanced Team Metrics</p><p className="mt-4 text-sm leading-7 text-zinc-400">xG · Total Shots · Shots on Goal 등 고급 팀 지표를 검증했지만 승격 기준을 충족하지 않아 현재 공식 모델에는 적용하지 않았습니다.</p></article>
        <article className={`${panel} p-5`}><p className="text-xs text-zinc-400">개발 중 · 근거 수집 기반 준비</p><h3 className="mt-3 text-xl font-semibold text-white">V4</h3><p className="mt-1 text-xs text-zinc-500">Player / Lineup / Availability</p><p className="mt-4 text-sm leading-7 text-zinc-400">선수 등록·소속, 선발 명단 증거, 부상·징계 자료 구조를 준비했습니다. 선수 영향력·대체 선수·라인업 강도 차이는 연구 과제입니다.</p><p className="mt-4 text-xs leading-6 text-zinc-300">V4 엔진은 미구현이며 현재 공식 확률에는 반영되지 않습니다.</p></article>
      </div>
    </section>

    <section data-dashboard-section="coverage">
      <SectionHeading eyebrow="RESEARCH QUALITY & COVERAGE" title="확보한 자료만큼, 투명하게" />
      <div className={`${panel} grid gap-6 p-5 sm:p-6 md:grid-cols-2`}>
        <div><p className="text-xs text-zinc-400">전체 연구 커버리지</p><p className="mt-3 text-3xl font-semibold tabular-nums text-white">{view.covered}<span className="text-lg text-zinc-500"> / {data.total}</span></p><p className="mt-3 text-xs leading-6 text-zinc-400">{view.sports.map(s => `${s.label} ${s.value}`).join(' · ')}</p></div>
        <div><p className="text-xs text-zinc-400">축구 · 기본 분석 이상</p><p className="mt-3 text-3xl font-semibold tabular-nums text-white">{view.standardOrAbove}<span className="text-lg text-zinc-500"> / {view.football}</span></p><p className="mt-3 text-xs leading-6 text-zinc-400">심층 분석 {view.full} · 기본 분석 {view.standard} · 경기 정보 {view.basic}<br/>검증 자료 확보 수준에 따라 분석의 깊이가 다릅니다. 분석 단계는 추천 등급이 아닙니다.</p></div>
      </div>
      <p className="mt-4 text-sm leading-7 text-zinc-400">YANG EDGE는 모든 경기에서 공식 선택을 발행하지 않습니다. 선택 의견과 관계없이 확보된 경기 데이터와 모델 Research는 계속 제공됩니다.</p>
    </section>

    <section data-dashboard-section="pick" aria-label="OPTIONAL PICK" className="rounded-xl bg-zinc-900/40 px-5 py-4"><h2 className="text-xs font-medium text-zinc-400">공식 선택 의견</h2><p className="mt-2 text-sm text-zinc-500">현재 발행된 공식 선택 의견이 없습니다.</p></section>
    <section data-dashboard-section="disclosure" aria-label="이용 안내" className="border-t border-white/5 pt-5"><p className="text-xs leading-6 text-zinc-500">YANG EDGE는 스포츠 데이터와 모델을 기반으로 연구·분석 정보를 제공합니다. 표시된 확률은 모델 추정치이며 실제 경기 결과를 보장하지 않습니다. 분석 결과는 특정 거래나 수익을 보장하지 않으며 최종 판단은 이용자에게 있습니다.</p></section>
  </main>;
}
