/** Explicit FT-only, prior-date collection after owner authorization. No target results. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {projectCompleted} from './run-football-forward-shadow-v1';
import {envelope,readEnvelope,sha,canonical} from '../src/lib/research/terminal-decision/evidence';
import {loadCommittedProductionScope} from '../src/lib/research/terminal-decision/production-authority';
import type {Completed} from './football-forward-shadow-v1';
async function main(){
 const evidencePath=process.argv[2];assert(evidencePath,'EXPLICIT_IDENTITY_AUDIT_REQUIRED');
 const repo=process.cwd(),batchId='round-111-odds-new-v1',root=join(repo,'data/research/slate-batches',batchId),date='2026-09-20';
 const scope=loadCommittedProductionScope(root,date),identity=readEnvelope(resolve(evidencePath)).payload;
 assert(identity.rows.length===2&&identity.rows.every((r:any)=>r.status==='EXACT_MATCH'&&r.scopeSha256===scope.hash));
 const key=process.env.FOOTBALL_API_KEY??process.env.API_FOOTBALL_KEY;assert(key,'API_KEY_REQUIRED');
 const started=new Date().toISOString(),dir=join(repo,'data/cache/research/round-111-v1-inputs',started.replaceAll(':','-'));mkdirSync(dir,{recursive:true});
 const plan:{scopeSha256:string;targets:Record<string,unknown>}={scopeSha256:scope.hash,targets:{}};let calls=0,last=0;
 for(const row of identity.rows){
  const t=scope.doc.targets.find(t=>t.targetId===row.targetId);assert(t);assert(Date.now()+60000<Date.parse(t.scheduledStartTimeKst!));
  const observations:Completed[]=[];const receipts=[];
  for(const season of [2025,2026]){
   const delay=Math.max(0,6500-(Date.now()-last));if(delay)await new Promise(r=>setTimeout(r,delay));last=Date.now();
   const url=new URL('https://v3.football.api-sports.io/fixtures');url.search=new URLSearchParams({league:String(row.identity.leagueId),season:String(season),from:new Date(Date.parse(started)-365*86400000).toISOString().slice(0,10),to:'2026-09-19',status:'FT',timezone:'UTC'}).toString();
   calls++;const r:Response=await fetch(url,{headers:{'x-apisports-key':key},redirect:'error',signal:AbortSignal.timeout(30000)});assert(r.ok,'HISTORY_HTTP_FAILED');const raw:{errors?:Record<string,unknown>;paging:{total:number};results:number;response:Array<Parameters<typeof projectCompleted>[0]&{league:{id:number;season:number;round:string}}>}=await r.json();const observedAt=new Date().toISOString();assert.equal(Object.keys(raw.errors??{}).length,0,'HISTORY_ACCESS_FAILED');assert.equal(raw.paging.total,1);assert.equal(raw.results,raw.response.length);
   const sourceHash=sha(JSON.stringify(raw));
   for(const f of raw.response){assert(!identity.rows.some((x:any)=>x.providerFixtureId===f.fixture.id),'TARGET_IN_HISTORY');assert(Date.parse(f.fixture.date)<Date.parse('2026-09-20T00:00:00Z'));if(!/^Regular Season - \d+$/.test(f.league.round))continue;observations.push(projectCompleted(f,row.identity.leagueId,season,observedAt,sourceHash));}
   writeFileSync(join(dir,`${row.identity.leagueId}-${season}-raw.json`),JSON.stringify(raw)+'\n',{flag:'wx'});receipts.push({season,sourceHash,observedAt,rows:raw.response.length});
  }
  assert.equal(new Set(observations.map(o=>o.providerFixtureId)).size,observations.length);
  const history=envelope({schemaVersion:'football-forward-observed-history-v1',sealedAt:new Date().toISOString(),observations});const historyPath=join(dir,`${row.identity.leagueId}-history.json`);writeFileSync(historyPath,JSON.stringify(history,null,2)+'\n',{flag:'wx'});
  const binding={targetId:t.targetId,scopeSha256:scope.hash,homeRaw:t.homeTeamRaw,awayRaw:t.awayTeamRaw,competitionRaw:t.competitionNameRaw,providerFixtureId:row.providerFixtureId,homeProviderId:row.identity.homeTeamId,awayProviderId:row.identity.awayTeamId,leagueId:row.identity.leagueId,season:row.identity.season,scheduledStart:t.scheduledStartTimeKst,reviewStatus:'VERIFIED',reviewedAt:new Date().toISOString(),evidenceSha256:sha(JSON.stringify(row.identity))};
  const b={batchId,scopeId:`${batchId}/data/audits/${date}-research-target-scope-lock-v1.json`,scopeSha256:scope.hash};
  const inputProof={...b,inputSnapshotId:`${scope.hash}:${t.targetId}`,targetId:t.targetId,inputSha256:sha(canonical({fixtureHash:row.evidenceHash,historyHash:history.sha256,targetId:t.targetId,...b})),observedAt:history.payload.sealedAt,collectedAt:history.payload.sealedAt,asOf:history.payload.sealedAt,predictionCutoff:new Date(Date.parse(t.scheduledStartTimeKst!)-60000).toISOString(),scheduledStart:t.scheduledStartTimeKst};
  plan.targets[t.targetId]={soccer:{fixtureEvidencePath:row.evidencePath,fixtureEvidenceHash:row.evidenceHash,binding,historyPath,historyHash:history.sha256},inputProof};
  writeFileSync(join(dir,`${row.identity.leagueId}-receipts.json`),JSON.stringify({receipts,historyHash:history.sha256,completedMatches:observations.length})+'\n',{flag:'wx'});
 }
 const planPath=join(dir,'production-plan.json');writeFileSync(planPath,JSON.stringify(plan,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({planPath,providerCalls:calls,targets:Object.keys(plan.targets),targetResultsAccessed:false,historicalCompletedFTUsed:true}));
}
main().catch(()=>{console.error('FT_HISTORY_INPUT_COLLECTION_BLOCKED');process.exitCode=1;});
