/** Pregame only. No provider/network client, result reader or owner/external input path. */
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,openSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
import {join} from 'node:path';
import {predictFootball,POLICY} from '../src/lib/football/poisson-research-v1/index';
import {observeSchedule,scheduleState} from './football-forward-schedule-ledger-v1';
export const MODEL_HASH='6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf';
export const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
export function canonical(v:unknown):string {if(Array.isArray(v))return `[${v.map(canonical).join(',')}]`;if(v!==null&&typeof v==='object'){const o=v as Record<string,unknown>;return `{${Object.keys(o).sort().map(k=>`${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;}return JSON.stringify(v);}
export type Fixture={fixtureId:number;kickoffUtc:string;leagueId:number;season:number;homeTeam:{id:number;name:string};awayTeam:{id:number;name:string};providerStatus:string;scheduleFetchedAt:string};
export type Completed={providerFixtureId:number;kickoffUtc:string;leagueId:number;homeTeamId:number;awayTeamId:number;fixtureStatus:'FT';fullTimeHomeGoals:number;fullTimeAwayGoals:number;providerFetchedAt:string;sourceHash:string};
const keys=['fixtureId','kickoffUtc','leagueId','season','homeTeam','awayTeam','providerStatus','scheduleFetchedAt'];
export function validateFixture(f:Fixture){
  assert.deepEqual(Object.keys(f).sort(),[...keys].sort(),'NON_SCHEDULE_FIELDS_FORBIDDEN');
  assert.ok([39,140,135,78].includes(f.leagueId));assert.ok(Number.isSafeInteger(f.fixtureId)&&f.fixtureId>0);assert.ok(Number.isSafeInteger(f.season));
  assert.equal(new Date(f.kickoffUtc).toISOString(),f.kickoffUtc);assert.equal(new Date(f.scheduleFetchedAt).toISOString(),f.scheduleFetchedAt);
  for(const t of [f.homeTeam,f.awayTeam]){assert.deepEqual(Object.keys(t).sort(),['id','name']);assert.ok(Number.isSafeInteger(t.id)&&t.id>0&&typeof t.name==='string'&&t.name.trim());}assert.notEqual(f.homeTeam.id,f.awayTeam.id);
}
export function writeOnce(file:string,text:string){const fd=openSync(file,'wx');try{writeFileSync(fd,text,'utf8');fsyncSync(fd);}finally{closeSync(fd);}}
export function envelope<T>(payload:T){return {payload,sha256:sha(canonical(payload))};}
export function readSealed(file:string){const e=JSON.parse(readFileSync(file,'utf8'));assert.equal(e.sha256,sha(canonical(e.payload)),'TAMPERED_SNAPSHOT');return e;}
export const LAYERS={MODEL_FORWARD:'MODEL_FORWARD',OWNER_MANUAL_SHADOW:'OWNER_MANUAL_SHADOW',EXTERNAL_ANALYSIS_SHADOW:'EXTERNAL_ANALYSIS_SHADOW'} as const;
export function markMiss(root:string,f:Fixture,now:number){
  assert.ok(now>=Date.parse(f.kickoffUtc),'NOT_STARTED');const dir=join(root,LAYERS.MODEL_FORWARD,'fixtures',String(f.fixtureId));mkdirSync(dir,{recursive:true});
  const file=join(dir,'miss.json');if(existsSync(file))return readSealed(file);
  assert.ok(!(existsSync(join(dir,'snapshot.json'))&&existsSync(join(dir,'seal-receipt.json'))&&!existsSync(join(dir,'invalid.json'))),'SEALED_FIXTURE_NOT_MISS');
  if(!existsSync(join(root,LAYERS.MODEL_FORWARD,'schedule-ledger',String(f.fixtureId),'first.json')))observeSchedule(root,f,sha(canonical(f)),now);
  const first=scheduleState(root,f.fixtureId).first;
  assert.ok(Date.parse(first.firstObservedAt)<Date.parse(f.kickoffUtc),'FIRST_SEEN_AFTER_KICKOFF_NOT_MISS');
  const value=envelope({fixtureId:f.fixtureId,leagueId:f.leagueId,kickoffUtc:f.kickoffUtc,status:'MISSED_PREGAME_SNAPSHOT',scheduleFirstObservedAt:first.firstObservedAt,firstSourceHash:first.firstSourceHash,recordedAt:new Date(now).toISOString(),backfillAllowed:false});writeOnce(file,JSON.stringify(value,null,2)+'\n');return value;
}
export function recordAbsence(root:string,f:Fixture,now:number){
  assert.ok(now>=Date.parse(f.kickoffUtc),'NOT_STARTED');
  const first=observeSchedule(root,f,sha(canonical(f)),now);
  const dir=join(root,LAYERS.MODEL_FORWARD,'fixtures',String(f.fixtureId));mkdirSync(dir,{recursive:true});
  const late=join(dir,'first-seen-after-kickoff.json');
  if(existsSync(late))return {kind:'FIRST_SEEN_AFTER_KICKOFF' as const,envelope:readSealed(late)};
  if(Date.parse(first.firstObservedAt)<Date.parse(f.kickoffUtc))return {kind:'MISSED' as const,envelope:markMiss(root,f,now)};
  const value=envelope({fixtureId:f.fixtureId,leagueId:f.leagueId,kickoffUtc:f.kickoffUtc,firstObservedAt:first.firstObservedAt,status:'FIRST_SEEN_AFTER_KICKOFF',recordedAt:new Date(now).toISOString(),MISS:false,BACKFILL:false,PREDICTION:false});
  writeOnce(late,JSON.stringify(value,null,2)+'\n');return {kind:'FIRST_SEEN_AFTER_KICKOFF' as const,envelope:value};
}
export function freeze(root:string,f:Fixture,clock=()=>Date.now(),observations:Completed[]=[]){
  validateFixture(f);const dir=join(root,LAYERS.MODEL_FORWARD,'fixtures',String(f.fixtureId));mkdirSync(dir,{recursive:true});
  const file=join(dir,'snapshot.json'),miss=join(dir,'miss.json');
  if(existsSync(miss))return {kind:'MISSED' as const,envelope:readSealed(miss)};
  if(existsSync(join(dir,'first-seen-after-kickoff.json')))return {kind:'FIRST_SEEN_AFTER_KICKOFF' as const,envelope:readSealed(join(dir,'first-seen-after-kickoff.json'))};
  if(existsSync(file)){
    const existing=readSealed(file);assert.equal(existing.payload.leagueId,f.leagueId,'FIXTURE_IDENTITY_CONFLICT');
    assert.equal(existing.payload.homeTeam.id,f.homeTeam.id,'FIXTURE_IDENTITY_CONFLICT');assert.equal(existing.payload.awayTeam.id,f.awayTeam.id,'FIXTURE_IDENTITY_CONFLICT');
    const receipt=join(dir,'seal-receipt.json');
    if(!existsSync(receipt)){if(clock()>=Date.parse(f.kickoffUtc))return recordAbsence(root,f,clock());throw Error('INCOMPLETE_SEAL_REQUIRES_REVIEW');}
    const sealed=readSealed(receipt).payload;assert.equal(sealed.snapshotHash,existing.sha256);assert.equal(sealed.validPregame,true);assert.ok(Date.parse(sealed.sealedAt)<Date.parse(existing.payload.kickoffUtc));
    assert.equal(readSealed(join(dir,'input.json')).sha256,existing.payload.inputSnapshotHash);return {kind:'EXISTING' as const,envelope:existing};
  }
  const now=clock(),kickoff=Date.parse(f.kickoffUtc);
  observeSchedule(root,f,sha(canonical(f)),now);
  if(['PST','CANC','TBD'].includes(f.providerStatus))return {kind:'NOT_ELIGIBLE' as const,envelope:null};
  if(now>=kickoff)return recordAbsence(root,f,now);
  assert.ok(Date.parse(f.scheduleFetchedAt)<=now,'FUTURE_SCHEDULE_OBSERVATION');
  if(f.providerStatus!=='NS'||kickoff-now<60000)return {kind:'NOT_ELIGIBLE' as const,envelope:null};
  const cutoffAt=new Date(now).toISOString();
  const completed=observations.filter(r=>{
    assert.notEqual(r.providerFixtureId,f.fixtureId,'TARGET_RESULT_FORBIDDEN');
    return r.leagueId===f.leagueId&&r.fixtureStatus==='FT'&&Date.parse(r.kickoffUtc)<now&&Date.parse(r.kickoffUtc)>=now-365*86400000&&Date.parse(r.providerFetchedAt)<now;
  }).sort((a,b)=>a.providerFixtureId-b.providerFixtureId);
  const ids=new Set<number>();for(const r of completed){
    assert.deepEqual(Object.keys(r).sort(),['providerFixtureId','kickoffUtc','leagueId','homeTeamId','awayTeamId','fixtureStatus','fullTimeHomeGoals','fullTimeAwayGoals','providerFetchedAt','sourceHash'].sort(),'NON_HISTORY_FIELDS_FORBIDDEN');
    for(const id of [r.providerFixtureId,r.homeTeamId,r.awayTeamId])assert.ok(Number.isSafeInteger(id)&&id>0,'INVALID_HISTORY_IDENTITY');
    assert.ok(!ids.has(r.providerFixtureId),'DUPLICATE_HISTORY');ids.add(r.providerFixtureId);assert.ok(Date.parse(r.providerFetchedAt)>Date.parse(r.kickoffUtc),'INVALID_COMPLETION_OBSERVATION');assert.ok(/^[a-f0-9]{64}$/.test(r.sourceHash));
  }
  const modelInput={target:{matchId:`API_FOOTBALL:${f.fixtureId}`,competitionId:String(f.leagueId),homeTeamId:String(f.homeTeam.id),awayTeamId:String(f.awayTeam.id),kickoffAt:f.kickoffUtc},cutoffAt,
    history:completed.map(r=>({matchId:`API_FOOTBALL:${r.providerFixtureId}`,competitionId:String(r.leagueId),homeTeamId:String(r.homeTeamId),awayTeamId:String(r.awayTeamId),kickoffAt:r.kickoffUtc,resultObservedAt:r.providerFetchedAt,regulationHomeGoals:r.fullTimeHomeGoals,regulationAwayGoals:r.fullTimeAwayGoals}))};
  const input={target:modelInput.target,targetScheduleObservation:f,cutoffAt,completedHistory:completed};
  const result=predictFootball(modelInput),created=clock();assert.ok(created<kickoff,'KICKOFF_PASSED_DURING_PREDICTION');
  const inputSnapshot=envelope(input),inputFile=join(dir,'input.json');
  if(existsSync(inputFile))assert.equal(readSealed(inputFile).sha256,inputSnapshot.sha256,'UNFINISHED_ATTEMPT_REQUIRES_REVIEW');else writeOnce(inputFile,JSON.stringify(inputSnapshot,null,2)+'\n');
  const payload={layer:LAYERS.MODEL_FORWARD,fixtureId:f.fixtureId,kickoffUtc:f.kickoffUtc,leagueId:f.leagueId,season:f.season,homeTeam:f.homeTeam,awayTeam:f.awayTeam,
    predictionCreatedAt:new Date(created).toISOString(),cutoffAt,trainingFixtureIds:result.evidence.sourceMatchIds,trainingMatchCount:result.evidence.competitionMatches,
    homeRelevantSampleCount:result.evidence.homeVenueMatches,awayRelevantSampleCount:result.evidence.awayVenueMatches,
    status:result.status==='RESEARCH_PREDICTED'?'PREDICTED':'PASS',passReason:result.reasons,pHome:result.probabilities?.home??null,pDraw:result.probabilities?.draw??null,pAway:result.probabilities?.away??null,
    predictedClass:result.probabilities?(['HOME','DRAW','AWAY'] as const)[[result.probabilities.home,result.probabilities.draw,result.probabilities.away].indexOf(Math.max(result.probabilities.home,result.probabilities.draw,result.probabilities.away))]:null,
    modelVersion:POLICY.version,modelSourceHash:MODEL_HASH,inputSnapshotHash:inputSnapshot.sha256,revision:1,revisionReason:'INITIAL',previousHash:null,
    TARGET_RESULT_DATA_USED:false,PAST_COMPLETED_RESULT_DATA_USED:completed.length>0,ODDS_USED:false,MARKET_USED:false,PROVIDER_PREDICTION_USED:false,OWNER_SHADOW_USED:false,EXTERNAL_SHADOW_USED:false,historyPolicy:'ACTUALLY_OBSERVED_PAST_FT_SAME_LEAGUE_365D',trainingProviderFixtureIds:completed.map(r=>r.providerFixtureId)};
  const sealed=envelope(payload);assert.ok(clock()<kickoff,'KICKOFF_PASSED_BEFORE_SEAL');
  writeOnce(file,JSON.stringify(sealed,null,2)+'\n');
  const sealedAt=clock();
  if(sealedAt>=kickoff){const invalid=envelope({fixtureId:f.fixtureId,snapshotHash:sealed.sha256,reason:'LATE_SEAL_INVALID',recordedAt:new Date(sealedAt).toISOString()});writeOnce(join(dir,'invalid.json'),JSON.stringify(invalid,null,2)+'\n');return {kind:'MISSED' as const,envelope:markMiss(root,f,sealedAt)};}
  writeOnce(join(dir,'seal-receipt.json'),JSON.stringify(envelope({fixtureId:f.fixtureId,snapshotHash:sealed.sha256,sealedAt:new Date(sealedAt).toISOString(),validPregame:true}),null,2)+'\n');
  return {kind:'SEALED' as const,envelope:sealed};
}
export function auditCoverage(root:string,fixtures:Fixture[],now=Date.now(),providerCoverageComplete=true){
  const dates=[...new Set([new Date(now).toISOString().slice(0,10),...fixtures.map(f=>f.kickoffUtc.slice(0,10))])].sort();const audits=[];
  for(const date of dates){const rows=fixtures.filter(f=>f.kickoffUtc.startsWith(date));let predicted=0,pass=0,missed=0,eligible=0,firstSeenAfterKickoff=0;
    for(const f of rows){const dir=join(root,LAYERS.MODEL_FORWARD,'fixtures',String(f.fixtureId));
      if(existsSync(join(dir,'miss.json'))){readSealed(join(dir,'miss.json'));missed++;continue;}
      if(existsSync(join(dir,'first-seen-after-kickoff.json'))){readSealed(join(dir,'first-seen-after-kickoff.json'));firstSeenAfterKickoff++;continue;}
      if(existsSync(join(dir,'snapshot.json'))&&existsSync(join(dir,'seal-receipt.json'))){const s=readSealed(join(dir,'snapshot.json')),r=readSealed(join(dir,'seal-receipt.json'));assert.equal(s.sha256,r.payload.snapshotHash);assert.equal(readSealed(join(dir,'input.json')).sha256,s.payload.inputSnapshotHash);assert.ok(Date.parse(r.payload.sealedAt)<Date.parse(s.payload.kickoffUtc));if(s.payload.status==='PREDICTED')predicted++;else pass++;eligible++;}
      else if(!['PST','CANC','TBD'].includes(f.providerStatus)&&Date.parse(f.kickoffUtc)<=now){const absent=recordAbsence(root,f,now);if(absent.kind==='MISSED')missed++;else firstSeenAfterKickoff++;}else if(f.providerStatus==='NS'&&Date.parse(f.kickoffUtc)-now>=60000)eligible++;
    }
    const a=envelope({date,timezone:'UTC',observedAt:new Date(now).toISOString(),scheduledFixtures:providerCoverageComplete?rows.length:null,observedScheduledFixtures:rows.length,eligibleFixtures:eligible,predicted,pass,missed,firstSeenAfterKickoff,providerCoverageComplete,coverageScope:'Observed provider schedule only; provider failure is not zero fixtures'});
    const dir=join(root,LAYERS.MODEL_FORWARD,'coverage',date);mkdirSync(dir,{recursive:true});writeOnce(join(dir,`${now}-${randomUUID()}.json`),JSON.stringify(a,null,2)+'\n');audits.push(a);
  }return audits;
}
