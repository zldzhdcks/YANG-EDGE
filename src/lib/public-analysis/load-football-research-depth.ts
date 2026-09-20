import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {digest} from '../football/official-canonical-v1';
import {buildTeamResearch,depthGate,teamResearchSummary} from './football-research-depth';
import type {ResearchDetail} from './load-research-explorer';

/** Private, outcome-isolated display enrichment. Never consumed by an engine. */
export function applyFootballDepth(details:ResearchDetail[],cwd:string,scopeHash:string){
 let sources:any=null;
 let identityStates:any[]=[];let missedObservations:any[]=[];
 try{sources=JSON.parse(readFileSync(join(cwd,'data/research/football/research-depth-v1-sources.json'),'utf8'));}catch{}
 try{const extra=JSON.parse(readFileSync(join(cwd,'data/research/football/research-depth-v1-identity-batch-sources.json'),'utf8'));if(sources)sources.entries=[...sources.entries,...extra.entries];identityStates=extra.identityStates??[];missedObservations=extra.skipped??[];}catch{}
 const inbox=resolve(cwd,'../YANG-EDGE-INBOX');
 for(const d of details){
  if(d.line.sport!=='SOCCER')continue;
  let research:ReturnType<typeof buildTeamResearch>|null=null;
  let tables:any[]=[],recencyCheck='NO_VERIFIED_CURRENT_SEASON_SOURCE';
  const extra:string[]=[];
  const source=sources?.entries.find((x:any)=>x.targetId===d.line.targetId);
  try{if(source){
   const identityBytes=readFileSync(join(cwd,source.identityFile));assert.equal(digest(identityBytes),source.identityHash,'IDENTITY_HASH');
   const id=JSON.parse(identityBytes.toString());
   assert(id.verificationStatus==='EXACT'&&id.fuzzyMatching===false&&id.scopeIdentity===scopeHash,'EXACT_IDENTITY_REQUIRED');
   assert(id.targetId===d.line.targetId&&id.homeTeamRaw===d.line.home&&id.awayTeamRaw===d.line.away&&Date.parse(id.scheduledStart)===Date.parse(d.line.kickoff),'TARGET_IDENTITY');
   const p={fixtureId:Number(id.providerFixtureId),leagueId:Number(id.competitionProviderId),season:Number(id.season),kickoffKst:id.scheduledStart,teams:[{id:Number(id.homeTeamId),name:d.preview?.teams[0].name??d.line.home},{id:Number(id.awayTeamId),name:d.preview?.teams[1].name??d.line.away}]};
   const bytes=readFileSync(join(inbox,source.context));assert.equal(digest(bytes),source.sha256,'CONTEXT_HASH');
   const ctx=JSON.parse(bytes.toString()),history:any[]=[];
   for(const r of ctx.receipts){
    assert(r.endpoint==='/fixtures'&&r.params.status==='FT','FT_QUERY_ONLY');
    assert(Number(r.params.league)===p.leagueId&&Number(r.params.season)===p.season,'QUERY_SCOPE');
    assert(r.params.team===undefined||p.teams.some(t=>t.id===Number(r.params.team)),'QUERY_TEAM');
    assert(Date.parse(r.providerFetchedAt)<Date.parse(p.kickoffKst),'LATE_OBSERVATION');
    const rawBytes=readFileSync(join(inbox,source.directory,r.sha256+'.json'));assert.equal(digest(rawBytes),r.sha256,'RAW_HASH');
    const raw=JSON.parse(rawBytes.toString());assert((raw.paging?.total??1)===1&&Object.keys(raw.errors??{}).length===0,'INCOMPLETE_RESPONSE');
    for(const row of raw.response){assert(row.fixture.id!==p.fixtureId,'TARGET_EXCLUDED');assert(row.fixture.status.short==='FT','COMPLETED_ONLY');assert(row.league.id===p.leagueId&&row.league.season===p.season,'ROW_SCOPE');if(r.params.team!==undefined)assert(row.teams.home.id===Number(r.params.team)||row.teams.away.id===Number(r.params.team),'ROW_TEAM');assert(Date.parse(row.fixture.date)<Date.parse(r.providerFetchedAt),'FUTURE_ROW');}
    for(const row of raw.response.filter((row:any)=>p.teams.some(t=>row.teams.home.id===t.id||row.teams.away.id===t.id)))history.push({providerFixtureId:row.fixture.id,leagueId:row.league.id,season:row.league.season,kickoffUtc:row.fixture.date,homeTeamId:row.teams.home.id,awayTeamId:row.teams.away.id,fixtureStatus:'FT',fullTimeHomeGoals:row.score.fulltime.home,fullTimeAwayGoals:row.score.fulltime.away,providerFetchedAt:r.providerFetchedAt,sourceHash:r.sha256});
   }
   assert(p.teams.every(t=>ctx.receipts.some((r:any)=>r.params.team===undefined||Number(r.params.team)===t.id)),'BOTH_TEAMS_REQUIRED');
   research=buildTeamResearch({fixtureId:p.fixtureId,leagueId:p.leagueId,season:p.season,kickoff:p.kickoffKst,teams:p.teams},history);
   recencyCheck='COMPLETE_RETURNED_FT_QUERY_AT_OBSERVATION; LATER_UPDATES_NOT_MONITORED';
   const prior=d.preview?.recency?.teams??d.preview?.seasonSplit?.teams;
   d.line.recencyAdded=research.teams.map(t=>({teamId:t.teamId,added:t.current.all.all.rows.filter(r=>!prior?.find((a:any)=>a.teamId===t.teamId)?.current.all.all.rows.some((a:any)=>a.fixtureId===r.fixtureId)).length}));
  }}catch{extra.push('TEMPORAL_OR_SOURCE_INTEGRITY_REJECTED');}
  // Preserve previously verified showcase context if optional refresh is unavailable.
  if(!research&&d.preview){const p=d.preview,teams=p.recency?.teams??p.seasonSplit?.teams;
   if(teams)research={teams,season:p.season,asOf:p.recency?.previewAsOf??p.createdAt};
   recencyCheck='SEALED_LOCAL_CONTEXT_ONLY; LATEST_COMPLETENESS_UNCONFIRMED';
  }
  try{if(d.preview&&sources?.standings){
   const s=sources.standings,bytes=readFileSync(join(inbox,s.context));assert.equal(digest(bytes),s.sha256,'TABLE_CONTEXT_HASH');
   const ctx=JSON.parse(bytes.toString()),p=d.preview;
   tables=p.teams.flatMap(t=>{const c=ctx.teams.find((x:any)=>x.teamId===t.id&&x.fixtureId===p.fixtureId);if(!c)return[];const r=c.standingReceipt;assert(Date.parse(r.providerFetchedAt)<Date.parse(p.kickoffKst),'TABLE_CUTOFF');const b=readFileSync(join(inbox,s.directory,r.sha256+'.json'));assert.equal(digest(b),r.sha256,'TABLE_RAW_HASH');const raw=JSON.parse(b.toString());const rows=raw.response.filter((x:any)=>x.league.id===p.leagueId&&x.league.season===p.season).flatMap((x:any)=>x.league.standings.flat()).filter((x:any)=>x.team.id===t.id);assert(rows.length<=1,'TABLE_IDENTITY');return rows.map((x:any)=>({teamId:t.id,name:t.name,position:x.rank,played:x.all.played,points:x.points,asOf:r.providerFetchedAt}));});
  }}catch{tables=[];extra.push('TABLE_SOURCE_UNAVAILABLE');}
  const identityState=identityStates.find(s=>s.targetId===d.line.targetId);
  const gate=depthGate(research?.teams??null,!!research||identityState?.status==='EXACT');
  if(identityState&&identityState.status!=='EXACT')extra.push(identityState.reason);
  if(missedObservations.some(s=>s.targetId===d.line.targetId))extra.push('PREGAME_OBSERVATION_WINDOW_CLOSED');
  d.depth={teams:research?.teams??null,season:research?.season??null,tables,summary:research&&gate.tier==='STANDARD'?teamResearchSummary(research.teams,!!d.line.probability):[],gaps:[...gate.gaps,...extra],recencyCheck};
  d.line.tier=gate.tier;
  d.line.summary=d.depth.summary.join(' ');
  d.line.currentForm=research?.teams.map(t=>`${t.name}: ${t.current.all.all.count}경기 ${t.current.all.all.w}W/${t.current.all.all.d}D/${t.current.all.all.l}L`)??[];
  d.line.recentForm=research?.teams.map(t=>`${t.name}: ${t.current.all.last5.rows.map(r=>r.result).join('-')}`)??[];
  if(research){
   d.line.previewAsOf=research.asOf;
   const available=['CURRENT_SEASON','RECENT_FORM','HOME_AWAY','MATCH_FLOW'];
   d.line.dataAvailable=[...new Set([...d.line.dataAvailable,...available])];
   d.line.dataMissing=d.line.dataMissing.filter(k=>!available.includes(k));
   d.line.quality=d.line.quality.filter(k=>!available.some(a=>k===a+' 미확보'));
  }
  d.line.quality.push(...d.depth.gaps,recencyCheck,...(tables.length?['TABLE_AS_OF_SEPARATE_FROM_TEAM_HISTORY']:['TABLE_CONTEXT_UNKNOWN']));
  if(tables.length)d.line.dataAvailable.push('TABLE_CONTEXT');
 }
}
