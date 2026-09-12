import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {readSealed,MODEL_HASH} from './football-forward-shadow-v1';
export function validatePregame(root:string,fixtureId:number){
  assert.ok(Number.isSafeInteger(fixtureId)&&fixtureId>0);
  const dir=join(root,'MODEL_FORWARD','fixtures',String(fixtureId));
  for(const flag of ['miss.json','invalid.json','first-seen-after-kickoff.json'])assert.ok(!existsSync(join(dir,flag)),'INVALID_PREGAME_STATE '+flag);
  const snapshot=readSealed(join(dir,'snapshot.json')),p=snapshot.payload,input=readSealed(join(dir,'input.json')),receipt=readSealed(join(dir,'seal-receipt.json')).payload;
  assert.equal(p.fixtureId,fixtureId);assert.equal(p.modelSourceHash,MODEL_HASH);assert.equal(p.modelVersion,'football-poisson-research-v1');
  assert.equal(p.inputSnapshotHash,input.sha256);assert.equal(receipt.snapshotHash,snapshot.sha256);assert.equal(receipt.fixtureId,fixtureId);assert.equal(receipt.validPregame,true);
  assert.ok(Date.parse(p.cutoffAt)<=Date.parse(p.predictionCreatedAt)&&Date.parse(p.predictionCreatedAt)<=Date.parse(receipt.sealedAt)&&Date.parse(receipt.sealedAt)<Date.parse(p.kickoffUtc),'INVALID_PREGAME_RECEIPT_TIME');
  assert.equal(input.payload.cutoffAt,p.cutoffAt);assert.equal(input.payload.target.matchId,'API_FOOTBALL:'+fixtureId);assert.equal(input.payload.target.competitionId,String(p.leagueId));assert.equal(input.payload.target.kickoffAt,p.kickoffUtc);
  assert.equal(input.payload.target.homeTeamId,String(p.homeTeam.id));assert.equal(input.payload.target.awayTeamId,String(p.awayTeam.id));
  for(const flag of ['TARGET_RESULT_DATA_USED','ODDS_USED','MARKET_USED','PROVIDER_PREDICTION_USED','OWNER_SHADOW_USED','EXTERNAL_SHADOW_USED'])assert.equal(p[flag],false,'FORBIDDEN_INPUT_FLAG');
  assert.ok(['PREDICTED','PASS'].includes(p.status));
  if(p.status==='PASS')assert.equal(p.predictedClass,null);else assert.ok(['HOME','DRAW','AWAY'].includes(p.predictedClass));
  return snapshot;
}
export function outcome(score:{home:number;away:number}){
  for(const n of [score.home,score.away])assert.ok(Number.isSafeInteger(n)&&n>=0&&n<=100,'INVALID_FT_SCORE');
  return score.home>score.away?'HOME':score.home<score.away?'AWAY':'DRAW';
}
export function validateGrade(root:string,fixtureId:number,now=Date.now()){
  const snapshot=validatePregame(root,fixtureId),p=snapshot.payload;
  const grade=readSealed(join(root,'MODEL_FORWARD','postgame',fixtureId+'.json')),g=grade.payload;
  assert.equal(g.fixtureId,fixtureId);assert.equal(g.predictionHash,snapshot.sha256);
  const observed=g.providerFetchedAt??g.officialCompletionEvidence?.providerFetchedAt;
  assert.equal(g.officialCompletionEvidence.fixtureStatus,'FT');assert.equal(observed,g.officialCompletionEvidence.providerFetchedAt);
  assert.ok(Date.parse(observed)>Date.parse(p.kickoffUtc)&&Date.parse(observed)<=Date.parse(g.gradedAt)&&Date.parse(g.gradedAt)<=now,'INVALID_GRADE_TIME');
  assert.match(g.sourceHash,/^[a-f0-9]{64}$/);assert.equal(g.actualClass,outcome(g.actualScore));assert.equal(g.correct1X2,p.status==='PASS'?null:p.predictedClass===g.actualClass);
  return grade;
}
