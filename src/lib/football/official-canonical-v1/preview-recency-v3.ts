import assert from 'node:assert/strict';
import {recentForm,type RichPreview} from './rich-preview';
import {playerEvidenceFromContext,selectRoleContext} from './preview-player-context-v3';
export function refreshPreview(previous:RichPreview,history:any[],context:any,registry:any[],createdAt:string,previousHash:string){
 const start=Date.parse(previous.kickoffKst),now=Date.parse(createdAt);assert(Number.isFinite(now)&&now<start-60000,'PREGAME_REQUIRED');
 assert(history.length>0&&history.every(h=>h.season===previous.season&&h.leagueId===previous.leagueId),'CURRENT_SEASON_ONLY');
 const unique=new Map<number,any>();for(const h of history){assert(h.providerFixtureId!==previous.fixtureId,'TARGET_EXCLUDED');const old=unique.get(h.providerFixtureId);if(old)for(const key of ['homeTeamId','awayTeamId','fullTimeHomeGoals','fullTimeAwayGoals','kickoffUtc'])assert(old[key]===h[key],'HISTORY_CONFLICT');else{};unique.set(h.providerFixtureId,h);}
 const rows=[...unique.values()];
 const teams=previous.teams.map(t=>{
  const all=recentForm(rows,t.id,previous.fixtureId,previous.leagueId,createdAt),home=recentForm(rows,t.id,previous.fixtureId,previous.leagueId,createdAt,'HOME'),away=recentForm(rows,t.id,previous.fixtureId,previous.leagueId,createdAt,'AWAY');
  const source=context.teams.find((x:any)=>x.teamId===t.id&&x.fixtureId===previous.fixtureId);assert(source,'PLAYER_CONTEXT_MISSING');
  const players=playerEvidenceFromContext(source,registry,createdAt),roles=selectRoleContext(players,createdAt,previous.fixtureId,all.all.rows.map(r=>r.fixtureId));
  return{teamId:t.id,name:t.name,current:{all,home,away},roles,playerObservedAt:source.playerReceipts.map((r:any)=>r.providerFetchedAt).sort().at(-1),latestCompleted:all.all.rows[0]?.kickoffUtc??null,missingFromOld:all.all.rows.filter(r=>!previous.teams.find(x=>x.id===t.id)!.form.all.rows.some(o=>o.fixtureId===r.fixtureId)).map(r=>r.fixtureId)};
 });
 const fmt=(f:any)=>`${f.count}경기 ${f.w}승 ${f.d}무 ${f.l}패, ${f.gf}득점 ${f.ga}실점`;
 const [h,a]=teams;
 const flow=`최신 완료 경기 관측에서 ${h.name}는 이번 시즌 ${fmt(h.current.all.all)}, ${a.name}는 ${fmt(a.current.all.all)}입니다. 홈·원정으로 나누면 ${h.name} 홈 ${fmt(h.current.home.all)}, ${a.name} 원정 ${fmt(a.current.away.all)}입니다. 이 득실점 흐름이 이번 맞대결에서도 이어지는지가 관전 포인트입니다. 선수의 패스·태클·선방은 관측된 기여를 설명하는 기본 지표이며 전술이나 인과적 영향력을 증명하지는 않습니다. 최근 경기별 선수 자료와 공식 XI가 없으므로 특정 선수의 최근 활약이나 오늘 역할을 단정하지 않습니다. V1의 42.20 / 25.79 / 32.01%는 9월 13일 봉인값으로 그대로 유지합니다.`;
 const recency={engineAsOf:previous.officialV1.createdAt,engineInputAsOf:previous.historyCutoffAt,previewAsOf:createdAt,targetCutoff:previous.kickoffKst,fixtureObservedAt:rows.map(r=>r.providerFetchedAt).sort().at(-1),teams,roleDetailStatus:'UNRESOLVED_EXCEPT_GK',recentPlayerEvidenceStatus:'NOT_ENOUGH_VERIFIED_EVIDENCE',recentPlayerEndpointStatus:'LEGAL_REVIEW_REQUIRED_FOR_NEW_ENDPOINT',mvpStatus:'UNVERIFIED',modelInputAllowed:false};
 return{...previous,version:previous.version+1,createdAt,previousHash,revisionReason:'PREVIEW_RECENCY_ROLE_AWARE_V3',recency,expectedFlow:flow,sections:previous.sections.filter(s=>!['CURRENT_SEASON_FORM','EXPECTED MATCH FLOW','KEY PLAYERS','KEY VARIABLES'].includes(s.title)).concat([{title:'CURRENT_SEASON_FORM',text:teams.map(t=>`${t.name}: ${fmt(t.current.all.all)}`).join(' ')},{title:'EXPECTED MATCH FLOW',text:flow},{title:'KEY PLAYERS',text:'시즌 핵심·구조적 기여를 역할 내 근거로 분리. 최근 경기별 기여 미확보, MATCH KEY PLAYER=WAITING_FOR_XI.'}]),dataQuality:[...previous.dataQuality.filter(s=>!s.startsWith('Season form cutoff:')&&!s.startsWith('Key players:')),`ENGINE_AS_OF=${previous.officialV1.createdAt}; PREVIEW_AS_OF=${createdAt}`,'현재 시즌 폼은 새 Preview 관측; 이전 시즌과 MODEL HISTORICAL WINDOW는 기존 봉인 설명 유지.','세부 역할은 GK 외 미확인. 패스/태클/선방은 기초 카운터이며 영향력 점수·우열 순위 아님.','최근 선수별 경기 자료: 미확보. 새 endpoint/필드 연결은 LEGAL_REVIEW_REQUIRED.','공식 MVP/POTM 미확인; MVP DB 생성 없음.']} as RichPreview;
}
