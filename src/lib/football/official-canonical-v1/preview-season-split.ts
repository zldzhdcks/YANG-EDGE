import assert from 'node:assert/strict';
import {recentForm,type RichPreview} from './rich-preview';
import type {SealCandidate} from './index';
/** Season is bound by the original provider-query receipt hash, never by date guessing. */
export function splitPreviewSeasons(previous:RichPreview,c:SealCandidate,historyAudits:any[],sourceReportHash:string,createdAt:string,previousHash:string):RichPreview{
 assert(c.eligible&&c.classification==='CANONICAL'&&c.predictionId===previous.canonicalPredictionId,'CANONICAL_REQUIRED');
 assert(Date.parse(createdAt)<Date.parse(previous.kickoffKst),'PREGAME_REQUIRED');
 const history=c.input.payload.completedHistory,current=c.identity!.season,prior=current-1;
 const classified=history.map((r:any)=>{const matches=historyAudits.filter(a=>a.leagueId===r.leagueId&&a.sourceHash===r.sourceHash&&a.providerFetchedAt===r.providerFetchedAt);assert(matches.length===1&&Number.isInteger(matches[0].season),'SEASON_PROVENANCE_REQUIRED');return{row:r,season:matches[0].season};});
 const stats=(rows:any[],teamId:number)=>({all:recentForm(rows,teamId,c.fixtureId,c.identity!.leagueId,c.snapshot.payload.cutoffAt),home:recentForm(rows,teamId,c.fixtureId,c.identity!.leagueId,c.snapshot.payload.cutoffAt,'HOME'),away:recentForm(rows,teamId,c.fixtureId,c.identity!.leagueId,c.snapshot.payload.cutoffAt,'AWAY')});
 const teams=previous.teams.map((team,i)=>{
  const currentStats=stats(classified.filter((r:any)=>r.season===current).map((r:any)=>r.row),team.id),previousStats=stats(classified.filter((r:any)=>r.season===prior).map((r:any)=>r.row),team.id),modelStats=stats(history,team.id);
  const other=classified.filter((x:any)=>x.season!==current&&x.season!==prior&&(x.row.homeTeamId===team.id||x.row.awayTeamId===team.id)).length;
  return{teamId:team.id,name:team.name,current:currentStats,previous:previousStats,modelWindow:modelStats,modelRelevantVenue:i===0?'HOME':'AWAY',otherSeasonMatches:other};
 });
 const fmt=(f:any)=>`${f.count}경기 ${f.w}승 ${f.d}무 ${f.l}패 · ${f.gf}득점 ${f.ga}실점`;
 const seasonName=(s:number)=>`${s}/${String(s+1).slice(-2)}`;
 const currentText=teams.map(t=>`${t.name}: ${fmt(t.current.all.all)}. 홈 ${fmt(t.current.home.all)}, 원정 ${fmt(t.current.away.all)}. 이번 시즌 관측 경기 중 최신 ${fmt(t.current.all.last5)}.`).join(' ');
 const previousText=teams.map(t=>`${t.name}: ${fmt(t.previous.all.all)}. 홈 ${fmt(t.previous.home.all)}, 원정 ${fmt(t.previous.away.all)}.`).join(' ')+ ' 이전 시즌의 모델 입력에 포함된 부분 표본이며, 시즌 전체 기록이나 이번 시즌 평균에 합산하지 않는다.';
 const [h,a]=teams;
 const flow=`이번 시즌 관측 표본: ${h.name} 홈 ${fmt(h.current.home.all)}; ${a.name} 원정 ${fmt(a.current.away.all)}. 관전 포인트는 이 두 기록의 공격·수비 흐름이 이번 맞대결에서도 이어지는지다. 표본 수가 적으므로 이전 시즌 경기를 덧붙여 최근 경기 수를 늘리지 않는다.`;
 const modelText=teams.map(t=>`${t.name}: 전체 관련 ${t.modelWindow.all.all.count}경기, ${t.modelRelevantVenue==='HOME'?'홈':'원정'} 관련 ${t.modelRelevantVenue==='HOME'?t.modelWindow.home.all.count:t.modelWindow.away.all.count}경기.`).join(' ')+' V1의 봉인된 historical rolling window이며 이번 시즌 폼을 의미하지 않는다. 모델 입력과 확률은 변경하지 않았다.';
 const sections=previous.sections.filter(s=>!['RECENT FORM','HOME TEAM','AWAY TEAM','EXPECTED MATCH FLOW','CURRENT_SEASON_FORM','PREVIOUS_SEASON_CONTEXT','MODEL_HISTORICAL_WINDOW'].includes(s.title)).map(s=>s.title==='KEY VARIABLES'?{...s,text:'이번 시즌에 실제 관측된 경기 수, 홈·원정 득실점, 출전시간이 높은 선수들의 실제 선발 포함 여부를 함께 살펴본다. 표본이 5경기 또는 10경기에 못 미치면 확보된 이번 시즌 경기만 사용한다.'}:s);
 sections.splice(1,0,{title:'CURRENT_SEASON_FORM',text:`${seasonName(current)} · ${currentText}`},{title:'PREVIOUS_SEASON_CONTEXT',text:`${seasonName(prior)} · ${previousText}`},{title:'EXPECTED MATCH FLOW',text:flow},{title:'MODEL_HISTORICAL_WINDOW',text:modelText});
 return{...previous,version:previous.version+1,createdAt,previousHash,revisionReason:'SEASON_BOUNDARY_PREVIEW_CORRECTION_V1',seasonSplit:{currentSeason:current,previousSeason:prior,teams,sourceReportHash},teams:previous.teams.map((t,i)=>({...t,form:teams[i].current.all,split:i===0?teams[i].current.home:teams[i].current.away})),recentFormSummary:currentText,expectedFlow:flow,sections,dataQuality:[...previous.dataQuality.filter(s=>!s.startsWith('Recent form:')),'Recent form: current-season only; previous-season context separately labeled; season identity from original sourceHash receipt',`Season form cutoff: ${previous.historyCutoffAt}. 별도 시즌 순위/선수 통계의 수집 시각과 구분.`]};
}
