import assert from 'node:assert/strict';
import {recentForm} from '../football/official-canonical-v1/rich-preview';

export type ResearchIdentity={fixtureId:number;leagueId:number;season:number;kickoff:string;teams:{id:number;name:string}[]};
export function buildTeamResearch(identity:ResearchIdentity,history:any[]){
 assert(identity.teams.length===2&&identity.teams[0].id!==identity.teams[1].id,'TEAM_IDENTITY');
 const unique=new Map<number,any>();
 for(const h of history){
  assert(h.providerFixtureId!==identity.fixtureId,'TARGET_EXCLUDED');
  if(h.season!==identity.season||h.leagueId!==identity.leagueId)continue;
  assert(h.fixtureStatus==='FT','COMPLETED_ONLY');
  assert(Date.parse(h.kickoffUtc)<Date.parse(h.providerFetchedAt)&&Date.parse(h.providerFetchedAt)<Date.parse(identity.kickoff),'CUTOFF_SAFE');
  assert(/^[a-f0-9]{64}$/.test(h.sourceHash),'SOURCE_HASH_REQUIRED');
  const prior=unique.get(h.providerFixtureId);
  if(prior)for(const k of ['kickoffUtc','homeTeamId','awayTeamId','fullTimeHomeGoals','fullTimeAwayGoals'])assert.equal(prior[k],h[k],'HISTORY_CONFLICT');
  unique.set(h.providerFixtureId,h);
 }
 const rows=[...unique.values()];
 const teams=identity.teams.map(t=>({teamId:t.id,name:t.name,current:{
  all:recentForm(rows,t.id,identity.fixtureId,identity.leagueId,identity.kickoff),
  home:recentForm(rows,t.id,identity.fixtureId,identity.leagueId,identity.kickoff,'HOME'),
  away:recentForm(rows,t.id,identity.fixtureId,identity.leagueId,identity.kickoff,'AWAY')
 }}));
 return{teams,season:identity.season,asOf:rows.map(r=>r.providerFetchedAt).sort().at(-1)??null};
}
export type TeamResearch=ReturnType<typeof buildTeamResearch>;
export function depthGate(teams:TeamResearch['teams']|null,identityVerified:boolean){
 const gaps:string[]=[];
 if(!identityVerified)gaps.push('PROVIDER_IDENTITY_UNRESOLVED');
 const current=!!teams?.every(t=>t.current.all.all.count>0);
 if(!current)gaps.push('MISSING_CURRENT_SEASON_DATA','MISSING_RECENT_FORM','MISSING_HOME_AWAY_SPLIT','TEMPORAL_EVIDENCE_INCOMPLETE');
 // No Prediction, XI, player or V4 gate. Zero venue matches remain an explicit small sample.
 return{tier:identityVerified&&current?'STANDARD' as const:'BASIC' as const,gaps};
}
export function teamResearchSummary(teams:TeamResearch['teams'],hasProbability:boolean){
 const [h,a]=teams,hs=h.current.home.all,as=a.current.away.all;
 const venue=(name:string,label:string,s:typeof hs)=>`${name}는 이번 시즌 ${label} ${s.count}경기에서 ${s.w}승 ${s.d}무 ${s.l}패, ${s.gf}득점·${s.ga}실점을 기록했습니다.`;
 const recent=teams.map(t=>{const s=t.current.all.last5;return`${t.name} ${s.count}경기 ${s.w}승 ${s.d}무 ${s.l}패`;}).join(', ');
 const sample=hs.count<5||as.count<5?' 홈·원정 표본이 5경기 미만인 팀이 있어 경기별 변동을 함께 고려해야 합니다.':'';
 return[venue(h.name,'홈',hs),venue(a.name,'원정',as),`이번 시즌 최근 기록은 ${recent}입니다.${sample}`,hasProbability?'공식 V1 확률은 별도로 봉인된 시점의 판단이며 이 팀 기록으로 다시 계산하지 않았습니다.':'공식 V1 확률은 제공되지 않으며 팀 흐름 중심의 Research입니다.'];
}
