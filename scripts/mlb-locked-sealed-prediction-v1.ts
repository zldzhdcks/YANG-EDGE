/** Local manifest consumer only. No collection/provider imports. */
import assert from 'node:assert/strict';
import {existsSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {loadScope,readDecisionCoverage} from '../src/lib/research/terminal-decision';
import {loadCommittedProductionScope} from '../src/lib/research/terminal-decision/production-authority';
import {advancePregame} from '../src/lib/research/terminal-decision/lifecycle';
import {envelope,readEnvelope,time} from '../src/lib/research/terminal-decision/evidence';
import {mlbPredictionDir,validateMlbReference} from '../src/lib/research/terminal-decision/mlb-reference';
import {loadSealedMlbInput,type MlbManifestTarget} from '../src/lib/mlb/prediction-v0/sealed-input-manifest';
import {loadAndPredictMlbV0} from '../src/lib/mlb/prediction-v0/load-and-predict';
import {writeOnce} from './football-forward-shadow-v1';

export async function runLockedMlbPrediction(cwd:string,date:string,targetId:string,input:{path:string;sha256:string;target:MlbManifestTarget}){
  const s=loadCommittedProductionScope(cwd,date),t=s.doc.targets.find(x=>x.targetId===targetId);assert.ok(t);assert.equal(t.sport,'BASEBALL');
  const c=readDecisionCoverage(cwd,date);assert.ok(['COVERAGE_COMPLETE','COVERAGE_INCOMPLETE'].includes(c.status));
  if(!c.unresolvedTargetIds?.includes(targetId))return {readiness:'PRESERVED',terminal:null};
  assert.equal(input.target.targetId,targetId);assert.equal(input.target.dateKst,date);assert.equal(String(input.target.gamePk),t.providerGameId);
  assert.equal(time(input.target.scheduledStart),time(t.scheduledStartTimeKst!));assert.ok(Date.now()<time(t.scheduledStartTimeKst!));
  const dir=mlbPredictionDir(cwd,s.hash,targetId),file=join(dir,'prediction.json'),receipt=join(dir,'receipt.json');
  if(!existsSync(file)){
    const sealed=loadSealedMlbInput(cwd,input.path,input.sha256,input.target,s.hash);
    const schedule=await sealed.readJson(sealed.manifest.inputs.find(x=>x.artifactType==='Schedule')!.artifactPath);
    assert.equal(schedule.games[0].homeTeam,t.homeTeamRaw);assert.equal(schedule.games[0].awayTeam,t.awayTeamRaw);
    const r=await loadAndPredictMlbV0({cwd,dateKst:date,sealedInput:{...input,scopeSha256:s.hash}});
    assert.equal(r.kind,'ready','INPUT_WAITING');if(r.kind!=='ready')throw Error('INPUT_WAITING');
    assert.equal(r.games.length,1);const g=r.games[0];assert.equal(g.leakage.blocked,false);assert.notEqual(g.inputStatus,'BLOCKED');
    assert.equal(g.officialPick,null);assert.ok(Date.now()<time(t.scheduledStartTimeKst!));
    const p=envelope({schemaVersion:'mlb-sealed-research-prediction-v1',target:input.target,scopeSha256:s.hash,manifestPath:input.path,manifestHash:input.sha256,predictionCreatedAt:r.predictedAt,modelVersion:'mlb-baseline-prediction-v0.1.0',researchOnly:true,officialPromotion:false,providerCallsDuringPrediction:0,networkCallsDuringPrediction:0,targetResultUsed:false,prediction:g});
    // Reserve only after readiness succeeds; transient input gaps remain retryable.
    // Concurrent computations cannot both publish. Partial publication fails closed.
    mkdirSync(join(dir,'..'),{recursive:true});mkdirSync(dir);
    writeOnce(file,JSON.stringify(p,null,2)+'\n');
    const sealedAt=new Date().toISOString();assert.ok(time(sealedAt)<time(t.scheduledStartTimeKst!));
    writeOnce(receipt,JSON.stringify(envelope({snapshotHash:p.sha256,sealedAt}),null,2)+'\n');
  }
  // An interrupted partial seal is never repaired or overwritten. A complete seal is reused.
  const p=readEnvelope(file);assert.equal(p.payload.manifestHash,input.sha256);assert.equal(p.payload.manifestPath,input.path);
  const ref={kind:'MLB_SEALED_RESEARCH_V0' as const,snapshotHash:p.sha256,scopeSha256:s.hash};
  validateMlbReference(cwd,t,s.hash,ref,new Date().toISOString());
  return {readiness:'SEALED',terminal:advancePregame(cwd,date,targetId,'PENDING',{prediction:ref})};
}
