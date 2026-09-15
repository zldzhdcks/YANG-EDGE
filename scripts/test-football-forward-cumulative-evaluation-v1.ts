import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {envelope,MODEL_HASH} from './football-forward-shadow-v1';
import {
  assertProbabilitySanity,
  evaluateForwardCumulative,
  multiclassBrier,
  multiclassLogLoss,
  probabilityBucket,
  ratio,
  uniqueByFixtureId,
} from './football-forward-cumulative-evaluation-v1';

const kickoff=Date.parse('2026-09-14T16:00:00.000Z');
const created=kickoff-86400000;
const graded=kickoff+7200000;
const temp=()=>mkdtempSync(join(tmpdir(),'forward-eval-'));

function writeSealed(file:string,payload:unknown){
  mkdirSync(join(file,'..'),{recursive:true});
  writeFileSync(file,JSON.stringify(envelope(payload),null,2)+'\n');
}

function sealPredicted(root:string,opts:{
  fixtureId:number;
  pHome:number;
  pDraw:number;
  pAway:number;
  predictedClass?:'HOME'|'DRAW'|'AWAY';
  status?:'PREDICTED'|'PASS';
  modelSourceHash?:string;
  validPregame?:boolean;
  kickoffUtc?:string;
  home?:number;
  away?:number;
  grade?:boolean;
  tamperSnapshotHash?:boolean;
  receiptMismatch?:boolean;
}){
  const id=opts.fixtureId;
  const kickoffUtc=opts.kickoffUtc??new Date(kickoff).toISOString();
  const cutoffAt=new Date(created).toISOString();
  const predictionCreatedAt=new Date(created+10).toISOString();
  const sealedAt=new Date(created+20).toISOString();
  const dir=join(root,'MODEL_FORWARD','fixtures',String(id));
  mkdirSync(dir,{recursive:true});
  const fixture={fixtureId:id,kickoffUtc,leagueId:39,season:2026,homeTeam:{id:1,name:'Home'},awayTeam:{id:2,name:'Away'},providerStatus:'NS',scheduleFetchedAt:new Date(created-1000).toISOString()};
  const inputPayload={
    target:{matchId:'API_FOOTBALL:'+id,competitionId:'39',homeTeamId:'1',awayTeamId:'2',kickoffAt:kickoffUtc},
    targetScheduleObservation:fixture,
    cutoffAt,
    completedHistory:[],
  };
  const input=envelope(inputPayload);
  writeFileSync(join(dir,'input.json'),JSON.stringify(input,null,2)+'\n');
  const status=opts.status??'PREDICTED';
  const predictedClass=status==='PASS'?null:opts.predictedClass??(opts.pHome>=opts.pDraw&&opts.pHome>=opts.pAway?'HOME':opts.pDraw>=opts.pAway?'DRAW':'AWAY');
  const snapshotPayload={
    layer:'MODEL_FORWARD',
    fixtureId:id,
    kickoffUtc,
    leagueId:39,
    season:2026,
    homeTeam:{id:1,name:'Home'},
    awayTeam:{id:2,name:'Away'},
    predictionCreatedAt,
    cutoffAt,
    trainingFixtureIds:[],
    trainingMatchCount:0,
    homeRelevantSampleCount:0,
    awayRelevantSampleCount:0,
    status,
    passReason:status==='PASS'?['INSUFFICIENT_HISTORY']:[],
    pHome:status==='PASS'?null:opts.pHome,
    pDraw:status==='PASS'?null:opts.pDraw,
    pAway:status==='PASS'?null:opts.pAway,
    predictedClass,
    modelVersion:'football-poisson-research-v1',
    modelSourceHash:opts.modelSourceHash??MODEL_HASH,
    inputSnapshotHash:input.sha256,
    revision:1,
    revisionReason:'INITIAL',
    previousHash:null,
    TARGET_RESULT_DATA_USED:false,
    PAST_COMPLETED_RESULT_DATA_USED:false,
    ODDS_USED:false,
    MARKET_USED:false,
    PROVIDER_PREDICTION_USED:false,
    OWNER_SHADOW_USED:false,
    EXTERNAL_SHADOW_USED:false,
    historyPolicy:'ACTUALLY_OBSERVED_PAST_FT_SAME_LEAGUE_365D',
    trainingProviderFixtureIds:[],
  };
  const snapshot=envelope(snapshotPayload);
  if(opts.tamperSnapshotHash)(snapshot as {sha256:string}).sha256='0'.repeat(64);
  writeFileSync(join(dir,'snapshot.json'),JSON.stringify(snapshot,null,2)+'\n');
  const receiptPayload={fixtureId:id,snapshotHash:opts.receiptMismatch?'1'.repeat(64):snapshot.sha256,sealedAt,validPregame:opts.validPregame??true};
  writeFileSync(join(dir,'seal-receipt.json'),JSON.stringify(envelope(receiptPayload),null,2)+'\n');
  if(opts.grade){
    const home=opts.home??2;
    const away=opts.away??1;
    const actualClass=home>away?'HOME':home<away?'AWAY':'DRAW';
    writeSealed(join(root,'MODEL_FORWARD','postgame',id+'.json'),{
      fixtureId:id,
      predictionHash:snapshot.sha256,
      actualScore:{home,away},
      actualClass,
      correct1X2:status==='PASS'?null:predictedClass===actualClass,
      gradedAt:new Date(graded).toISOString(),
      providerFetchedAt:new Date(graded-1).toISOString(),
      officialCompletionEvidence:{fixtureStatus:'FT',providerFetchedAt:new Date(graded-1).toISOString()},
      sourceHash:'a'.repeat(64),
    });
  }
  return snapshot;
}

