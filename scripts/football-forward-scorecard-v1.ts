import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {envelope,readSealed,writeOnce,type Fixture} from './football-forward-shadow-v1';
import {scheduleState,restoreScheduleLedger} from './football-forward-schedule-ledger-v1';
import {validatePregame,validateGrade} from './football-forward-validation-v1';

export type GradeReference={fixtureId:number;predictionHash:string;gradeHash:string;gradedAt:string};
export function milestoneCrossings(root:string,references:GradeReference[]){
  const ordered=[...references].sort((a,b)=>a.gradedAt.localeCompare(b.gradedAt)||a.fixtureId-b.fixtureId);
  assert.equal(new Set(ordered.map(r=>r.fixtureId)).size,ordered.length,'DUPLICATE_GRADED_FIXTURE');
  const dir=join(root,'MODEL_FORWARD','milestones');mkdirSync(dir,{recursive:true});
  const reached:number[]=[],hashes:Record<string,string>={};
  for(const n of [25,50,100,200]){
    const file=join(dir,n+'.json');
    const expected=envelope({schemaVersion:'FOOTBALL_FORWARD_MILESTONE_V1',milestone:n,counter:'GRADED_PREDICTED_UNIQUE',ordering:'gradedAt ASC, fixtureId ASC',cohort:ordered.slice(0,n),reviewExecuted:false});
    if(existsSync(file)){const previous=readSealed(file);assert.ok(ordered.length>=n,'MILESTONE_EVIDENCE_MISSING');assert.equal(previous.sha256,expected.sha256,'MILESTONE_COHORT_CHANGED_REQUIRES_REVIEW');hashes[n]=previous.sha256;}
    else if(ordered.length>=n){writeOnce(file,JSON.stringify(expected,null,2)+'\n');reached.push(n);hashes[n]=expected.sha256;}
  }
  return {counter:ordered.length,current:[25,50,100,200].filter(n=>ordered.length>=n).at(-1)??null,reached,hashes};
}

