/** Research prediction admission only; never enables an official MLB pick. */
import assert from 'node:assert/strict';
import {join} from 'node:path';
import type {ResearchTargetGame} from '../daily-scope-lock';
import {readEnvelope,sha,time} from './evidence';
import {inspectSealedMlbInputAt} from '../../mlb/prediction-v0/sealed-input-manifest';
export type MlbPredictionReference={kind:'MLB_SEALED_RESEARCH_V0';snapshotHash:string;scopeSha256:string};
export const mlbPredictionDir=(cwd:string,scope:string,targetId:string)=>join(cwd,'data/research/mlb/sealed-pregame',scope,sha(targetId));
export function validateMlbReference(cwd:string,target:ResearchTargetGame,scopeHash:string,ref:MlbPredictionReference,createdAt:string){
  assert.deepEqual(Object.keys(ref).sort(),['kind','snapshotHash','scopeSha256'].sort());
  assert.equal(ref.scopeSha256,scopeHash);assert.equal(target.sport,'BASEBALL');assert.equal(target.competitionNameRaw,'MLB');
  const dir=mlbPredictionDir(cwd,scopeHash,target.targetId),s=readEnvelope(join(dir,'prediction.json')),r=readEnvelope(join(dir,'receipt.json')).payload,p=s.payload;
  assert.equal(s.sha256,ref.snapshotHash);assert.equal(r.snapshotHash,s.sha256);assert.equal(p.schemaVersion,'mlb-sealed-research-prediction-v1');
  assert.equal(p.scopeSha256,scopeHash);assert.equal(p.target.targetId,target.targetId);assert.equal(String(p.target.gamePk),target.providerGameId);
  assert.equal(p.target.provider,'MLB_STATS_API');assert.equal(p.modelVersion,'mlb-baseline-prediction-v0.1.0');
  assert.equal(p.researchOnly,true);assert.equal(p.officialPromotion,false);assert.equal(p.providerCallsDuringPrediction,0);
  assert.equal(p.networkCallsDuringPrediction,0);assert.equal(p.targetResultUsed,false);
  assert.ok(time(p.predictionCreatedAt)<=time(r.sealedAt)&&time(r.sealedAt)<=time(createdAt)&&time(createdAt)<time(target.scheduledStartTimeKst!),'PREGAME_WINDOW_MISSED');
  assert.equal(time(p.target.scheduledStart),time(target.scheduledStartTimeKst!));
  inspectSealedMlbInputAt(cwd,p.manifestPath,p.manifestHash,p.target,scopeHash,p.predictionCreatedAt);
  const g=p.prediction;assert.equal(g.gamePk,p.target.gamePk);assert.equal(g.homeTeam,target.homeTeamRaw);assert.equal(g.awayTeam,target.awayTeamRaw);
  assert.equal(g.leakage.blocked,false);assert.notEqual(g.inputStatus,'BLOCKED');assert.equal(g.officialPick,null);
  assert.equal(g.researchBaseline.researchOnly,true);assert.ok(g.marketPredictions.length>0);
  for(const m of g.marketPredictions){
    assert.ok([m.homeProbability,m.awayProbability].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1));
    assert.ok(Math.abs(m.homeProbability+m.awayProbability-1)<1e-9);assert.equal(m.officialPick,null);
    assert.equal(m.researchBaseline.researchOnly,true);
  }
}
