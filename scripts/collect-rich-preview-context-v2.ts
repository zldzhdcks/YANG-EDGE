/** Preview-only current-season aggregates. Never calls target fixtures/results/live. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {digest,canonicalForFixture} from '../src/lib/football/official-canonical-v1';
async function main(){
 const repo=process.cwd(),batch=join(repo,'data/research/slate-batches/round-111-odds-new-v1');
 const targets=JSON.parse(readFileSync(join(batch,'canonicalization-v1/mandatory-previews-v5.json'),'utf8'));
 const dir=resolve(repo,'../YANG-EDGE-INBOX/rich-preview-v2/2026-09-20');mkdirSync(dir,{recursive:true});
 const output=join(dir,'context.json');assert(!existsSync(output),'IMMUTABLE_CONTEXT_EXISTS');
 const key=process.env.FOOTBALL_API_KEY??process.env.API_FOOTBALL_KEY;assert(key,'API_KEY_REQUIRED');
 let calls=0;const receipts:any[]=[];
 async function request(endpoint:string,params:Record<string,string>,cutoff:number){
  assert(['/players','/standings'].includes(endpoint));assert(calls<18,'PREVIEW_REQUEST_BUDGET');
  if(calls)await new Promise(r=>setTimeout(r,6600));assert(Date.now()<cutoff,'PREGAME_REQUIRED');
  const url=new URL('https://v3.football.api-sports.io'+endpoint);for(const [k,v]of Object.entries(params))url.searchParams.set(k,v);
  calls++;const response=await fetch(url,{headers:{'x-apisports-key':key!},redirect:'error',signal:AbortSignal.timeout(20000)});
  assert(response.ok,'PROVIDER_HTTP_'+response.status);const bytes=await response.text(),fetchedAt=new Date().toISOString();assert(Date.parse(fetchedAt)<cutoff,'RESPONSE_AFTER_CUTOFF');
  const raw=JSON.parse(bytes);assert(!raw.errors||Object.keys(raw.errors).length===0,'PROVIDER_ERRORS');assert(Array.isArray(raw.response));
  const sha256=digest(bytes);const rawPath=join(dir,sha256+'.json');if(!existsSync(rawPath))writeFileSync(rawPath,bytes,{flag:'wx'});
  const receipt={endpoint,params,providerFetchedAt:fetchedAt,sha256};receipts.push(receipt);return{raw,receipt};
 }
 const teams:any[]=[];
 for(const p of targets){const c=canonicalForFixture(join(repo,'data/cache/research/football/forward-shadow-v1'),p.providerFixtureId);assert(c?.identity);const cutoff=Date.parse(p.kickoffKst)-60000;
  const league=String(c.identity.leagueId),season=String(c.identity.season);
  const standings=await request('/standings',{league,season},cutoff);
  for(const teamId of [p.providerHomeTeamId,p.providerAwayTeamId]){
   const players:any[]=[];const playerReceipts:any[]=[];let total=1;
   for(let page=1;page<=total;page++){const result=await request('/players',{team:String(teamId),league,season,page:String(page)},cutoff);assert(result.raw.paging?.current===page);total=result.raw.paging.total;assert(Number.isInteger(total)&&total>=1&&total<=4,'PAGINATION_LIMIT');players.push(...result.raw.response);playerReceipts.push(result.receipt);}
   const leagueRows=standings.raw.response.filter((x:any)=>x.league?.id===Number(league)&&x.league?.season===Number(season));
   const matches=leagueRows.flatMap((x:any)=>x.league.standings.flat()).filter((x:any)=>x.team?.id===teamId);assert(matches.length<=1,'STANDINGS_AMBIGUOUS');
   teams.push({teamId,leagueId:Number(league),season:Number(season),fixtureId:p.providerFixtureId,standing:matches[0]??null,standingReceipt:standings.receipt,players,playerReceipts});
  }
 }
 writeFileSync(output,JSON.stringify({createdAt:new Date().toISOString(),role:'PREVIEW_ONLY',modelInputAllowed:false,publicDisplayAllowed:false,providerCalls:calls,receipts,teams},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({providerCalls:calls,teams:teams.map(t=>({teamId:t.teamId,players:t.players.length,standing:!!t.standing})),rawLocalOnly:true}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
