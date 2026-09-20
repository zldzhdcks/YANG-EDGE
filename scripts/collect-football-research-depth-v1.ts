/** Attended Preview-only refresh; independent of all V4 collectors and budgets. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {loadResearchExplorer} from '../src/lib/public-analysis/load-research-explorer';
import {digest} from '../src/lib/football/official-canonical-v1';

async function main(){
 process.env.YANG_EDGE_OWNER_PREVIEW='1';
 const data=loadResearchExplorer('round-111-odds-new-v1','2026-09-20');
 const p=data.details.find(d=>d.line.targetId==='BETMAN-20260920-86')?.preview;
 assert(p,'EXACT_CANONICAL_PREVIEW_REQUIRED');
 const root=resolve('../YANG-EDGE-INBOX/football-research-depth-v1/2026-09-20');
 mkdirSync(root,{recursive:true});assert(!existsSync(join(root,'context.json')),'IMMUTABLE_CONTEXT_EXISTS');
 const key=process.env.FOOTBALL_API_KEY??process.env.API_FOOTBALL_KEY;assert(key,'KEY_REQUIRED');
 const receipts:any[]=[],history:any[]=[];let calls=0;
 try{
  for(const team of p.teams){
   if(calls)await new Promise(r=>setTimeout(r,6600));
   assert(calls<2,'SEPARATE_PREVIEW_BUDGET');assert(Date.now()<Date.parse(p.kickoffKst)-60000,'PREGAME_REQUIRED');
   const params={league:String(p.leagueId),season:String(p.season),team:String(team.id),status:'FT',from:'2026-01-01',to:'2026-09-20'};
   const url=new URL('https://v3.football.api-sports.io/fixtures');url.search=new URLSearchParams(params).toString();
   calls++;
   const response=await fetch(url,{headers:{'x-apisports-key':key},redirect:'error',signal:AbortSignal.timeout(20000)});
   assert(response.ok,'HTTP_'+response.status);const bytes=await response.text(),providerFetchedAt=new Date().toISOString();
   assert(Date.parse(providerFetchedAt)<Date.parse(p.kickoffKst)-60000,'LATE_RESPONSE');
   const raw=JSON.parse(bytes);assert(Object.keys(raw.errors??{}).length===0,'PROVIDER_ERROR');assert(Array.isArray(raw.response));assert((raw.paging?.total??1)===1,'INCOMPLETE_PAGE');
   // All identity/status checks precede every score read. The target endpoint is never requested.
   for(const r of raw.response){assert(r.fixture.id!==p.fixtureId,'TARGET_REJECTED');assert(r.fixture.status.short==='FT','FT_ONLY');assert(Date.parse(r.fixture.date)<Date.parse(providerFetchedAt),'FUTURE_ROW');assert(r.league.id===p.leagueId&&r.league.season===p.season,'SCOPE');assert(r.teams.home.id===team.id||r.teams.away.id===team.id,'TEAM');}
   const sha256=digest(bytes);writeFileSync(join(root,sha256+'.json'),bytes,{flag:'wx'});
   receipts.push({endpoint:'/fixtures',params,providerFetchedAt,sha256,rows:raw.response.length});
   for(const r of raw.response)history.push({providerFixtureId:r.fixture.id,kickoffUtc:r.fixture.date,leagueId:r.league.id,season:r.league.season,homeTeamId:r.teams.home.id,awayTeamId:r.teams.away.id,fixtureStatus:'FT',fullTimeHomeGoals:r.score.fulltime.home,fullTimeAwayGoals:r.score.fulltime.away,providerFetchedAt,sourceHash:sha256});
  }
  writeFileSync(join(root,'context.json'),JSON.stringify({createdAt:new Date().toISOString(),role:'PREVIEW_ONLY',modelInputAllowed:false,publicDisplayAllowed:false,receipts,history},null,2)+'\n',{flag:'wx'});
 }finally{writeFileSync(join(root,'collection-audit.json'),JSON.stringify({providerCalls:calls,reservedV4BudgetUsed:0,requestCap:2,retries:0,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'});}
 console.log(JSON.stringify({providerCalls:calls,teamCounts:receipts.map(r=>({team:r.params.team,count:r.rows})),rawLocalOnly:true}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
