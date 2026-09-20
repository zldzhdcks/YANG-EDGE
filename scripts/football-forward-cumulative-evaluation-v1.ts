/**
 * Read-only Official Forward V1 cumulative evaluation.
 * Uses sealed MODEL_FORWARD snapshots + official postgame grades only.
 * Does not predict, freeze, call the engine, fetch providers, or mutate seals.
 */
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {envelope,MODEL_HASH,readSealed} from './football-forward-shadow-v1';
import {scheduleState} from './football-forward-schedule-ledger-v1';
import {validatePregame,validateGrade} from './football-forward-validation-v1';
import {canonicalGradeAllowed} from '../src/lib/football/official-canonical-v1';

export const SCHEMA_VERSION='FOOTBALL_FORWARD_CUMULATIVE_EVALUATION_V1';
export const FORWARD_MODEL='football-poisson-research-v1';
export const CHECKPOINT_TARGET=25;
export const PROBABILITY_SUM_EPSILON=1e-6;
/** Clip for log p_actual to keep log(0) undefined. Does not change sealed probabilities. */
export const LOG_LOSS_EPSILON=1e-15;
export const CLASSES=['HOME','DRAW','AWAY'] as const;
export type OutcomeClass=(typeof CLASSES)[number];
export const BUCKET_IDS=['LT_40','40_50','50_60','60_70','70_PLUS'] as const;
export type BucketId=(typeof BUCKET_IDS)[number];
export const SOURCE_OF_TRUTH={
  officialGrades:'MODEL_FORWARD/postgame/<fixtureId>.json',
  sealedSnapshots:'MODEL_FORWARD/fixtures/<fixtureId>/snapshot.json',
  sealReceipts:'MODEL_FORWARD/fixtures/<fixtureId>/seal-receipt.json',
  dailyScorecards:'MODEL_FORWARD/scorecards/<utcDate>/* — operational append-only; not the W/L source',
  dailyReviews:'data/audits/YYYY-MM-DD-football-forward-postgame-review-v1.json — descriptive ops only',
  gradePriority:'OFFICIAL_POSTGAME_GRADE supersedes daily review for the same fixtureId; reviews are never added into the W/L denominator',
} as const;

export type IncludedFixture={
  fixtureId:number;
  kickoffUtc:string;
  utcDate:string;
  predictedClass:OutcomeClass;
  actualClass:OutcomeClass;
  correct:boolean;
  pHome:number;
  pDraw:number;
  pAway:number;
  maxProbability:number;
  bucket:BucketId;
  snapshotHash:string;
  receiptHash:string;
  gradeHash:string;
  modelSourceHash:string;
  validPregame:true;
  sealedAt:string;
  predictionCreatedAt:string;
  sealedAtBeforeKickoff:true;
  predictionCreatedAtBeforeKickoff:true;
  TARGET_RESULT_DATA_USED:false;
  ODDS_USED:false;
  MARKET_USED:false;
  PROVIDER_PREDICTION_USED:false;
};

export function uniqueByFixtureId<T extends {fixtureId:number}>(rows:T[]):T[]{
  const seen=new Set<number>(),out:T[]=[];
  for(const row of rows){if(seen.has(row.fixtureId))continue;seen.add(row.fixtureId);out.push(row);}
  return out;
}

/** Finite probability in [0, 1]. */
export function isUnitProbability(value:unknown):value is number{
  return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
}

/**
 * 3-class probability sanity:
 * each p in [0,1], all finite, |pHome+pDraw+pAway-1| <= 1e-6.
 */
export function assertProbabilitySanity(pHome:unknown,pDraw:unknown,pAway:unknown):{pHome:number;pDraw:number;pAway:number}{
  assert.ok(isUnitProbability(pHome),'MALFORMED_PROBABILITY');
  assert.ok(isUnitProbability(pDraw),'MALFORMED_PROBABILITY');
  assert.ok(isUnitProbability(pAway),'MALFORMED_PROBABILITY');
  const sum=pHome+pDraw+pAway;
  assert.ok(Math.abs(sum-1)<=PROBABILITY_SUM_EPSILON,'PROBABILITY_SUM_SANITY');
  return {pHome,pDraw,pAway};
}

