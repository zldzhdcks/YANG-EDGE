/** Separate postgame operation; never imported by the pregame runner. */
import assert from 'node:assert/strict';
import {existsSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {readSealed,envelope,writeOnce,LAYERS} from './football-forward-shadow-v1';
export type ResultObservation={fixtureId:number;leagueId:number;fixtureStatus:'FT';actualScore:{home:number;away:number};providerFetchedAt:string;sourceHash:string};
export function grade(root:string,result:ResultObservation,clock=()=>Date.now()){
  const now=clock(),dir=join(root,LAYERS.MODEL_FORWARD,'fixtures',String(result.fixtureId));
  assert.ok(!existsSync(join(dir,'miss.json')),'MISS_CANNOT_BE_GRADED');
  const prediction=readSealed(join(dir,'snapshot.json')),p=prediction.payload;
  assert.equal(readSealed(join(dir,'seal-receipt.json')).payload.snapshotHash,prediction.sha256);
  assert.equal(result.fixtureId,p.fixtureId);assert.equal(result.leagueId,p.leagueId);assert.equal(result.fixtureStatus,'FT');
  assert.ok(Date.parse(result.providerFetchedAt)>Date.parse(p.kickoffUtc)&&Date.parse(result.providerFetchedAt)<=now,'NOT_OBSERVED_POSTGAME');
  assert.ok(/^[a-f0-9]{64}$/.test(result.sourceHash));
  const {home,away}=result.actualScore;for(const n of [home,away])assert.ok(Number.isSafeInteger(n)&&n>=0&&n<=100);
  const actualClass=home>away?'HOME':home<away?'AWAY':'DRAW';
  const value=envelope({fixtureId:result.fixtureId,predictionHash:prediction.sha256,actualScore:{home,away},actualClass,correct1X2:p.status==='PREDICTED'?p.predictedClass===actualClass:null,gradedAt:new Date(now).toISOString(),officialCompletionEvidence:{fixtureStatus:'FT',providerFetchedAt:result.providerFetchedAt},sourceHash:result.sourceHash});
  const output=join(root,LAYERS.MODEL_FORWARD,'postgame');mkdirSync(output,{recursive:true});
  writeOnce(join(output,`${result.fixtureId}.json`),JSON.stringify(value,null,2)+'\n');return value;
}
