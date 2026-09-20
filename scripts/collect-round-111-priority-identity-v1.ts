/** Attended, pregame-only identity acquisition. No result/history/model access. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {loadCommittedProductionScope} from '../src/lib/research/terminal-decision/production-authority';
import {collectFixtureEvidence} from '../src/lib/football/foundation/pregame-fixture-evidence';
import {selectExactFixture} from '../src/lib/betman/daily-slate/exact-pregame-identity';
import {envelope} from '../src/lib/research/terminal-decision/evidence';

async function main(){
 const root=join(process.cwd(),'data/research/slate-batches/round-111-odds-new-v1'),date='2026-09-20';
 const scope=loadCommittedProductionScope(root,date);
 // Exact IDs from the committed team aliases and provider-backed slate team catalog.
 const claims=[{id:'BETMAN-20260920-86',home:'맨체스C',away:'선덜랜드',leagueId:39,homeTeamId:50,awayTeamId:746},
 {id:'BETMAN-20260920-91',home:'AT마드',away:'레알마드',leagueId:140,homeTeamId:530,awayTeamId:541}];
 process.env.FOOTBALL_API_KEY ||= process.env.API_FOOTBALL_KEY;
 assert(process.env.FOOTBALL_API_KEY,'API_KEY_NOT_CONFIGURED');
 const dir=join(process.cwd(),'data/cache/research/round-111-priority-identity',new Date().toISOString().replaceAll(':','-'));
 mkdirSync(dir,{recursive:true});const rows=[];let calls=0;
 for(const c of claims){
  const target=scope.doc.targets.find(t=>t.targetId===c.id);assert(target);assert.equal(target.homeTeamRaw,c.home);assert.equal(target.awayTeamRaw,c.away);
  assert(Date.now()+60000<Date.parse(target.scheduledStartTimeKst!),'PREGAME_WINDOW_CLOSED');
  const file=join(dir,`${c.leagueId}.json`);
  try{
   calls++;const evidence=await collectFixtureEvidence(date,c.leagueId,2026,file,fetch,true);
   const match=selectExactFixture({...c,verified:true,kickoff:target.scheduledStartTimeKst!},evidence.payload.fixtures,new Date().toISOString());
   rows.push({targetId:c.id,batchId:'round-111-odds-new-v1',scopeSha256:scope.hash,scheduledStart:target.scheduledStartTimeKst,status:match.status,providerFixtureId:match.status==='EXACT_MATCH'?match.fixture!.fixtureId:null,evidencePath:file,evidenceHash:evidence.sha256,providerRows:evidence.payload.fixtures.length,collectedAt:evidence.payload.collectedAt,observedAt:evidence.payload.observedAt,identity:match.status==='EXACT_MATCH'?match.fixture:null});
  }catch{rows.push({targetId:c.id,batchId:'round-111-odds-new-v1',scopeSha256:scope.hash,scheduledStart:target.scheduledStartTimeKst,status:'NO_PROVIDER_EVIDENCE',providerFixtureId:null,reason:'COLLECTION_REJECTED_NO_RETRY'});}
  if(c!==claims[claims.length-1])await new Promise(r=>setTimeout(r,6500));
 }
 const audit={schemaVersion:'round-111-priority-identity-v1',at:new Date().toISOString(),providerCalls:calls,endpoint:'/fixtures',filters:{date,season:2026,status:'NS',timezone:'Asia/Seoul'},resultDataAccessed:false,liveDataAccessed:false,fuzzyMatching:false,claimsSource:['src/lib/teams/team-aliases.ts','src/lib/football/core/team-catalog-slate-2026-09.ts'],rows};
 writeFileSync(join(dir,'audit.json'),JSON.stringify(envelope(audit),null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({auditPath:join(dir,'audit.json'),...audit},null,2));
}
main().catch(()=>{console.error('PRIORITY_COLLECTION_PRECONDITION_FAILED');process.exitCode=1;});