export function predictedClassFromProbabilities(pHome:number,pDraw:number,pAway:number):OutcomeClass{
  const values=[pHome,pDraw,pAway];
  return CLASSES[values.indexOf(Math.max(...values))];
}

export function maxProbability(pHome:number,pDraw:number,pAway:number):number{
  return Math.max(pHome,pDraw,pAway);
}

export function probabilityBucket(maxP:number):BucketId{
  if(maxP<0.40)return 'LT_40';
  if(maxP<0.50)return '40_50';
  if(maxP<0.60)return '50_60';
  if(maxP<0.70)return '60_70';
  return '70_PLUS';
}

function clipLogLoss(p:number):number{
  return Math.min(1-LOG_LOSS_EPSILON,Math.max(LOG_LOSS_EPSILON,p));
}

/**
 * Multiclass log loss = -mean_i log(p_i[actualClass]).
 * p_actual is clipped to [1e-15, 1-1e-15] only inside this formula.
 */
export function multiclassLogLoss(rows:Pick<IncludedFixture,'actualClass'|'pHome'|'pDraw'|'pAway'>[]):number|null{
  if(rows.length===0)return null;
  let sum=0;
  for(const row of rows){
    const p=row.actualClass==='HOME'?row.pHome:row.actualClass==='DRAW'?row.pDraw:row.pAway;
    sum+=-Math.log(clipLogLoss(p));
  }
  return sum/rows.length;
}

/**
 * 3-class Brier = mean_i sum_k (p_ik - y_ik)^2 for k in {HOME,DRAW,AWAY}.
 */
export function multiclassBrier(rows:Pick<IncludedFixture,'actualClass'|'pHome'|'pDraw'|'pAway'>[]):number|null{
  if(rows.length===0)return null;
  let sum=0;
  for(const row of rows){
    const yHome=row.actualClass==='HOME'?1:0;
    const yDraw=row.actualClass==='DRAW'?1:0;
    const yAway=row.actualClass==='AWAY'?1:0;
    sum+=(row.pHome-yHome)**2+(row.pDraw-yDraw)**2+(row.pAway-yAway)**2;
  }
  return sum/rows.length;
}

export function ratio(numerator:number,denominator:number):number|null{
  if(denominator===0)return null;
  return numerator/denominator;
}

function utcDate(iso:string):string{
  return new Date(iso).toISOString().slice(0,10);
}

function listNumericIds(dir:string):number[]{
  if(!existsSync(dir))return [];
  return readdirSync(dir).filter(n=>/^\d+$/.test(n.replace(/\.json$/,''))).map(n=>Number(n.replace(/\.json$/,'')));
}

export function collectFixtureIds(root:string):number[]{
  const model=join(root,'MODEL_FORWARD');
  const ids=new Set<number>();
  for(const id of listNumericIds(join(model,'fixtures')))ids.add(id);
  for(const id of listNumericIds(join(model,'postgame')))ids.add(id);
  for(const id of listNumericIds(join(model,'schedule-ledger')))ids.add(id);
  return [...ids].sort((a,b)=>a-b);
}

function emptyBucket(id:BucketId){
  return {bucket:id,sample:0,correct:0,wrong:0,accuracy:null as number|null,averageConfidence:null as number|null,observedAccuracy:null as number|null,calibrationGap:null as number|null,sampleInsufficient:true};
}

function emptyClass(){
  return {predicted:0,actual:0,correct:0,precision:null as number|null,recall:null as number|null};
}

function dailySlot(){
  return {scheduled:0,eligible:0,predicted:0,pass:0,miss:0,firstSeenAfterKickoff:0,gradedPredicted:0,correct:0,wrong:0,accuracy:null as number|null,pendingPredicted:0};
}

