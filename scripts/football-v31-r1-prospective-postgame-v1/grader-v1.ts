/** Triple-envelope postgame grader. Result → Grade only. Never refits or mutates pregame files. */
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {storeRoot,readSeal,writeSeal,digest,requireRule} from '../football-v31-r1-prospective-v1/store-v1';
import {exactKeys,validProb,actual,CLASSES,type Target,type Prob} from '../football-v31-r1-prospective-v1/frozen/scripts/football-v3-feature-research-v1/contracts-v1';

export const SCHEMA='FOOTBALL_V31_R1_PROSPECTIVE_POSTGAME_V1';
export const ARTIFACT='postgame-v1.json';
export const LOG_LOSS_FLOOR=1e-15;
export const GRADEABLE_STATUS='FT';
export const FIRST_BATCH_AUDIT='data/audits/football-v31-r1-first-real-batch-v1.json';
export const FIRST_BATCH_AUDIT_SHA='f959518751631281723006d71d66516685fcc62896334ec477e2ca0b6fc29dcd';
export const PENDING_STATUSES=new Set(['NS','TBD','1H','HT','2H','ET','BT','P','SUSP','INT','LIVE']);
/** League 1X2 research and prospective observations accept FT only. AET/PEN are blocked, not remapped. */
export const BLOCKED_STATUSES=new Set(['AET','PEN','AWD','WO','PST','CANC','ABD']);

export type ExpectedSeal=Target & {cutoffAt:string;predictionCreatedAt:string;snapshotHash:string;v1PredictionHash:string;h2PredictionHash:string;r1PredictionHash:string;inputHash:string};
export type ProviderFixture={fixture:{id:number;date:string;status:{short:string}};league:{id:number;season:number};teams:{home:{id:number};away:{id:number}};score:{fulltime:{home:number|null;away:number|null}}};
export type ResultObservation={fixtureId:number;leagueId:number;season:number;kickoffUtc:string;homeTeamId:number;awayTeamId:number;fixtureStatus:string;regularTime:{home:number;away:number}|null;resultObservedAt:string;providerFetchedAt:string;sourceHash:string};
export type ModelGrade={status:'GRADED'|'PREGAME_PASS_PRESERVED';predictionStatus:'PREDICTED'|'PASS';predictedClass:string|null;actualClass:string;correct:boolean|null;probabilities:{HOME:number;DRAW:number;AWAY:number}|null;logLoss:number|null;multiclassBrier:number|null};
export type PostgamePayload={schemaVersion:typeof SCHEMA;fixture:Target;kickoffUtc:string;cutoffAt:string;predictionCreatedAt:string;result:{fixtureStatus:'FT';regularTime:{home:number;away:number};actualClass:string;sourceHash:string};resultObservedAt:string;providerFetchedAt:string;pregameSnapshotHash:string;v1PredictionHash:string;h2PredictionHash:string;r1PredictionHash:string;v1Grade:ModelGrade;h2Grade:ModelGrade;r1Grade:ModelGrade;artifactCreatedAt:string};
export type Outcome={fixtureId:number;status:'GRADED'|'RESULT_PENDING'|'RESULT_BLOCKED'|'ALREADY_GRADED_IMMUTABLE';reason?:string;artifactHash?:string};
type Hashed={payload:{targetIdentity:Target;cutoffAt:string;predictionCreatedAt:string;status:string;passReason:string[];probabilities:Prob|null;class:string|null};sha256:string};
type Envelope={targetIdentity:Target;cutoffAt:string;predictionCreatedAt:string;inputSnapshotHash:string;sameCutoffV1:Hashed;sameCutoffH2:Hashed;r1:Hashed;sealedAt:string};

export function artifactPath(root:string,fixtureId:number){return join(storeRoot(root),'fixtures',String(fixtureId),ARTIFACT);}
export function fixtureDir(root:string,fixtureId:number){return join(storeRoot(root),'fixtures',String(fixtureId));}

