import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {freezeResearchSlateSource} from '../src/lib/research/slate-source-freeze';
import {lockResearchTargetScope} from '../src/lib/research/daily-scope-lock';
import {selectProductionBatch} from '../src/lib/research/terminal-decision/batch-selection';
import {loadCommittedProductionScope} from '../src/lib/research/terminal-decision/production-authority';
import {runDailyPregame} from './daily-pregame-production-v1';
import {canonical,envelope,sha} from '../src/lib/research/terminal-decision/evidence';
import {validateBatchInputProof} from '../src/lib/research/terminal-decision/batch-input-proof';
import {selectExactFixture} from '../src/lib/betman/daily-slate/exact-pregame-identity';
import {loadScope as loadV4Scope} from '../src/lib/football/v4-prospective-evidence-v1/collector';
const write=(p:string,v:unknown)=>{mkdirSync(join(p,'..'),{recursive:true});writeFileSync(p,JSON.stringify(v));};
async function setup(t:any){
 const root=mkdtempSync(join(tmpdir(),'ye-batch-test-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const start=new Date(Date.now()+86400000*3).toISOString(),date=new Date(Date.parse(start)+32400000).toISOString().slice(0,10);
 const git=(...a:string[])=>execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,...a],{cwd:root,stdio:'pipe'});
 git('init','--quiet');git('config','core.autocrlf','false');
 for(const id of ['one','two']){
  const cwd=join(root,'data/research/slate-batches',id);
  write(join(cwd,`data/operator-input/betman/${date}-daily-slate-v1.json`),{schemaVersion:'betman-daily-slate-v1',targetDateKst:date,sourceType:'OPERATOR_MANUAL',reviewStatus:'VERIFIED',scopeCompletenessStatus:'COMPLETE',reviewedAt:new Date(Date.now()-10000).toISOString(),games:[{operatorSlateGameId:id,sport:'SOCCER',homeTeamRaw:id,awayTeamRaw:'Away',scheduledStartTimeKst:start,reviewStatus:'VERIFIED',operatorHomeAwayStatus:'VERIFIED'}]});
  await freezeResearchSlateSource({cwd,dateKst:date});const s=await lockResearchTargetScope({cwd,dateKst:date});
  write(join(cwd,'batch-manifest.json'),{schemaVersion:'production-batch-selection-v1',round:111,batchId:id,dates:{[date]:{scopeSha256:sha(readFileSync(join(cwd,s.outputPath!)))}}});
 }
 git('add','.');git('-c','user.name=Test','-c','user.email=test@invalid','-c','commit.gpgsign=false','commit','--quiet','-m','synthetic');return {root,date,start};
}
test('same-date scopes require explicit batch and never choose latest',async t=>{const a=await setup(t);assert.throws(()=>selectProductionBatch(a.root,a.date),/EXPLICIT_BATCH_REQUIRED/);await assert.rejects(()=>runDailyPregame(a.root,a.date),/EXPLICIT_BATCH_REQUIRED/);});
test('explicit batch selects exact committed source chain and denominator',async t=>{const a=await setup(t);for(const id of ['one','two']){const s=selectProductionBatch(a.root,a.date,id),scope=loadCommittedProductionScope(s.root,a.date);assert.equal(scope.doc.targetCount,1);assert.equal(scope.doc.targets[0].targetId,id);assert.equal(s.binding?.scopeSha256,scope.hash);}});
test('path traversal and unknown batch fail closed',async t=>{const a=await setup(t);assert.throws(()=>selectProductionBatch(a.root,a.date,'../one'));assert.throws(()=>selectProductionBatch(a.root,a.date,'missing'));});
test('uncommitted manifest and mutated selected scope rejected',async t=>{const a=await setup(t);const s=selectProductionBatch(a.root,a.date,'one');writeFileSync(join(s.root,`data/audits/${a.date}-research-target-scope-lock-v1.json`),'{}');assert.throws(()=>selectProductionBatch(a.root,a.date,'one'),/SHA/);});
test('wrong batch target and scope hash plans rejected',async t=>{const a=await setup(t),s=selectProductionBatch(a.root,a.date,'one');await assert.rejects(()=>runDailyPregame(a.root,a.date,{scopeSha256:s.binding!.scopeSha256,targets:{two:{}}},'one'),/OUT_OF_SCOPE_PLAN/);await assert.rejects(()=>runDailyPregame(a.root,a.date,{scopeSha256:'0'.repeat(64),targets:{}},'one'));});
test('input gap stays pending, no network, and another batch remains intact',async t=>{const a=await setup(t),s=selectProductionBatch(a.root,a.date,'two'),before=readFileSync(join(s.root,`data/audits/${a.date}-research-target-scope-lock-v1.json`));const old=globalThis.fetch;globalThis.fetch=async()=>{throw Error('NETWORK_FORBIDDEN');};try{const r=await runDailyPregame(a.root,a.date,undefined,'one');assert.equal(r.coverage.SEALED_PASS_COUNT,0);assert.equal(r.coverage.UNRESOLVED_COUNT,1);assert.equal(r.rows[0].batchId,'one');assert.equal(r.rows[0].scopeId,r.batchBinding!.scopeId);}finally{globalThis.fetch=old;}assert(before.equals(readFileSync(join(s.root,`data/audits/${a.date}-research-target-scope-lock-v1.json`))));});
test('bound input rejects wrong batch, changed hash and unsafe chronology',async t=>{const a=await setup(t),s=selectProductionBatch(a.root,a.date,'one');const b={batchId:'one',scopeId:s.binding!.scopeId,scopeSha256:s.binding!.scopeSha256};const observed=new Date(Date.now()-10000).toISOString();const f=envelope({observedAt:observed,collectedAt:observed}),h=envelope({sealedAt:observed});write(join(s.root,'fixture.json'),f);write(join(s.root,'history.json'),h);const inputs={fixtureEvidencePath:'fixture.json',fixtureEvidenceHash:f.sha256,historyPath:'history.json',historyHash:h.sha256};const p={...b,targetId:'one',inputSnapshotId:`${b.scopeSha256}:one`,inputSha256:sha(canonical({fixtureHash:f.sha256,historyHash:h.sha256,targetId:'one',...b})),observedAt:observed,collectedAt:observed,asOf:observed,predictionCutoff:new Date(Date.parse(a.start)-60000).toISOString(),scheduledStart:a.start};validateBatchInputProof(s.root,b,'one',a.start,p,inputs);assert.throws(()=>validateBatchInputProof(s.root,b,'one',a.start,{...p,batchId:'two'},inputs));assert.throws(()=>validateBatchInputProof(s.root,b,'one',a.start,{...p,inputSha256:'0'.repeat(64)},inputs));assert.throws(()=>validateBatchInputProof(s.root,b,'one',a.start,{...p,collectedAt:new Date(Date.parse(a.start)+1).toISOString()},inputs));assert.throws(()=>validateBatchInputProof(s.root,b,'one',a.start,undefined,inputs));});
test('V4 uses the same selected committed scope chain',async t=>{const a=await setup(t),s=selectProductionBatch(a.root,a.date,'one'),v=loadV4Scope(s.root,a.date);assert.equal(v.scopeHash,s.binding!.scopeSha256);assert.equal(v.targets[0].targetId,'one');assert.throws(()=>loadV4Scope(a.root,a.date),/EXPLICIT_BATCH_REQUIRED/);});
test('provider identity is exact, duplicate ambiguous, reversed conflict, no nearest kickoff',()=>{const now=new Date().toISOString(),kickoff=new Date(Date.now()+3600000).toISOString();const claim={homeTeamId:50,awayTeamId:746,leagueId:39,kickoff,verified:true};const f={provider:'API_FOOTBALL' as const,fixtureId:1,leagueId:39,season:2026,kickoffUtc:kickoff,homeTeamId:50,awayTeamId:746,homeTeamName:'Manchester City',awayTeamName:'Sunderland',status:'NS' as const,observedAt:now};assert.equal(selectExactFixture(claim,[f],now).status,'EXACT_MATCH');assert.equal(selectExactFixture(claim,[f,f],now).status,'AMBIGUOUS');assert.equal(selectExactFixture(claim,[{...f,homeTeamId:746,awayTeamId:50}],now).status,'CONFLICT');assert.equal(selectExactFixture(claim,[{...f,kickoffUtc:new Date(Date.parse(kickoff)+1).toISOString()}],now).status,'NO_PROVIDER_EVIDENCE');});