export function evaluateForwardCumulative(root:string,now=Date.now()){
  const includedRaw:IncludedFixture[]=[];
  const integrityExclusions:{fixtureId:number;reason:string}[]=[];
  const passIds:number[]=[];
  const missIds:number[]=[];
  const firstSeenIds:number[]=[];
  const pendingPredictedIds:number[]=[];
  const pendingPassIds:number[]=[];
  const daily=new Map<string,ReturnType<typeof dailySlot>>();
  const day=(iso:string|null)=>{
    const date=iso?utcDate(iso):'UNKNOWN';
    if(!daily.has(date))daily.set(date,dailySlot());
    return daily.get(date)!;
  };

  for(const fixtureId of collectFixtureIds(root)){
    const dir=join(root,'MODEL_FORWARD','fixtures',String(fixtureId));
    const missFile=join(dir,'miss.json');
    const lateFile=join(dir,'first-seen-after-kickoff.json');
    const invalidFile=join(dir,'invalid.json');
    const snapshotFile=join(dir,'snapshot.json');
    const gradeFile=join(root,'MODEL_FORWARD','postgame',fixtureId+'.json');
    try{
      if(existsSync(missFile)&&existsSync(lateFile))throw new Error('CONFLICTING_ABSENCE_STATES');
      if(existsSync(invalidFile))throw new Error('INVALID_PREGAME_FLAG');
      if(existsSync(missFile)){
        if(existsSync(snapshotFile))throw new Error('CONFLICTING_ABSENCE_STATES');
        const miss=readSealed(missFile).payload;
        missIds.push(fixtureId);
        day(miss.kickoffUtc).miss++;
        day(miss.kickoffUtc).scheduled++;
        continue;
      }
      if(existsSync(lateFile)){
        if(existsSync(snapshotFile))throw new Error('CONFLICTING_ABSENCE_STATES');
        const late=readSealed(lateFile).payload;
        firstSeenIds.push(fixtureId);
        day(late.kickoffUtc).firstSeenAfterKickoff++;
        day(late.kickoffUtc).scheduled++;
        continue;
      }
      if(!existsSync(snapshotFile)){
        if(existsSync(gradeFile))throw new Error('ORPHAN_OFFICIAL_GRADE');
        const ledger=join(root,'MODEL_FORWARD','schedule-ledger',String(fixtureId),'first.json');
        if(!existsSync(ledger))throw new Error('UNCLASSIFIED_FIXTURE');
        const f=scheduleState(root,fixtureId).latest.schedule;
        const slot=day(f.kickoffUtc);
        slot.scheduled++;
        if(f.providerStatus==='NS'&&Date.parse(f.kickoffUtc)-now>=60000)slot.eligible++;
        continue;
      }
      const snapshot=validatePregame(root,fixtureId);
      const p=snapshot.payload;
      if(p.status==='PREDICTED'&&!canonicalGradeAllowed(root,fixtureId,snapshot.sha256)){integrityExclusions.push({fixtureId,reason:'DUPLICATE_NONCANONICAL_EXCLUDED'});continue;}
      const receipt=readSealed(join(dir,'seal-receipt.json'));
      const slot=day(p.kickoffUtc);
      slot.scheduled++;
      slot.eligible++;
      if(p.status==='PASS'){
        passIds.push(fixtureId);
        slot.pass++;
        if(!existsSync(gradeFile)){pendingPassIds.push(fixtureId);continue;}
        validateGrade(root,fixtureId,now);
        continue;
      }
      assert.equal(p.status,'PREDICTED');
      const probs=assertProbabilitySanity(p.pHome,p.pDraw,p.pAway);
      const predictedClass=predictedClassFromProbabilities(probs.pHome,probs.pDraw,probs.pAway);
      assert.equal(p.predictedClass,predictedClass,'PREDICTED_CLASS_MISMATCH');
      slot.predicted++;
      if(!existsSync(gradeFile)){pendingPredictedIds.push(fixtureId);slot.pendingPredicted++;continue;}
      const grade=validateGrade(root,fixtureId,now);
      const g=grade.payload;
      assert.equal(g.correct1X2,p.predictedClass===g.actualClass);
      const maxP=maxProbability(probs.pHome,probs.pDraw,probs.pAway);
      const correct=g.correct1X2===true;
      includedRaw.push({
        fixtureId,
        kickoffUtc:p.kickoffUtc,
        utcDate:utcDate(p.kickoffUtc),
        predictedClass,
        actualClass:g.actualClass,
        correct,
        pHome:probs.pHome,
        pDraw:probs.pDraw,
        pAway:probs.pAway,
        maxProbability:maxP,
        bucket:probabilityBucket(maxP),
        snapshotHash:snapshot.sha256,
        receiptHash:receipt.sha256,
        gradeHash:grade.sha256,
        modelSourceHash:p.modelSourceHash,
        validPregame:true,
        sealedAt:receipt.payload.sealedAt,
        predictionCreatedAt:p.predictionCreatedAt,
        sealedAtBeforeKickoff:true,
        predictionCreatedAtBeforeKickoff:true,
        TARGET_RESULT_DATA_USED:false,
        ODDS_USED:false,
        MARKET_USED:false,
        PROVIDER_PREDICTION_USED:false,
      });
      slot.gradedPredicted++;
      if(correct)slot.correct++;else slot.wrong++;
    }catch(e){
      integrityExclusions.push({fixtureId,reason:String(e).replace(/^Error: /,'')});
    }
  }

  const included=uniqueByFixtureId(includedRaw).sort((a,b)=>a.kickoffUtc.localeCompare(b.kickoffUtc)||a.fixtureId-b.fixtureId);
  assert.equal(included.length,includedRaw.length,'DUPLICATE_GRADED_FIXTURE');

  const correct=included.filter(r=>r.correct).length;
  const wrong=included.length-correct;
  const classes={HOME:emptyClass(),DRAW:emptyClass(),AWAY:emptyClass()};
  for(const row of included){
    classes[row.predictedClass].predicted++;
    classes[row.actualClass].actual++;
    if(row.correct)classes[row.predictedClass].correct++;
  }
  for(const cls of CLASSES){
    classes[cls].precision=ratio(classes[cls].correct,classes[cls].predicted);
    classes[cls].recall=ratio(classes[cls].correct,classes[cls].actual);
  }

  const buckets=Object.fromEntries(BUCKET_IDS.map(id=>[id,emptyBucket(id)])) as Record<BucketId,ReturnType<typeof emptyBucket>>;
  for(const row of included){
    const b=buckets[row.bucket];
    b.sample++;
    if(row.correct)b.correct++;else b.wrong++;
    b.averageConfidence=((b.averageConfidence??0)*(b.sample-1)+row.maxProbability)/b.sample;
  }
  for(const id of BUCKET_IDS){
    const b=buckets[id];
    b.accuracy=ratio(b.correct,b.sample);
    b.observedAccuracy=b.accuracy;
    b.calibrationGap=b.observedAccuracy===null||b.averageConfidence===null?null:b.observedAccuracy-b.averageConfidence;
    b.sampleInsufficient=b.sample<CHECKPOINT_TARGET;
  }

  for(const slot of daily.values())slot.accuracy=ratio(slot.correct,slot.gradedPredicted);

  const currentN=included.length;
  const checkpointReached=currentN>=CHECKPOINT_TARGET;
  const interpretation=checkpointReached?'FIRST_OFFICIAL_EVALUATION_CHECKPOINT':'EARLY_DESCRIPTIVE_ONLY';
  const hypothesisObservations:{flag:string;HYPOTHESIS_ONLY:true;detail:string}[]=[];
  if(BUCKET_IDS.some(id=>buckets[id].sample>0&&buckets[id].sample<CHECKPOINT_TARGET)){
    hypothesisObservations.push({flag:'LOW_SAMPLE_BUCKET',HYPOTHESIS_ONLY:true,detail:'At least one probability bucket has 0 < sample < 25. Descriptive only; no threshold.'});
  }
  if(currentN>0&&classes.DRAW.predicted===0){
    hypothesisObservations.push({flag:'NO_DRAW_PREDICTIONS',HYPOTHESIS_ONLY:true,detail:'Included PREDICTED+GRADED cohort has zero DRAW predictions. Descriptive only.'});
  }
  const predictedCounts=CLASSES.map(cls=>classes[cls].predicted);
  const maxPredicted=Math.max(...predictedCounts);
  if(currentN>0&&maxPredicted/currentN>=0.7){
    hypothesisObservations.push({flag:'CLASS_IMBALANCE_OBSERVED',HYPOTHESIS_ONLY:true,detail:'One 1X2 class is at least 70% of included predictions. Descriptive only.'});
  }

  const payload={
    schemaVersion:SCHEMA_VERSION,
    FORWARD_MODEL,
    MODEL_HASH,
    SOURCE_OF_TRUTH,
    evaluatedAt:new Date(now).toISOString(),
    INTERPRETATION:interpretation,
    SAMPLE_INSUFFICIENT:currentN<CHECKPOINT_TARGET,
    ENGINE_CHANGE_ALLOWED:false,
    PREDICTION_REEXECUTED:false,
    V3_V31_CHANGED:false,
    ASTRA_UI_CHANGED:false,
    ODDS_USED:false,
    MARKET_USED:false,
    PROVIDER_PREDICTION_USED:false,
    TARGET_RESULT_DATA_USED:false,
    POSTGAME_DATA_USED_IN_PREDICTION:false,
    counts:{
      totalPredicted:included.length+pendingPredictedIds.length,
      totalGraded:currentN,
      pendingPredicted:pendingPredictedIds.length,
      correct,
      wrong,
      accuracy:ratio(correct,currentN),
      logLoss:multiclassLogLoss(included),
      brierScore:multiclassBrier(included),
      pass:passIds.length,
      pendingPass:pendingPassIds.length,
      miss:missIds.length,
      firstSeenAfterKickoff:firstSeenIds.length,
      integrityExclusions:integrityExclusions.length,
    },
    checkpoint:{
      checkpointTarget:CHECKPOINT_TARGET,
      currentN,
      remaining:Math.max(0,CHECKPOINT_TARGET-currentN),
      checkpointReached,
      ENGINE_CHANGE_ALLOWED:false,
      note:'N=25 is the first official evaluation point only. Reaching it does not authorize engine, weight, or threshold changes.',
    },
    classMetrics:classes,
    probabilityBuckets:buckets,
    dailyBreakdown:[...daily.entries()].filter(([date])=>date!=='UNKNOWN').sort(([a],[b])=>a.localeCompare(b)).map(([date,slot])=>({date,timezone:'UTC',...slot})),
    hypothesisObservations,
    included,
    operational:{
      passIds,
      pendingPredictedIds,
      pendingPassIds,
      missIds,
      firstSeenIds,
    },
    integrityExclusions,
    leakage:{
      TARGET_RESULT_DATA_USED:false,
      POSTGAME_DATA_USED_IN_PREDICTION:false,
      ODDS_USED:false,
      MARKET_USED:false,
      PROVIDER_PREDICTION_USED:false,
      snapshotHashImmutable:true,
      includedCohortIntegrityFailures:0,
    },
  };
  return envelope(payload);
}

