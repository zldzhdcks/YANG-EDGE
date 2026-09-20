import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {digest} from '../src/lib/football/official-canonical-v1';
async function main(){
 const audit=JSON.parse(readFileSync('data/audits/2026-09-20-football-provider-identity-resolution-v1.json','utf8'));
 const root=resolve('../YANG-EDGE-INBOX/football-provider-identity-v1/2026-09-20/research');mkdirSync(root,{recursive:true});
 assert(!existsSync(join(root,'collection-audit.json')),'IMMUTABLE_COLLECTION_EXISTS');
 const exact=audit.rows.filter((r:any)=>r.identityStatus==='EXACT'&&!r.regressionOnly);
 const eligible=exact.filter((r:any)=>Date.now()+60000<Date.parse(r.kickoff));
 const groups=new Map<number,any[]>();for(const r of eligible)groups.set(r.providerCompetitionId,[...(groups.get(r.providerCompetitionId)??[]),r]);
 const key=process.env.FOOTBALL_API_KEY??process.env.API_FOOTBALL_KEY;assert(key,'KEY_REQUIRED');
 const entries:any[]=[],receipts:any[]=[],skipped=exact.filter((r:any)=>!eligible.includes(r)).map((r:any)=>({targetId:r.targetId,reason:'PREGAME_OBSERVATION_WINDOW_CLOSED'}));let calls=0;
 try{for(const [league,targets]of groups){
  const cutoff=Math.min(...targets.map(r=>Date.parse(r.kickoff))),season=targets[0].identity.season;
  // K League 2 has earlier targets today. Restrict to these still-upcoming teams.
  const queries=league===293?targets.flatMap(r=>[r.providerHomeTeamId,r.providerAwayTeamId]):[undefined];
  const directory=join(root,String(league));mkdirSync(directory,{recursive:true});const localReceipts:any[]=[];
  for(const team of [...new Set(queries)]){
   if(calls)await new Promise(r=>setTimeout(r,6600));assert(calls<9,'RESEARCH_ONLY_BUDGET');assert(Date.now()<cutoff-60000,'PREGAME_REQUIRED');
   const params:any={league:String(league),season:String(season),status:'FT',from:'2026-01-01',to:'2026-09-20'};if(team!==undefined)params.team=String(team);
   const url=new URL('https://v3.football.api-sports.io/fixtures');url.search=new URLSearchParams(params).toString();calls++;
   const response=await fetch(url,{headers:{'x-apisports-key':key},redirect:'error',signal:AbortSignal.timeout(25000)});assert(response.ok,'PROVIDER_HTTP_'+response.status);
   const bytes=await response.text(),providerFetchedAt=new Date().toISOString(),raw=JSON.parse(bytes);assert(Date.parse(providerFetchedAt)<cutoff-60000,'LATE_RESPONSE');assert(Object.keys(raw.errors??{}).length===0&&(raw.paging?.total??1)===1,'PROVIDER_RESPONSE');
   for(const r of raw.response){assert(!audit.rows.some((t:any)=>t.providerFixtureId===r.fixture.id),'SLATE_TARGET_REJECTED_BEFORE_SCORE_ACCESS');assert(r.fixture.status.short==='FT','COMPLETED_ONLY');assert(r.league.id===league&&r.league.season===season,'SCOPE');assert(Date.parse(r.fixture.date)<Date.parse(providerFetchedAt),'FUTURE_ROW');if(team!==undefined)assert(r.teams.home.id===team||r.teams.away.id===team,'TEAM_SCOPE');}
   const sha256=digest(bytes);writeFileSync(join(directory,sha256+'.json'),bytes,{flag:'wx'});const receipt={endpoint:'/fixtures',params,providerFetchedAt,sha256,rows:raw.response.length};receipts.push(receipt);localReceipts.push(receipt);
  }
  const context=JSON.stringify({role:'PREVIEW_ONLY',modelInputAllowed:false,publicDisplayAllowed:false,receipts:localReceipts},null,2)+'\n';writeFileSync(join(directory,'context.json'),context,{flag:'wx'});
  for(const t of targets){
   const rel=`data/research/football/provider-identity-batch-v1/identity-${t.providerFixtureId}.json`;
   const proof=JSON.stringify({targetId:t.targetId,scopeIdentity:audit.scopeHash,providerFixtureId:String(t.providerFixtureId),competitionProviderId:String(league),season:String(season),homeTeamId:String(t.providerHomeTeamId),awayTeamId:String(t.providerAwayTeamId),homeTeamRaw:t.sourceHome,awayTeamRaw:t.sourceAway,scheduledStart:t.kickoff,verificationStatus:'EXACT',fuzzyMatching:false,sourceEvidenceHash:audit.scheduleSha256,observedAt:audit.scheduleObservedAt,verifiedBy:'ASTRA_EXPLICIT_ALIAS_AND_ID_SCHEDULE_CROSSCHECK'},null,2)+'\n';writeFileSync(rel,proof,{flag:'wx'});
   const dir=`football-provider-identity-v1/2026-09-20/research/${league}`;entries.push({targetId:t.targetId,identityFile:rel,identityHash:digest(proof),directory:dir,context:dir+'/context.json',sha256:digest(context)});
  }
 }}finally{writeFileSync(join(root,'collection-audit.json'),JSON.stringify({providerCalls:calls,reservedV4BudgetUsed:0,receipts,skipped,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'});}
 writeFileSync('data/research/football/research-depth-v1-identity-batch-sources.json',JSON.stringify({schemaVersion:'APPEND_ONLY_IDENTITY_RESEARCH_SOURCES_V1',entries,skipped,identityStates:audit.rows.map((r:any)=>({targetId:r.targetId,status:r.identityStatus,reason:r.failureReason})),modelInputAllowed:false,publicDisplayAllowed:false},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({researchProviderCalls:calls,eligible:eligible.length,sourceEntries:entries.length,skipped}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