test('probability helpers: sum sanity, empty ratio, empty metrics, buckets',()=>{
  assert.deepEqual(assertProbabilitySanity(0.5,0.3,0.2),{pHome:0.5,pDraw:0.3,pAway:0.2});
  assert.throws(()=>assertProbabilitySanity(0.5,0.5,0.5),/PROBABILITY_SUM/);
  assert.throws(()=>assertProbabilitySanity(-0.1,0.6,0.5),/MALFORMED/);
  assert.throws(()=>assertProbabilitySanity(Number.NaN,0.5,0.5),/MALFORMED/);
  assert.equal(ratio(1,0),null);
  assert.equal(ratio(2,4),0.5);
  assert.equal(multiclassLogLoss([]),null);
  assert.equal(multiclassBrier([]),null);
  assert.equal(probabilityBucket(0.399),'LT_40');
  assert.equal(probabilityBucket(0.40),'40_50');
  assert.equal(probabilityBucket(0.50),'50_60');
  assert.equal(probabilityBucket(0.60),'60_70');
  assert.equal(probabilityBucket(0.70),'70_PLUS');
});

test('duplicate fixture ids are not double-counted',()=>{
  const rows=[{fixtureId:1},{fixtureId:1},{fixtureId:2}];
  assert.deepEqual(uniqueByFixtureId(rows),[{fixtureId:1},{fixtureId:2}]);
});

test('valid sealed PREDICTED + official grade is included in W/L',()=>{
  const root=temp();
  sealPredicted(root,{fixtureId:100,pHome:0.6,pDraw:0.25,pAway:0.15,grade:true,home:2,away:1});
  const e=evaluateForwardCumulative(root,graded);
  assert.equal(e.payload.counts.totalGraded,1);
  assert.equal(e.payload.counts.correct,1);
  assert.equal(e.payload.counts.wrong,0);
  assert.equal(e.payload.counts.accuracy,1);
  assert.equal(e.payload.included[0].fixtureId,100);
  assert.equal(e.payload.included[0].bucket,'60_70');
  assert.equal(e.payload.ENGINE_CHANGE_ALLOWED,false);
  assert.equal(e.payload.PREDICTION_REEXECUTED,false);
  assert.ok(typeof e.payload.counts.logLoss==='number');
  assert.ok(typeof e.payload.counts.brierScore==='number');
});

test('PASS is excluded from prediction W/L and listed operationally',()=>{
  const root=temp();
  sealPredicted(root,{fixtureId:100,pHome:0.6,pDraw:0.25,pAway:0.15,grade:true});
  sealPredicted(root,{fixtureId:101,pHome:0,pDraw:0,pAway:0,status:'PASS',grade:true,home:1,away:1});
  const e=evaluateForwardCumulative(root,graded);
  assert.equal(e.payload.counts.totalGraded,1);
  assert.equal(e.payload.counts.pass,1);
  assert.deepEqual(e.payload.operational.passIds,[101]);
  assert.equal(e.payload.included.some(r=>r.fixtureId===101),false);
});