export const DEFAULT_STORE=fileURLToPath(new URL('../data/cache/research/football/forward-shadow-v1/',import.meta.url));
export const DEFAULT_ARTIFACT=fileURLToPath(new URL('../data/audits/football-forward-cumulative-evaluation-v1.json',import.meta.url));

export function writeCumulativeEvaluationArtifact(evaluation:ReturnType<typeof evaluateForwardCumulative>,path=DEFAULT_ARTIFACT){
  mkdirSync(join(path,'..'),{recursive:true});
  writeFileSync(path,JSON.stringify(evaluation,null,2)+'\n');
  return path;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.equal(process.argv[2],'--run');
  assert.equal(process.argv.length,3);
  const evaluation=evaluateForwardCumulative(DEFAULT_STORE);
  const path=writeCumulativeEvaluationArtifact(evaluation);
  const p=evaluation.payload;
  console.log(JSON.stringify({
    artifact:path,
    sha256:evaluation.sha256,
    FORWARD_MODEL:p.FORWARD_MODEL,
    currentN:p.checkpoint.currentN,
    correct:p.counts.correct,
    wrong:p.counts.wrong,
    accuracy:p.counts.accuracy,
    logLoss:p.counts.logLoss,
    brierScore:p.counts.brierScore,
    pass:p.counts.pass,
    miss:p.counts.miss,
    pendingPredicted:p.counts.pendingPredicted,
    integrityExclusions:p.counts.integrityExclusions,
    checkpointReached:p.checkpoint.checkpointReached,
    INTERPRETATION:p.INTERPRETATION,
    ENGINE_CHANGE_ALLOWED:p.ENGINE_CHANGE_ALLOWED,
  },null,2));
}