function targetOf(t:Target|ExpectedSeal|ResultObservation):Target{return {fixtureId:t.fixtureId,leagueId:t.leagueId,season:t.season,kickoffUtc:t.kickoffUtc,homeTeamId:t.homeTeamId,awayTeamId:t.awayTeamId};}
function sameTarget(a:Target|ExpectedSeal|ResultObservation,b:Target|ExpectedSeal|ResultObservation){return digest(targetOf(a))===digest(targetOf(b));}
function classOf(home:number,away:number){return CLASSES[actual(home,away)];}
function regularTime(ft:{home:number|null;away:number|null}|undefined):{home:number;away:number}|null{
 if(!ft)return null;const home=ft.home,away=ft.away;
 if(typeof home!=='number'||typeof away!=='number'||!Number.isSafeInteger(home)||!Number.isSafeInteger(away)||home<0||away<0||home>100||away>100)return null;
 return {home,away};
}
function metrics(p:Prob,actualClass:string):Pick<ModelGrade,'logLoss'|'multiclassBrier'|'probabilities'>{
 validProb(p);const y=CLASSES.indexOf(actualClass as typeof CLASSES[number]);requireRule(y>=0,'ACTUAL_CLASS');
 return {probabilities:{HOME:p[0],DRAW:p[1],AWAY:p[2]},logLoss:-Math.log(Math.max(p[y],LOG_LOSS_FLOOR)),multiclassBrier:p.reduce((s,pk,k)=>s+(pk-(k===y?1:0))**2,0)};
}
function modelGrade(row:Hashed,actualClass:string):ModelGrade{
 requireRule(digest(row.payload)===row.sha256,'PREDICTION_HASH_MISMATCH');
 if(row.payload.status==='PASS'){
  requireRule(row.payload.probabilities===null&&row.payload.class===null&&row.payload.passReason.length>0,'PASS_PRESERVATION');
  return {status:'PREGAME_PASS_PRESERVED',predictionStatus:'PASS',predictedClass:null,actualClass,correct:null,probabilities:null,logLoss:null,multiclassBrier:null};
 }
 requireRule(row.payload.status==='PREDICTED'&&row.payload.probabilities&&row.payload.class,'UNSEALABLE_STATUS');
 validProb(row.payload.probabilities);requireRule(row.payload.class===CLASSES[row.payload.probabilities.indexOf(Math.max(...row.payload.probabilities))],'CLASS');
 const m=metrics(row.payload.probabilities,actualClass);
 return {status:'GRADED',predictionStatus:'PREDICTED',predictedClass:row.payload.class,actualClass,correct:row.payload.class===actualClass,...m};
}

export function loadSealedTargets(auditFile:string,expectedSha=FIRST_BATCH_AUDIT_SHA):ExpectedSeal[]{
 const audit=readSeal<{outcomes:{status:string;target:Target;cutoffAt?:string;predictionCreatedAt?:string;bundleHash?:string;individualHashes?:{v1:string;h2:string;r1:string};inputHash?:string}[]}>(auditFile);
 requireRule(audit.sha256===expectedSha,'BATCH_AUDIT_HASH');
 const rows=audit.payload.outcomes.filter(o=>o.status==='SEALED');
 requireRule(rows.length===20,'SEALED_TARGET_COUNT');
 return rows.map(o=>{
  requireRule(o.cutoffAt&&o.predictionCreatedAt&&o.bundleHash&&o.individualHashes&&o.inputHash,'SEALED_METADATA');
  return {...o.target,cutoffAt:o.cutoffAt,predictionCreatedAt:o.predictionCreatedAt,snapshotHash:o.bundleHash,v1PredictionHash:o.individualHashes.v1,h2PredictionHash:o.individualHashes.h2,r1PredictionHash:o.individualHashes.r1,inputHash:o.inputHash};
 });
}

export function readEnvelope(root:string,expected:ExpectedSeal){
 const dir=fixtureDir(root,expected.fixtureId),snap=readSeal<Envelope>(join(dir,'snapshot.json')),input=readSeal<unknown>(join(dir,'input.json'));
 requireRule(snap.sha256===expected.snapshotHash,'SNAPSHOT_HASH_MISMATCH');
 requireRule(input.sha256===expected.inputHash&&input.sha256===snap.payload.inputSnapshotHash,'SNAPSHOT_HASH_MISMATCH');
 const s=snap.payload;
 requireRule(sameTarget(s.targetIdentity,expected),'TARGET_IDENTITY_MISMATCH');
 requireRule(s.cutoffAt===expected.cutoffAt&&s.predictionCreatedAt===expected.predictionCreatedAt,'TARGET_IDENTITY_MISMATCH');
 requireRule(s.targetIdentity.kickoffUtc===expected.kickoffUtc,'TARGET_IDENTITY_MISMATCH');
 for(const [row,hash] of [[s.sameCutoffV1,expected.v1PredictionHash],[s.sameCutoffH2,expected.h2PredictionHash],[s.r1,expected.r1PredictionHash]] as const){
  requireRule(row.sha256===hash&&digest(row.payload)===hash,'PREDICTION_HASH_MISMATCH');
  requireRule(sameTarget(row.payload.targetIdentity,expected)&&row.payload.cutoffAt===expected.cutoffAt&&row.payload.predictionCreatedAt===expected.predictionCreatedAt,'TARGET_IDENTITY_MISMATCH');
 }
 return snap;
}

