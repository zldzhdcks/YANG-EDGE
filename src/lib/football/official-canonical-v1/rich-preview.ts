/** Editorial projections only. No fitting, provider, target-result or grade dependency. */
import assert from 'node:assert/strict';
import type {SealCandidate} from './index';

export type FormRow={fixtureId:number;kickoffUtc:string;venue:'HOME'|'AWAY';gf:number;ga:number;result:'W'|'D'|'L';providerFetchedAt:string;sourceHash:string};
export function recentForm(history:any[],teamId:number,targetId:number,leagueId:number,cutoff:string,venue?:'HOME'|'AWAY'){
 const seen=new Set<number>();const rows:FormRow[]=[];
 for(const h of history){
  assert(h.providerFixtureId!==targetId,'TARGET_IN_HISTORY');assert(h.leagueId===leagueId,'WRONG_LEAGUE');
  assert(h.fixtureStatus==='FT','COMPLETED_ONLY');
  assert(Date.parse(h.kickoffUtc)<Date.parse(h.providerFetchedAt)&&Date.parse(h.providerFetchedAt)<=Date.parse(cutoff),'AS_OF_VIOLATION');
  assert(!seen.has(h.providerFixtureId),'DUPLICATE_HISTORY');seen.add(h.providerFixtureId);
  assert([h.fullTimeHomeGoals,h.fullTimeAwayGoals].every(v=>Number.isInteger(v)&&v>=0),'INVALID_SCORE');
  if(h.homeTeamId!==teamId&&h.awayTeamId!==teamId)continue;
  const home=h.homeTeamId===teamId,v=home?'HOME':'AWAY';if(venue&&venue!==v)continue;
  const gf=home?h.fullTimeHomeGoals:h.fullTimeAwayGoals,ga=home?h.fullTimeAwayGoals:h.fullTimeHomeGoals;
  rows.push({fixtureId:h.providerFixtureId,kickoffUtc:h.kickoffUtc,venue:v,gf,ga,result:gf>ga?'W':gf===ga?'D':'L',providerFetchedAt:h.providerFetchedAt,sourceHash:h.sourceHash});
 }
 rows.sort((a,b)=>Date.parse(b.kickoffUtc)-Date.parse(a.kickoffUtc)||a.fixtureId-b.fixtureId);
 const summarize=(n:number)=>{const r=rows.slice(0,n);return{requested:n,count:r.length,w:r.filter(x=>x.result==='W').length,d:r.filter(x=>x.result==='D').length,l:r.filter(x=>x.result==='L').length,gf:r.reduce((s,x)=>s+x.gf,0),ga:r.reduce((s,x)=>s+x.ga,0),rows:r};};
 return{last5:summarize(5),last10:summarize(10),all:summarize(rows.length)};
}
type Form=ReturnType<typeof recentForm>;
const formText=(f:Form['last5'])=>`${f.count}경기 ${f.w}승 ${f.d}무 ${f.l}패, ${f.gf}득점 ${f.ga}실점`;
const finite=(n:any)=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
export function selectKeyPlayers(context:any,registry:any[],teamId:number,leagueId:number,season:number,cutoff:string){
 if(!context)return[];
 assert(context.teamId===teamId&&context.leagueId===leagueId&&context.season===season,'PLAYER_CONTEXT_IDENTITY');
 assert(context.playerReceipts.length>0&&context.playerReceipts.every((r:any)=>Date.parse(r.providerFetchedAt)<=Date.parse(cutoff)),'PLAYER_FUTURE_EVIDENCE');
 const ids=new Set<number>();const candidates=[];
 for(const p of context.players){
  const id=p.player?.id;assert(Number.isSafeInteger(id)&&!ids.has(id),'PLAYER_ID_CONFLICT');ids.add(id);
  const membership=registry.filter(r=>r.provider==='api-football'&&r.providerPlayerId===String(id)&&r.teamProviderId===String(teamId)&&r.competitionProviderId===String(leagueId)&&r.season===String(season)&&r.verificationStatus==='EXACT'&&Date.parse(r.recordedAt)<=Date.parse(cutoff)&&Date.parse(r.validFrom)<=Date.parse(cutoff)&&(!r.validTo||Date.parse(r.validTo)>Date.parse(cutoff)));
  if(membership.length!==1)continue;
  const stats=p.statistics.filter((s:any)=>s.team?.id===teamId&&s.league?.id===leagueId&&s.league?.season===season);assert(stats.length<=1,'PLAYER_STAT_IDENTITY_CONFLICT');if(!stats.length)continue;
  const s=stats[0];if(!finite(s.games?.minutes)||s.games.minutes===0)continue;
  const goals=finite(s.goals?.total)?s.goals.total:null,assists=finite(s.goals?.assists)?s.goals.assists:null;
  candidates.push({providerPlayerId:id,name:membership[0].displayNameRaw,teamId,status:'LIKELY_RELEVANT' as 'LIKELY_RELEVANT'|'CONFIRMED_STARTER'|'UNAVAILABLE'|'UNKNOWN',minutes:s.games.minutes,starts:finite(s.games.lineups)?s.games.lineups:null,goals,assists,position:typeof s.games.position==='string'?s.games.position:null,shots:finite(s.shots?.total)?s.shots.total:null,reason:`현재 시즌 출전 ${s.games.minutes}분${finite(s.games.lineups)?`, 선발 ${s.games.lineups}회`:''}${goals!==null?`, ${goals}골`:''}${assists!==null?`, ${assists}도움`:''}`,sourceHashes:context.playerReceipts.map((r:any)=>r.sha256),membershipHash:membership[0].sourceSha256});
 }
 return candidates.sort((a,b)=>b.minutes-a.minutes||((b.goals??0)+(b.assists??0))-((a.goals??0)+(a.assists??0))||a.providerPlayerId-b.providerPlayerId).slice(0,3);
}
export const REQUIRED_RICHNESS=['recentForm','homeAway','season','canonical','odds','keyPlayers','lineup','availability','flow','summary'] as const;
export function richnessStatus(layers:Record<string,boolean>){return REQUIRED_RICHNESS.every(key=>layers[key]===true)?'COMPLETE':'LIMITED';}
export function buildRichPreview(p:any,c:SealCandidate,context:any,registry:any[],createdAt:string){
 assert(c.classification==='CANONICAL'&&c.eligible&&c.snapshot&&c.input,'CANONICAL_REQUIRED');assert(c.predictionId===p.canonicalPredictionId&&c.fixtureId===p.providerFixtureId,'CANONICAL_ID_MISMATCH');
 const s=c.snapshot.payload;assert(Date.parse(createdAt)<Date.parse(s.kickoffUtc),'PREGAME_REQUIRED');assert(s.homeTeam.id===p.providerHomeTeamId&&s.awayTeam.id===p.providerAwayTeamId,'TEAM_DIRECTION');
 for(const key of ['pHome','pDraw','pAway','predictedClass'])assert(s[key]===p.OFFICIAL_V1[key],'CANONICAL_VALUES');
 assert([s.pHome,s.pDraw,s.pAway].every(finite)&&Math.abs(s.pHome+s.pDraw+s.pAway-1)<1e-8,'PROBABILITY_MASS');
 const home=s.homeTeam.name,away=s.awayTeam.name;
 const teams=[s.homeTeam,s.awayTeam].map((t:any,i:number)=>{
  const match=context?.teams?.find((x:any)=>x.teamId===t.id&&x.fixtureId===s.fixtureId);
  const form=recentForm(c.input.payload.completedHistory,t.id,s.fixtureId,s.leagueId,s.cutoffAt),split=recentForm(c.input.payload.completedHistory,t.id,s.fixtureId,s.leagueId,s.cutoffAt,i===0?'HOME':'AWAY');
  let seasonContext=null;
  if(match?.standing){assert(match.leagueId===s.leagueId&&match.season===s.season&&match.standing.team.id===t.id,'SEASON_IDENTITY');assert(Date.parse(match.standingReceipt.providerFetchedAt)<=Date.parse(createdAt),'FUTURE_SEASON_STATS');const st=match.standing;assert([st.rank,st.all.played,st.all.win,st.all.draw,st.all.lose,st.all.goals.for,st.all.goals.against].every(finite),'INVALID_SEASON_STATS');seasonContext={rank:st.rank,played:st.all.played,w:st.all.win,d:st.all.draw,l:st.all.lose,gf:st.all.goals.for,ga:st.all.goals.against,home:st.home,away:st.away,providerFetchedAt:match.standingReceipt.providerFetchedAt,sourceHash:match.standingReceipt.sha256};}
  return{id:t.id,name:t.name,form,split,seasonContext,keyPlayers:selectKeyPlayers(match,registry,t.id,s.leagueId,s.season,createdAt)};
 });
 const [h,a]=teams,pct=(n:number)=>(n*100).toFixed(2),favorite=s.predictedClass==='HOME'?home:s.predictedClass==='AWAY'?away:'무승부';
 const headline=`${home} vs ${away} — ${favorite}에 무게를 둔 V1, 최근 흐름을 함께 읽다`;
 const outlook=`YANG EDGE V1은 ${favorite}를 최빈 결과로 본다. 홈 ${pct(s.pHome)}% · 무승부 ${pct(s.pDraw)}% · 원정 ${pct(s.pAway)}%.`;
 const recent=`${home}는 관측된 최근 ${formText(h.form.last5)}, ${away}는 ${formText(a.form.last5)}를 기록했다. 최근 10경기로 넓히면 각각 ${formText(h.form.last10)}, ${formText(a.form.last10)}다.`;
 const side=(t:typeof h,venue:string)=>{const st=t.seasonContext;return`${t.name}의 최근 ${venue} ${formText(t.split.last10)}. ${st?`현재 시즌 ${st.played}경기 ${st.w}승 ${st.d}무 ${st.l}패로 ${st.rank}위이며 ${st.gf}득점 ${st.ga}실점이다.`:''}`;};
 const flow=`득실점으로 살펴볼 관전 포인트는 ${home}의 홈 공격과 ${away}의 원정 수비가 만나는 구간이다. 최근 홈 ${h.split.last10.count}경기에서 ${home}는 ${h.split.last10.gf}골을 넣었고, ${away}는 최근 원정 ${a.split.last10.count}경기에서 ${a.split.last10.ga}골을 내줬다. 반대 방향에서는 ${away}의 원정 ${a.split.last10.gf}득점과 ${home}의 홈 ${h.split.last10.ga}실점을 함께 봐야 한다. 이 기록과 V1의 ${favorite} 최빈 판단을 바탕으로, 득점 기회를 어느 쪽이 먼저 살리는지가 관전 포인트다.`;
 const players=teams.flatMap(t=>t.keyPlayers.map((k:any)=>`${t.name} · ${k.name}: ${k.reason}.`));
 const row=p.oddsEvidence.rows.find((r:any)=>r.market==='');const odds=row?{left:row.odds.left,middle:row.odds.middle,right:row.odds.right,mapping:'PENDING',sourceHash:p.oddsEvidence.sourceSha256}:null;
 const dataQuality=[`V1: SEALED · ${s.predictionCreatedAt} · 재계산 없음`,`Recent form: 같은 리그의 봉인 입력, ${s.cutoffAt} 이전 실제 관측 FT · 최신순 · 타 대회 제외`,`Season/player context: ${context?.createdAt??'미확보'} 시점 별도 Preview 관측 · V1 입력 아님`,'Starting XI: awaiting verified evidence','Injuries / suspensions: UNKNOWN','Team style: 득실점 패턴만 사용; 점유율·압박·포메이션 근거 미연결','Odds mapping: pending; 좌/중/우를 승/무/패로 확정하지 않음','Key players: 출전시간 우선·동률 공격 기여도·ID 순; 선발 예측 아님','Public rights: 미확정 · 로컬 OWNER 전용'];
 const quality=richnessStatus({recentForm:teams.every(t=>t.form.last5.count===5),homeAway:teams.every(t=>t.split.last5.count===5),season:teams.every(t=>!!t.seasonContext),canonical:true,odds:!!odds&&odds.mapping!=='PENDING',keyPlayers:teams.every(t=>t.keyPlayers.length>0),lineup:false,availability:false,flow:true,summary:true});
 const final=`${favorite}가 V1의 첫 선택이다. ${Math.max(s.pHome,s.pDraw,s.pAway)<.5?'최고 확률도 과반에 미치지 않아 무승부와 반대편 승리를 함께 고려할 경기다.':'홈·원정 득실점과 최근 경기 흐름을 함께 읽되, 확률을 확정 결과로 받아들이지는 않는다.'} 선발 확인 후에는 출전 구성에 대한 설명을 별도 버전으로 덧붙인다.`;
 const sections=[['YANG EDGE VIEW',`공식 V1: 홈 ${pct(s.pHome)}% / 무승부 ${pct(s.pDraw)}% / 원정 ${pct(s.pAway)}%. ${s.predictionCreatedAt}에 봉인된 판단이다.`],['RECENT FORM',recent],['HOME TEAM',side(h,'홈')],['AWAY TEAM',side(a,'원정')],['EXPECTED MATCH FLOW',flow],['KEY PLAYERS',players.length?players.join(' '):'선수별 출전 근거는 아래 Data Quality에서 확인할 수 있다.'],['KEY VARIABLES',`최근 5경기와 10경기의 흐름 차이, 홈·원정 득실점, 출전시간이 높은 선수들의 실제 선발 포함 여부를 함께 살펴볼 경기다.`],['LINEUP / ABSENCES','선발·가용 상태는 아래 Data Quality에 모았다. 검증된 XI 관측 후 새 버전에서 출전 구성을 설명한다.'],['ODDS VS MODEL',odds?`관측 배당 좌 / 중 / 우: ${odds.left} / ${odds.middle} / ${odds.right}.`:'시장 관측 상태는 Data Quality에 표시한다.'],['FINAL VIEW',final]];
 return{schemaVersion:'RICH_MATCH_PREVIEW_V2',version:2,status:'PREVIEW_PRE_LINEUP',quality,createdAt,cutoffAt:createdAt,historyCutoffAt:s.cutoffAt,targetId:p.TARGET_ID,fixtureId:s.fixtureId,leagueId:s.leagueId,season:s.season,kickoffKst:p.kickoffKst,competition:p.competition,canonicalPredictionId:c.predictionId!,canonicalInputHash:s.inputSnapshotHash,officialV1:{status:s.status,pHome:s.pHome,pDraw:s.pDraw,pAway:s.pAway,predictedClass:s.predictedClass,createdAt:s.predictionCreatedAt},headline,outlook,teams,recentFormSummary:recent,expectedFlow:flow,finalView:final,odds,lineupStatus:'NOT_CONFIRMED',availabilityStatus:'UNKNOWN',teamStyle:{status:'LIMITED',mechanism:'DESCRIPTIVE_GOALS_ONLY',sourceHash:s.inputSnapshotHash},sections:sections.map(([title,text])=>({title,text})),dataQuality,modelRecomputed:false,engineInputAllowed:false,publicDisplayAllowed:false};
}
export type RichPreview=ReturnType<typeof buildRichPreview>&{recency?:any;confirmedKeyPlayerIds?:number[];seasonSplit?:{currentSeason:number;previousSeason:number;teams:any[];sourceReportHash:string};previousHash?:string;revisionReason?:string};
export function richMarkdown(p:RichPreview){return`# ${p.headline}\n\n${p.competition} · ${p.kickoffKst} · v${p.version} · ${p.quality}\n\n${p.outlook}\n\n${p.sections.map(s=>`## ${s.title}\n\n${s.text}`).join('\n\n')}\n\n<details>\n<summary>DATA QUALITY</summary>\n\n${p.dataQuality.map(s=>'- '+s).join('\n')}\n\n</details>\n`;}
