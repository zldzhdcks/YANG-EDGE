import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('../YANG-EDGE-INBOX/rich-preview-v2/2026-09-20/recency-v3');
const target=1570394,start=Date.parse('2026-09-20T23:15:00+09:00');
assert(Date.now()<start-60000,'PREGAME_REQUIRED');
mkdirSync(root,{recursive:true});assert(!existsSync(join(root,'context.json')),'IMMUTABLE_CONTEXT_EXISTS');
const key=process.env.FOOTBALL_API_KEY??process.env.API_FOOTBALL_KEY;assert(key,'KEY_REQUIRED');
const receipts=[],history=[];
for(const team of [530,541]){
 if(receipts.length)await new Promise(r=>setTimeout(r,6600));
 assert(Date.now()<start-60000,'PREGAME_REQUIRED');
 const params={league:'140',season:'2026',team:String(team),status:'FT',from:'2026-07-01',to:'2026-09-20'};
 const url=new URL('https://v3.football.api-sports.io/fixtures');for(const [k,v]of Object.entries(params))url.searchParams.set(k,v);
 const response=await fetch(url,{headers:{'x-apisports-key':key},redirect:'error',signal:AbortSignal.timeout(20000)});assert(response.ok,'HTTP_'+response.status);
 const bytes=await response.text(),providerFetchedAt=new Date().toISOString();assert(Date.parse(providerFetchedAt)<start-60000,'LATE_RESPONSE');
 const raw=JSON.parse(bytes);assert(!raw.errors||Object.keys(raw.errors).length===0,'PROVIDER_ERROR');assert(Array.isArray(raw.response));
 // Validate all identities/statuses before reading any scores or persisting the response.
 for(const r of raw.response){assert(r.fixture.id!==target,'TARGET_RESPONSE_REJECTED');assert(r.fixture.status.short==='FT','NOT_FT');assert(Date.parse(r.fixture.date)<Date.parse(providerFetchedAt),'FUTURE_MATCH');assert(r.league.id===140&&r.league.season===2026,'IDENTITY');assert(r.teams.home.id===team||r.teams.away.id===team,'TEAM');}
 const sha256=createHash('sha256').update(bytes).digest('hex');writeFileSync(join(root,sha256+'.json'),bytes,{flag:'wx'});
 receipts.push({endpoint:'/fixtures',params,providerFetchedAt,sha256,rows:raw.response.length});
 for(const r of raw.response)history.push({providerFixtureId:r.fixture.id,kickoffUtc:r.fixture.date,leagueId:140,season:2026,homeTeamId:r.teams.home.id,awayTeamId:r.teams.away.id,homeTeamName:r.teams.home.name,awayTeamName:r.teams.away.name,fixtureStatus:'FT',fullTimeHomeGoals:r.score.fulltime.home,fullTimeAwayGoals:r.score.fulltime.away,providerFetchedAt,sourceHash:sha256});
}
writeFileSync(join(root,'context.json'),JSON.stringify({createdAt:new Date().toISOString(),role:'PREVIEW_ONLY',modelInputAllowed:false,publicDisplayAllowed:false,receipts,history},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({providerCalls:2,counts:receipts.map(r=>({team:r.params.team,count:r.rows})),localOnly:true}));