test('MISS is excluded from W/L and listed operationally',()=>{
  const root=temp();
  sealPredicted(root,{fixtureId:100,pHome:0.6,pDraw:0.25,pAway:0.15,grade:true});
  writeSealed(join(root,'MODEL_FORWARD','fixtures','200','miss.json'),{
    fixtureId:200,leagueId:39,kickoffUtc:new Date(kickoff).toISOString(),status:'MISSED_PREGAME_SNAPSHOT',
    scheduleFirstObservedAt:new Date(created).toISOString(),firstSourceHash:'b'.repeat(64),
    recordedAt:new Date(kickoff+1).toISOString(),backfillAllowed:false,
  });
  const e=evaluateForwardCumulative(root,graded);
  assert.equal(e.payload.counts.totalGraded,1);
  assert.equal(e.payload.counts.miss,1);
  assert.deepEqual(e.payload.operational.missIds,[200]);
});

test('first-seen-after-kickoff is excluded from W/L',()=>{
  const root=temp();
  writeSealed(join(root,'MODEL_FORWARD','fixtures','300','first-seen-after-kickoff.json'),{
    fixtureId:300,leagueId:39,kickoffUtc:new Date(kickoff).toISOString(),
    firstObservedAt:new Date(kickoff+1000).toISOString(),status:'FIRST_SEEN_AFTER_KICKOFF',
    recordedAt:new Date(kickoff+1000).toISOString(),MISS:false,BACKFILL:false,PREDICTION:false,
  });
  const e=evaluateForwardCumulative(root,graded);
  assert.equal(e.payload.counts.totalGraded,0);
  assert.equal(e.payload.counts.firstSeenAfterKickoff,1);
  assert.equal(e.payload.counts.accuracy,null);
});

test('missing official grade is pending and excluded from W/L',()=>{
  const root=temp();
  sealPredicted(root,{fixtureId:100,pHome:0.6,pDraw:0.25,pAway:0.15,grade:false});
  const e=evaluateForwardCumulative(root,graded);
  assert.equal(e.payload.counts.totalPredicted,1);
  assert.equal(e.payload.counts.totalGraded,0);
  assert.equal(e.payload.counts.pendingPredicted,1);
  assert.deepEqual(e.payload.operational.pendingPredictedIds,[100]);
});

test('invalid snapshot hash is an integrity exclusion',()=>{
  const root=temp();
  sealPredicted(root,{fixtureId:100,pHome:0.6,pDraw:0.25,pAway:0.15,grade:true,tamperSnapshotHash:true});
  const e=evaluateForwardCumulative(root,graded);
  assert.equal(e.payload.counts.totalGraded,0);
  assert.equal(e.payload.integrityExclusions[0].fixtureId,100);
  assert.match(e.payload.integrityExclusions[0].reason,/TAMPERED/);
});

test('receipt mismatch is an integrity exclusion',()=>{
  const root=temp();
  sealPredicted(root,{fixtureId:100,pHome:0.6,pDraw:0.25,pAway:0.15,grade:true,receiptMismatch:true});
  const e=evaluateForwardCumulative(root,graded);
  assert.equal(e.payload.counts.totalGraded,0);
  assert.equal(e.payload.integrityExclusions[0].fixtureId,100);
});

test('validPregame=false is an integrity exclusion',()=>{
  const root=temp();
  sealPredicted(root,{fixtureId:100,pHome:0.6,pDraw:0.25,pAway:0.15,grade:true,validPregame:false});
  const e=evaluateForwardCumulative(root,graded);
  assert.equal(e.payload.counts.totalGraded,0);
  assert.equal(e.payload.integrityExclusions[0].fixtureId,100);
});

test('wrong MODEL_HASH is an integrity exclusion',()=>{
  const root=temp();
  sealPredicted(root,{fixtureId:100,pHome:0.6,pDraw:0.25,pAway:0.15,grade:true,modelSourceHash:'c'.repeat(64)});
  const e=evaluateForwardCumulative(root,graded);
  assert.equal(e.payload.counts.totalGraded,0);
  assert.equal(e.payload.integrityExclusions[0].fixtureId,100);
});

