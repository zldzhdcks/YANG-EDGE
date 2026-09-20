/** Read pregame envelopes only. Grade files are statted, never opened. */
import {existsSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {readEnvelope,time} from './evidence';
export function countOfficialPredictions(roots:{label:string;modelRoot:string}[]){
 const rows:{root:string;fixtureId:number;hash:string;graded:boolean}[]=[],invalid:{root:string;fixture:string;reason:string}[]=[],passes=[];
 for(const root of roots){const dir=join(root.modelRoot,'fixtures');if(!existsSync(dir))continue;
  for(const id of readdirSync(dir)){const p=join(dir,id);try{
   if(!existsSync(join(p,'snapshot.json')))continue;
   const s=readEnvelope(join(p,'snapshot.json')),r=readEnvelope(join(p,'seal-receipt.json'));const v=s.payload;
   assert.equal(v.modelVersion,'football-poisson-research-v1');assert.equal(v.modelSourceHash,'6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf');
   assert.equal(r.payload.snapshotHash,s.sha256);assert.equal(r.payload.validPregame,true);assert.equal(String(v.fixtureId),id);assert.equal(v.layer,'MODEL_FORWARD');assert(!existsSync(join(p,'invalid.json')));assert(time(v.predictionCreatedAt)<=time(r.payload.sealedAt)&&time(r.payload.sealedAt)<time(v.kickoffUtc));
   if(v.status==='PASS'){passes.push({root:root.label,fixtureId:v.fixtureId});continue;}
   assert.equal(v.status,'PREDICTED');const probabilities=[v.pHome,v.pDraw,v.pAway];assert(probabilities.every(x=>Number.isFinite(x)&&x>=0&&x<=1));assert(Math.abs(probabilities.reduce((a,b)=>a+b,0)-1)<1e-9);
   const grade=join(root.modelRoot,'postgame',`${id}.json`);rows.push({root:root.label,fixtureId:v.fixtureId,hash:s.sha256,graded:existsSync(grade)&&statSync(grade).isFile()});
  }catch{invalid.push({root:root.label,fixture:id,reason:'INVALID_PREGAME_SEAL'});}}
 }
 const unique=new Map<number,typeof rows[number]>(),conflicts:number[]=[];let duplicateCopies=0;
 for(const r of rows){const old=unique.get(r.fixtureId);if(old){if(old.hash!==r.hash)conflicts.push(r.fixtureId);else {duplicateCopies++;old.graded ||= r.graded;}}else unique.set(r.fixtureId,{...r});}
 return {countAsOf:new Date().toISOString(),total:unique.size,sealedPredictionArtifacts:rows.length,gradedArtifacts:rows.filter(r=>r.graded).length,ungradedArtifacts:rows.filter(r=>!r.graded).length,conflictDetails:rows.filter(r=>conflicts.includes(r.fixtureId)),graded:[...unique.values()].filter(r=>r.graded).length,ungraded:[...unique.values()].filter(r=>!r.graded).length,gradeCountBasis:'GRADE_FILE_EXISTS_ONLY_NO_OUTCOME_READ',duplicateCopies,conflicts,invalid,passes:passes.length,rows,status:conflicts.length||invalid.length?'DISCREPANCY':'VERIFIED'};
}
