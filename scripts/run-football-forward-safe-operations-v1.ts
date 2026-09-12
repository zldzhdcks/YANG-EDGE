import assert from 'node:assert/strict';
import {mkdirSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {run} from './run-football-forward-shadow-v1';
import {collectPostgame} from './run-football-forward-postgame-v1';
import {generateScorecards} from './football-forward-scorecard-v1';
import {envelope,writeOnce} from './football-forward-shadow-v1';

export async function runSafeOperations(){
  const root=fileURLToPath(new URL('../data/cache/research/football/forward-shadow-v1/',import.meta.url));
  const model=join(root,'MODEL_FORWARD');mkdirSync(model,{recursive:true});
  const lock=join(model,'safe-operations.lock'),fd=openSync(lock,'wx');
  try{
    const startedAt=new Date().toISOString();let discoveryHash:string|null=null,discoveryComplete=false;const errors:string[]=[];
    try{const discovery=await run();discoveryHash=discovery.sha256;discoveryComplete=discovery.payload.coverageComplete;if(!discoveryComplete)errors.push('DISCOVERY_PARTIAL');}catch(e){errors.push('DISCOVERY: '+String(e));}
    // A provider discovery outage does not prevent grading already sealed predictions.
    const postgame=await collectPostgame(root,process.env.FOOTBALL_API_KEY);
    const scorecards=generateScorecards(root,Date.now(),!discoveryComplete);if(postgame.payload.errors)errors.push('POSTGAME_ERRORS');errors.push(...scorecards.errors);
    const report=envelope({schemaVersion:'FOOTBALL_FORWARD_SAFE_OPERATIONS_V1',startedAt,completedAt:new Date().toISOString(),discoveryHash,discoveryComplete,
      postgameHash:postgame.sha256,postgameGradedThisRun:postgame.payload.gradedThisRun,postgameRequests:postgame.payload.requests,
      scorecards:scorecards.cards.map(c=>({date:c.payload.date,sha256:c.sha256})),totalGradedPredicted:scorecards.totalGradedPredicted,totalGradedPass:scorecards.totalGradedPass,milestones:scorecards.milestones,
      firstSeenAfterKickoffCount:scorecards.errors.length?null:scorecards.cards.reduce((n,c)=>n+(c.payload.firstSeenAfterKickoff??0),0),errors,success:errors.length===0,MODEL_CHANGED:false,PREDICTION_LOGIC_CHANGED:false,ODDS_USED:false});
    const dir=join(model,'safe-operations-runs');mkdirSync(dir,{recursive:true});writeOnce(join(dir,startedAt.replace(/[:.]/g,'-')+'-'+randomUUID()+'.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));return report;
  }finally{closeSync(fd);unlinkSync(lock);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.ok(process.argv.length===3&&['--run','--watch'].includes(process.argv[2]));
  if(process.argv[2]==='--run')runSafeOperations().then(r=>{if(!r.payload.success)process.exitCode=1;}).catch(e=>{console.error(String(e));process.exitCode=1;});
  else{const cycle=async()=>{try{await runSafeOperations();}catch(e){console.error(String(e));}setTimeout(cycle,6*3600000);};cycle();}
}