test('malformed probabilities are excluded',()=>{
  const root=temp();
  sealPredicted(root,{fixtureId:100,pHome:2,pDraw:0,pAway:0,predictedClass:'HOME',grade:true});
  const e=evaluateForwardCumulative(root,graded);
  assert.equal(e.payload.counts.totalGraded,0);
  assert.match(e.payload.integrityExclusions[0].reason,/MALFORMED_PROBABILITY|PROBABILITY_SUM/);
});

test('probability sum sanity rejects non-simplex triples',()=>{
  const root=temp();
  sealPredicted(root,{fixtureId:100,pHome:0.5,pDraw:0.5,pAway:0.5,predictedClass:'HOME',grade:true});
  const e=evaluateForwardCumulative(root,graded);
  assert.equal(e.payload.counts.totalGraded,0);
  assert.match(e.payload.integrityExclusions[0].reason,/PROBABILITY_SUM_SANITY/);
});

test('empty probability bucket stays null-safe and N=0 accuracy is null',()=>{
  const e=evaluateForwardCumulative(temp(),graded);
  assert.equal(e.payload.counts.accuracy,null);
  assert.equal(e.payload.probabilityBuckets.LT_40.sample,0);
  assert.equal(e.payload.probabilityBuckets.LT_40.accuracy,null);
  assert.equal(e.payload.probabilityBuckets.LT_40.calibrationGap,null);
  assert.equal(e.payload.classMetrics.DRAW.precision,null);
  assert.equal(e.payload.classMetrics.DRAW.recall,null);
  assert.equal(e.payload.checkpoint.currentN,0);
  assert.equal(e.payload.checkpoint.checkpointReached,false);
  assert.equal(e.payload.INTERPRETATION,'EARLY_DESCRIPTIVE_ONLY');
  assert.equal(e.payload.ENGINE_CHANGE_ALLOWED,false);
});

test('daily reviews are not a W/L source; official grade is unique per fixture',()=>{
  const root=temp();
  sealPredicted(root,{fixtureId:100,pHome:0.55,pDraw:0.25,pAway:0.20,grade:true,home:0,away:1});
  mkdirSync(join(root,'reviews'),{recursive:true});
  writeFileSync(join(root,'reviews','2026-09-14-football-forward-postgame-review-v1.json'),JSON.stringify({
    payload:{predicted:[{fixtureId:100,verdict:'CORRECT'},{fixtureId:100,verdict:'CORRECT'},{fixtureId:999,verdict:'CORRECT'}]},
  }));
  const e=evaluateForwardCumulative(root,graded);
  assert.equal(e.payload.counts.totalGraded,1);
  assert.equal(e.payload.counts.wrong,1);
  assert.equal(e.payload.SOURCE_OF_TRUTH.gradePriority.includes('OFFICIAL_POSTGAME_GRADE'),true);
  assert.equal(e.payload.included.length,1);
});

test('evaluation module does not import engine, freeze, or provider clients',()=>{
  const src=readFileSync(new URL('./football-forward-cumulative-evaluation-v1.ts',import.meta.url),'utf8');
  assert.doesNotMatch(src,/predictFootball|from ['"][^'"]*poisson-research-v1|freeze\(|FOOTBALL_API_KEY|v3\.football\.api-sports/);
  assert.doesNotMatch(src,/from '\.\/football-forward-postgame-v1'|from '\.\/run-football-forward/);
});

test('log loss and Brier match the documented 3-class formulas',()=>{
  const rows=[{actualClass:'HOME' as const,pHome:1,pDraw:0,pAway:0}];
  assert.ok(Math.abs(multiclassLogLoss(rows)!)<1e-12);
  assert.equal(multiclassBrier(rows),0);
  const mixed=[{actualClass:'AWAY' as const,pHome:0.2,pDraw:0.3,pAway:0.5}];
  assert.ok(Math.abs(multiclassLogLoss(mixed)!-(-Math.log(0.5)))<1e-12);
  assert.ok(Math.abs(multiclassBrier(mixed)!-((0.2)**2+(0.3)**2+(0.5-1)**2))<1e-12);
});