export function projectResult(raw:unknown,expected:ExpectedSeal,resultObservedAt:string,providerFetchedAt:string,sourceHash:string):{status:'AVAILABLE'|'RESULT_PENDING'|'RESULT_BLOCKED';reason?:string;result?:ResultObservation}{
 requireRule(/^[a-f0-9]{64}$/.test(sourceHash),'GRADE_PROVENANCE');
 requireRule(Number.isFinite(Date.parse(resultObservedAt))&&Number.isFinite(Date.parse(providerFetchedAt)),'RESULT_TIME');
 requireRule(Date.parse(resultObservedAt)>=Date.parse(providerFetchedAt),'RESULT_TIME');
 const body=raw as {errors?:object;results?:number;response?:ProviderFixture[]};
 if(!body||Object.keys(body.errors??{}).length!==0||body.results!==1||!Array.isArray(body.response)||body.response.length!==1)return {status:'RESULT_BLOCKED',reason:'RESULT_IDENTITY_UNCERTAIN'};
 const r=body.response[0];
 const identity={fixtureId:r.fixture.id,leagueId:r.league.id,season:r.league.season,kickoffUtc:new Date(r.fixture.date).toISOString(),homeTeamId:r.teams.home.id,awayTeamId:r.teams.away.id};
 if(!sameTarget(identity,expected)||identity.kickoffUtc!==expected.kickoffUtc)return {status:'RESULT_BLOCKED',reason:'RESULT_IDENTITY_UNCERTAIN'};
 const status=r.fixture.status.short;
 const result:ResultObservation={...identity,fixtureStatus:status,regularTime:regularTime(r.score?.fulltime),resultObservedAt,providerFetchedAt,sourceHash};
 if(PENDING_STATUSES.has(status)||status===GRADEABLE_STATUS&&!result.regularTime)return {status:'RESULT_PENDING',reason:status===GRADEABLE_STATUS?'RESULT_SCORE_UNAVAILABLE':status,result};
 if(status!==GRADEABLE_STATUS||!result.regularTime)return {status:'RESULT_BLOCKED',reason:BLOCKED_STATUSES.has(status)?'RESULT_STATUS_NOT_FT':status||'RESULT_IDENTITY_UNCERTAIN',result};
 return {status:'AVAILABLE',result};
}

export function gradeFixture(root:string,expected:ExpectedSeal,result:ResultObservation,clock=()=>Date.now()):Outcome{
 const now=clock(),file=artifactPath(root,expected.fixtureId);
 if(existsSync(file)){
  const existing=readSeal<PostgamePayload>(file);exactKeys(existing.payload,['schemaVersion','fixture','kickoffUtc','cutoffAt','predictionCreatedAt','result','resultObservedAt','providerFetchedAt','pregameSnapshotHash','v1PredictionHash','h2PredictionHash','r1PredictionHash','v1Grade','h2Grade','r1Grade','artifactCreatedAt']);
  requireRule(existing.payload.pregameSnapshotHash===expected.snapshotHash&&existing.payload.v1PredictionHash===expected.v1PredictionHash&&existing.payload.h2PredictionHash===expected.h2PredictionHash&&existing.payload.r1PredictionHash===expected.r1PredictionHash,'PREDICTION_HASH_MISMATCH');
  return {fixtureId:expected.fixtureId,status:'ALREADY_GRADED_IMMUTABLE',artifactHash:existing.sha256};
 }
 const snap=readEnvelope(root,expected);
 if(!sameTarget(result,expected))return {fixtureId:expected.fixtureId,status:'RESULT_BLOCKED',reason:'RESULT_IDENTITY_UNCERTAIN'};
 if(PENDING_STATUSES.has(result.fixtureStatus)||result.fixtureStatus===GRADEABLE_STATUS&&!result.regularTime)return {fixtureId:expected.fixtureId,status:'RESULT_PENDING',reason:result.fixtureStatus===GRADEABLE_STATUS?'RESULT_SCORE_UNAVAILABLE':result.fixtureStatus};
 if(result.fixtureStatus!==GRADEABLE_STATUS||!result.regularTime)return {fixtureId:expected.fixtureId,status:'RESULT_BLOCKED',reason:BLOCKED_STATUSES.has(result.fixtureStatus)?'RESULT_STATUS_NOT_FT':'RESULT_IDENTITY_UNCERTAIN'};
 requireRule(Date.parse(result.providerFetchedAt)>Date.parse(expected.kickoffUtc)&&Date.parse(result.providerFetchedAt)>Date.parse(snap.payload.sealedAt),'POSTGAME_ONLY');
 requireRule(Date.parse(result.resultObservedAt)>=Date.parse(result.providerFetchedAt)&&Date.parse(result.resultObservedAt)<=now+1000,'RESULT_TIME');
 requireRule(/^[a-f0-9]{64}$/.test(result.sourceHash),'GRADE_PROVENANCE');
 const actualClass=classOf(result.regularTime.home,result.regularTime.away);
 const artifactCreatedAt=new Date(now).toISOString();
 const payload:PostgamePayload={schemaVersion:SCHEMA,fixture:{fixtureId:expected.fixtureId,leagueId:expected.leagueId,season:expected.season,kickoffUtc:expected.kickoffUtc,homeTeamId:expected.homeTeamId,awayTeamId:expected.awayTeamId},kickoffUtc:expected.kickoffUtc,cutoffAt:expected.cutoffAt,predictionCreatedAt:expected.predictionCreatedAt,result:{fixtureStatus:'FT',regularTime:{home:result.regularTime.home,away:result.regularTime.away},actualClass,sourceHash:result.sourceHash},resultObservedAt:result.resultObservedAt,providerFetchedAt:result.providerFetchedAt,pregameSnapshotHash:expected.snapshotHash,v1PredictionHash:expected.v1PredictionHash,h2PredictionHash:expected.h2PredictionHash,r1PredictionHash:expected.r1PredictionHash,v1Grade:modelGrade(snap.payload.sameCutoffV1,actualClass),h2Grade:modelGrade(snap.payload.sameCutoffH2,actualClass),r1Grade:modelGrade(snap.payload.r1,actualClass),artifactCreatedAt};
 exactKeys(payload,['schemaVersion','fixture','kickoffUtc','cutoffAt','predictionCreatedAt','result','resultObservedAt','providerFetchedAt','pregameSnapshotHash','v1PredictionHash','h2PredictionHash','r1PredictionHash','v1Grade','h2Grade','r1Grade','artifactCreatedAt']);
 const saved=writeSeal(file,payload);
 return {fixtureId:expected.fixtureId,status:'GRADED',artifactHash:saved.sha256};
}