export function generateScorecards(root:string,now=Date.now(),discoveryFailed=false){
  restoreScheduleLedger(root,now);
  const model=join(root,'MODEL_FORWARD'),ledger=join(model,'schedule-ledger'),runs=join(model,'runs');
  const fixtures:Fixture[]=existsSync(ledger)?readdirSync(ledger).filter(n=>/^\d+$/.test(n)).map(n=>scheduleState(root,Number(n)).latest.schedule):[];
  const reports=existsSync(runs)?readdirSync(runs).filter(n=>n.endsWith('-report.json')).map(n=>readSealed(join(runs,n))).sort((a,b)=>a.payload.startedAt.localeCompare(b.payload.startedAt)):[];
  const dates=new Set([new Date(now).toISOString().slice(0,10)]);
  for(const f of fixtures){dates.add(f.kickoffUtc.slice(0,10));const s=join(model,'fixtures',String(f.fixtureId),'snapshot.json');if(existsSync(s))dates.add(readSealed(s).payload.kickoffUtc.slice(0,10));}
  // Include zero-fixture days only where an actual discovery report defines coverage.
  for(const r of reports)for(let d=0;d<=7;d++)dates.add(new Date(Date.parse(r.payload.startedAt)+d*86400000).toISOString().slice(0,10));
  const references:GradeReference[]=[],cards=[];let allGradesKnown=true,totalGradedPass=0;
  for(const date of [...dates].sort()){
    const report=reports.filter(r=>r.payload.startedAt.slice(0,10)<=date&&new Date(Date.parse(r.payload.startedAt)+7*86400000).toISOString().slice(0,10)>=date).at(-1);
    const errors:string[]=[];let observedScheduled=0,eligible=0,predicted=0,pass=0,missed=0,firstSeenAfterKickoff=0,graded=0,gradedPredicted=0,gradedPass=0,homePredictions=0,drawPredictions=0,awayPredictions=0,predictedCorrect=0,predictedIncorrect=0;
    for(const f of fixtures){
      const dir=join(model,'fixtures',String(f.fixtureId)),file=join(dir,'snapshot.json');
      const targetDate=existsSync(file)?readSealed(file).payload.kickoffUtc.slice(0,10):f.kickoffUtc.slice(0,10);
      if(targetDate!==date)continue;observedScheduled++;
      try{
        if(existsSync(join(dir,'miss.json'))){readSealed(join(dir,'miss.json'));assert.ok(!existsSync(join(dir,'first-seen-after-kickoff.json')),'CONFLICTING_ABSENCE_STATES');missed++;continue;}
        if(existsSync(join(dir,'first-seen-after-kickoff.json'))){readSealed(join(dir,'first-seen-after-kickoff.json'));firstSeenAfterKickoff++;continue;}
        if(!existsSync(file)){if(f.providerStatus==='NS'&&Date.parse(f.kickoffUtc)-now>=60000)eligible++;continue;}
        const snapshot=validatePregame(root,f.fixtureId),p=snapshot.payload;eligible++;
        if(p.status==='PASS')pass++;else{predicted++;if(p.predictedClass==='HOME')homePredictions++;else if(p.predictedClass==='DRAW')drawPredictions++;else awayPredictions++;}
        if(!existsSync(join(model,'postgame',f.fixtureId+'.json')))continue;
        const g=validateGrade(root,f.fixtureId,now);graded++;
        if(p.status==='PASS')gradedPass++;else{
          gradedPredicted++;if(g.payload.correct1X2)predictedCorrect++;else predictedIncorrect++;
          references.push({fixtureId:f.fixtureId,predictionHash:snapshot.sha256,gradeHash:g.sha256,gradedAt:g.payload.gradedAt});
        }
      }catch(e){errors.push('fixture '+f.fixtureId+': '+String(e));}
    }
    const known=errors.length===0,coverageComplete=!discoveryFailed&&report?.payload.coverageComplete===true&&known;
    if(!known)allGradesKnown=false;
    assert.equal(homePredictions+drawPredictions+awayPredictions,predicted);
    assert.equal(predictedCorrect+predictedIncorrect,gradedPredicted);
    const pending=predicted+pass-graded;assert.ok(pending>=0);assert.equal(graded+pending,predicted+pass);
    totalGradedPass+=gradedPass;
    const value=envelope({schemaVersion:'FOOTBALL_FORWARD_DAILY_SCORECARD_V1',date,timezone:'UTC',createdAt:new Date(now).toISOString(),scheduled:coverageComplete?observedScheduled:null,observedScheduled,
      eligible:known?eligible:null,predicted:known?predicted:null,pass:known?pass:null,missed:known?missed:null,firstSeenAfterKickoff:known?firstSeenAfterKickoff:null,
      graded:known?graded:null,pending:known?pending:null,gradedPredicted:known?gradedPredicted:null,gradedPass:known?gradedPass:null,
      homePredictions:known?homePredictions:null,drawPredictions:known?drawPredictions:null,awayPredictions:known?awayPredictions:null,
      predictedCorrect:known?predictedCorrect:null,predictedIncorrect:known?predictedIncorrect:null,accuracy:known&&gradedPredicted>0?predictedCorrect/gradedPredicted:null,
      coverageComplete,coverageSourceHash:report?.sha256??null,coverageScope:'Observed provider schedule; unobserved fixtures are unknown. FIRST_SEEN_AFTER_KICKOFF is excluded from MISS.',errors});
    const dir=join(model,'scorecards',date);mkdirSync(dir,{recursive:true});writeOnce(join(dir,now+'-'+randomUUID()+'.json'),JSON.stringify(value,null,2)+'\n');cards.push(value);
  }
  const milestones=allGradesKnown?milestoneCrossings(root,references):null;
  return {cards,totalGradedPredicted:allGradesKnown?references.length:null,totalGradedPass:allGradesKnown?totalGradedPass:null,milestones,errors:cards.flatMap(c=>c.payload.errors)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.equal(process.argv[2],'--run');assert.equal(process.argv.length,3);
  const result=generateScorecards(fileURLToPath(new URL('../data/cache/research/football/forward-shadow-v1/',import.meta.url)));
  console.log(JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=1;
}
