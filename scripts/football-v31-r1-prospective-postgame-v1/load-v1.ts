import {requireRule} from '../football-v31-r1-prospective-v1/store-v1';
import {loadSealedTargets,type ExpectedSeal} from './grader-v1';
import {bindBatchAudit,FIRST_BATCH_ID} from './registry-v1';
import type {Target} from '../football-v31-r1-prospective-v1/frozen/scripts/football-v3-feature-research-v1/contracts-v1';

type SecondOutcome={status:string;fixtureId:number;leagueId:number;season:number;kickoffUtc:string;homeTeamId:number;awayTeamId:number;cutoffAt:string|null;predictionCreatedAt:string|null;inputHash:string|null;snapshotHash:string|null;v1PredictionHash:string|null;h2PredictionHash:string|null;r1PredictionHash:string|null};

function sealedSecond(o:SecondOutcome):ExpectedSeal{
 requireRule(o.status==='SEALED','NON_SEALED_TARGET');
 requireRule(!!o.cutoffAt&&!!o.predictionCreatedAt&&!!o.inputHash&&!!o.snapshotHash&&!!o.v1PredictionHash&&!!o.h2PredictionHash&&!!o.r1PredictionHash,'SEALED_METADATA');
 return {fixtureId:o.fixtureId,leagueId:o.leagueId,season:o.season,kickoffUtc:o.kickoffUtc,homeTeamId:o.homeTeamId,awayTeamId:o.awayTeamId,cutoffAt:o.cutoffAt,predictionCreatedAt:o.predictionCreatedAt,snapshotHash:o.snapshotHash,v1PredictionHash:o.v1PredictionHash,h2PredictionHash:o.h2PredictionHash,r1PredictionHash:o.r1PredictionHash,inputHash:o.inputHash};
}

export function loadExpectedSeals(batchId:string,auditFile?:string):ExpectedSeal[]{
 const bound=bindBatchAudit(batchId,auditFile);
 if(bound.desc.batchId===FIRST_BATCH_ID){
  const rows=loadSealedTargets(bound.file,bound.desc.auditSha256);
  requireRule(rows.length===bound.desc.targetCount,'SEALED_TARGET_COUNT');
  return rows;
 }
 const payload=bound.payload as {TARGET_COUNT:number;outcomes:SecondOutcome[]};
 requireRule(payload.TARGET_COUNT===bound.desc.targetCount,'TARGET_COUNT');
 const rows=payload.outcomes.filter(o=>o.status==='SEALED').map(sealedSecond);
 requireRule(rows.length===bound.desc.targetCount,'SEALED_TARGET_COUNT');
 return rows;
}

export function identityOf(row:ExpectedSeal):Target{
 return {fixtureId:row.fixtureId,leagueId:row.leagueId,season:row.season,kickoffUtc:row.kickoffUtc,homeTeamId:row.homeTeamId,awayTeamId:row.awayTeamId};
}