export type Scorecard={
 TOTAL_SEALED:number;RESULT_AVAILABLE:number;RESULT_PENDING:number;RESULT_BLOCKED:number;
 R1_PREDICTED_GRADED:number;R1_PASS_PRESERVED:number;V1_PREDICTED_GRADED:number;H2_PREDICTED_GRADED:number;
 interpretation:'EARLY_DESCRIPTIVE_ONLY';MODEL_PROMOTED:'NO';checkpoint:{next:number;R1_PREDICTED_GRADED:number};
 descriptive:{r1?:{n:number;accuracy:number;meanLogLoss:number;meanMulticlassBrier:number};v1?:{n:number;accuracy:number;meanLogLoss:number;meanMulticlassBrier:number};h2?:{n:number;accuracy:number;meanLogLoss:number;meanMulticlassBrier:number}};
};

function predictedSummary(grades:ModelGrade[]){const rows=grades.filter(g=>g.status==='GRADED');if(!rows.length)return undefined;return {n:rows.length,accuracy:rows.filter(g=>g.correct).length/rows.length,meanLogLoss:rows.reduce((s,g)=>s+(g.logLoss??0),0)/rows.length,meanMulticlassBrier:rows.reduce((s,g)=>s+(g.multiclassBrier??0),0)/rows.length};}

export function scorecard(root:string,expected:ExpectedSeal[],outcomes:Outcome[]):Scorecard{
 const artifacts=expected.map(e=>existsSync(artifactPath(root,e.fixtureId))?readSeal<PostgamePayload>(artifactPath(root,e.fixtureId)).payload:null);
 const available=outcomes.filter(o=>o.status==='GRADED'||o.status==='ALREADY_GRADED_IMMUTABLE').length;
 const pending=outcomes.filter(o=>o.status==='RESULT_PENDING').length;
 const blocked=outcomes.filter(o=>o.status==='RESULT_BLOCKED').length;
 requireRule(available+pending+blocked===expected.length,'SCORECARD_COVERAGE');
 const grades=artifacts.filter((a):a is PostgamePayload=>a!==null);
 const r1p=grades.map(a=>a.r1Grade);
 return {
  TOTAL_SEALED:expected.length,RESULT_AVAILABLE:available,RESULT_PENDING:pending,RESULT_BLOCKED:blocked,
  R1_PREDICTED_GRADED:r1p.filter(g=>g.status==='GRADED').length,R1_PASS_PRESERVED:r1p.filter(g=>g.status==='PREGAME_PASS_PRESERVED').length,
  V1_PREDICTED_GRADED:grades.filter(a=>a.v1Grade.status==='GRADED').length,H2_PREDICTED_GRADED:grades.filter(a=>a.h2Grade.status==='GRADED').length,
  interpretation:'EARLY_DESCRIPTIVE_ONLY',MODEL_PROMOTED:'NO',checkpoint:{next:25,R1_PREDICTED_GRADED:r1p.filter(g=>g.status==='GRADED').length},
  descriptive:{r1:predictedSummary(r1p),v1:predictedSummary(grades.map(a=>a.v1Grade)),h2:predictedSummary(grades.map(a=>a.h2Grade))}
 };
}
