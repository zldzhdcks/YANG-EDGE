import type {RichPreview} from '@/lib/football/official-canonical-v1/rich-preview';

export default function RichMatchPreview({preview:p,compact=false}:{preview:RichPreview;compact?:boolean}){
 return <article className="min-w-0 rounded-2xl bg-zinc-900/80 p-5 sm:p-7" data-rich-preview={p.targetId}>
  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400"><span>{p.competition} · {p.kickoffKst.slice(11,16)} KST</span><span>{p.lineupStatus==='CONFIRMED'?'XI AVAILABLE':'PRE-LINEUP'} · {p.quality} · v{p.version}</span></div>
  <h2 className="mt-3 text-xl font-semibold leading-snug text-white sm:text-2xl">{p.headline}</h2>
  <p className="mt-3 leading-relaxed text-zinc-300">{p.outlook}</p>
  <dl className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-zinc-950/70 p-4" aria-label="봉인된 공식 V1 확률">
   {([['HOME',p.officialV1.pHome],['DRAW',p.officialV1.pDraw],['AWAY',p.officialV1.pAway]] as const).map(([label,value])=><div key={label}><dt className="text-xs tracking-wider text-zinc-500">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-white sm:text-2xl">{(value*100).toFixed(2)}%</dd></div>)}
  </dl>
  <p className="mt-2 text-xs text-zinc-500">V1 봉인: {p.officialV1.createdAt.slice(0,10)} · 모델 재계산 없음</p>
  <div className="mt-6 grid gap-5 sm:grid-cols-2">{p.teams.map(t=><section key={t.id} className="min-w-0">
   <h3 className="font-semibold text-zinc-100">{t.name}</h3>
   <p className="mt-2 text-sm text-zinc-400">{p.seasonSplit?'이번 시즌 최근':'최근'} {t.form.last5.count}경기 · {t.form.last5.w}승 {t.form.last5.d}무 {t.form.last5.l}패 · {t.form.last5.gf}득점 {t.form.last5.ga}실점</p>
   <p className="mt-1 text-xs text-zinc-500">{p.historyCutoffAt.slice(0,10)} 관측 기준 · 같은 리그</p>
   <div className="mt-2 flex gap-1" aria-label="최신 경기부터 최근 폼">{t.form.last5.rows.map(r=><span key={r.fixtureId} title={r.kickoffUtc} className={`rounded px-2 py-1 text-xs font-semibold ${r.result==='W'?'bg-emerald-950 text-emerald-300':r.result==='L'?'bg-rose-950 text-rose-300':'bg-zinc-800 text-zinc-300'}`}>{r.result}</span>)}</div>
   {t.seasonContext&&<p className="mt-2 text-sm text-zinc-400">시즌 순위 별도 관측 ({t.seasonContext.providerFetchedAt.slice(0,10)}): {t.seasonContext.rank}위 · {t.seasonContext.played}경기 · {t.seasonContext.gf}득점 {t.seasonContext.ga}실점</p>}
   <h4 className="mt-4 text-xs font-medium uppercase tracking-wide text-zinc-500">주목할 선수 · 출전시간 기준</h4>
   <ul className="mt-2 space-y-2">{t.keyPlayers.map(k=><li key={k.providerPlayerId} className="text-sm"><span className="font-medium text-zinc-200">{k.name}</span>{p.confirmedKeyPlayerIds?.includes(k.providerPlayerId)&&<span className="ml-2 text-xs text-emerald-400">선발 확인</span>}<span className="block leading-relaxed text-zinc-400">{k.reason}</span></li>)}</ul>
  </section>)}</div>
  {p.seasonSplit&&<div className="mt-6 space-y-5">{p.sections.filter(s=>['CURRENT_SEASON_FORM','PREVIOUS_SEASON_CONTEXT','MODEL_HISTORICAL_WINDOW'].includes(s.title)).map(s=><section key={s.title}><h3 className="text-xs font-semibold tracking-wide text-zinc-400">{s.title}</h3><p className="mt-2 text-sm leading-7 text-zinc-300">{s.text}</p></section>)}</div>}
  <section className="mt-6"><h3 className="font-medium text-zinc-100">경기 흐름의 관전 포인트</h3><p className="mt-2 text-sm leading-7 text-zinc-300">{p.expectedFlow}</p></section>
  {compact&&<a className="mt-4 inline-block text-sm font-medium text-zinc-200 underline decoration-zinc-600 underline-offset-4" href={`/analysis/${encodeURIComponent(p.targetId)}?fromDate=${p.kickoffKst.slice(0,10)}`}>전체 프리뷰 읽기 →</a>}
  {!compact&&p.sections.filter(s=>!['YANG EDGE VIEW','RECENT FORM','EXPECTED MATCH FLOW','KEY PLAYERS','CURRENT_SEASON_FORM','PREVIOUS_SEASON_CONTEXT','MODEL_HISTORICAL_WINDOW'].includes(s.title)).map(s=><section className="mt-6" key={s.title}><h3 className="text-xs font-medium tracking-wide text-zinc-400">{s.title}</h3><p className="mt-2 text-sm leading-7 text-zinc-300">{s.text}</p></section>)}
  <details className="mt-6 rounded-xl bg-zinc-950/60 px-4 py-3"><summary className="cursor-pointer text-sm text-zinc-400">Data Quality · {p.lineupStatus==='CONFIRMED'?'선발 확인':'선발 대기'} / 가용 상태 {p.availabilityStatus}</summary><ul className="mt-3 space-y-2 text-xs leading-6 text-zinc-500">{[...new Set(p.dataQuality)].map(s=><li key={s}>{s}</li>)}</ul></details>
 </article>;
}
