import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {resolve,relative,isAbsolute,dirname} from 'node:path';
import {envelope,sha,time,readEnvelope} from '../../research/terminal-decision/evidence';
import type {TargetIdentity} from './pregame-provenance';

export const DATASETS=['Schedule','Starter','Odds','Lineup'] as const;
export type Dataset=typeof DATASETS[number];
export type MlbManifestTarget=TargetIdentity & {gamePk:number;dateKst:string};
type Source={bytes:Buffer;sourceIdentity:string;sourceAsOf:string};
type Entry={artifactType:Dataset|'Summary';artifactPath:string;artifactSha256:string;schemaVersion:string;collectedAt:string;observedAt:string;asOf:string;sourceAsOf:string;sourceIdentity:string};
export type MlbSealedManifest={schemaVersion:'mlb-pregame-input-manifest-v1';target:MlbManifestTarget;scopeSha256:string;sealedAt:string;inputs:Entry[]};
function safePath(root:string,path:string){assert.ok(!isAbsolute(path));const full=resolve(root,path),rel=relative(resolve(root),full);assert.ok(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'ARTIFACT_PATH_ESCAPE');return full;}
function noOutcome(v:any){if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){assert.ok(!['actualScore','actualClass','result','finalScore','liveScore','homeScore','awayScore','postGameReview','actualStarterId','actualStarterName'].includes(k),'OUTCOME_FIELD_FORBIDDEN');noOutcome(x);}}
function schema(v:any){const s=v?.meta?.schemaVersion??v?.schemaVersion;assert.ok(typeof s==='string'&&s.length>0,'SCHEMA_REQUIRED');return s;}
function validateDocuments(docs:Record<string,any>,target:MlbManifestTarget,asOf:string){
  const schedule=docs.Schedule;assert.equal(schedule.games?.length,1,'SINGLE_TARGET_REQUIRED');const g=schedule.games[0];
  assert.equal(g.gamePk,target.gamePk);assert.equal(String(g.homeTeamId),target.homeTeamId);assert.equal(String(g.awayTeamId),target.awayTeamId);
  assert.equal(time(g.commenceTimeUtc),time(target.scheduledStart));
  assert.ok(['Scheduled','Pre-Game','Preview','SCHEDULED'].includes(g.statusDetailed??g.statusAbstract??g.status),'NOT_PREGAME');
  for(const kind of ['Starter','Lineup','Odds']){
    const rows=docs[kind].rows;assert.ok(Array.isArray(rows)&&rows.length>0);
    for(const row of rows){
      assert.equal(row.gamePk,target.gamePk,'ROW_TARGET_IDENTITY');if(row.eventId)assert.equal(row.eventId,`mlb-game-${target.gamePk}`);
      assert.equal(time(row.cutoffTime),time(target.scheduledStart));
      const observed=kind==='Starter'?row.statsAsOf:kind==='Lineup'?row.sourceTimestamp:row.capturedAt;
      assert.ok(time(observed)<=time(asOf)&&time(observed)<time(target.scheduledStart),'ROW_AS_OF_UNSAFE');
      if(kind!=='Odds'){assert.equal(String(row.teamId),row.side==='home'?target.homeTeamId:target.awayTeamId);assert.equal(String(row.opponentTeamId),row.side==='home'?target.awayTeamId:target.homeTeamId);}
      else {assert.equal(row.homeTeam,g.homeTeam);assert.equal(row.awayTeam,g.awayTeam);}
    }
    if(kind!=='Odds')assert.deepEqual(rows.map((r:any)=>r.side).sort(),['away','home'],'DIRECTED_BOTH_SIDES_REQUIRED');
    else assert.equal(rows.length,1,'AMBIGUOUS_ODDS_ROWS');
  }
  assert.equal(docs.Starter.summary?.targetGameIncludedInStats,0);assert.equal(docs.Starter.summary?.cutoffViolations,0);
  for(const d of Object.values(docs))noOutcome(d);
}

/** Collection adapter returns native pregame dataset bytes, not model features.
 * No existing-file timestamp inference. Every acquisition occurs inside this boundary.
 */
export async function collectMlbInputManifest(root:string,manifestPath:string,target:MlbManifestTarget,scopeSha256:string,acquire:(kind:Dataset)=>Promise<Source>){
  assert.match(scopeSha256,/^[a-f0-9]{64}$/);assert.ok(Number.isSafeInteger(target.gamePk)&&target.gamePk>0);assert.notEqual(target.homeTeamId,target.awayTeamId);
  assert.equal(target.dateKst,new Date(time(target.scheduledStart)+9*3600000).toISOString().slice(0,10),'TARGET_DATE_MISMATCH');
  assert.ok(time(new Date().toISOString())<time(target.scheduledStart));
  const inputs:Entry[]=[],docs:Record<string,any>={};const destination=safePath(root,manifestPath);mkdirSync(dirname(destination),{recursive:true});
  const put=(kind:Entry['artifactType'],bytes:Buffer,sourceIdentity:string,collectedAt:string,observedAt:string,sourceAsOf:string)=>{
    const d=JSON.parse(bytes.toString('utf8'));noOutcome(d);const artifactSha256=sha(bytes);
    const artifactPath=`${manifestPath}.inputs/${kind}-${artifactSha256}.json`;const path=safePath(root,artifactPath);mkdirSync(dirname(path),{recursive:true});
    writeFileSync(path,bytes,{flag:'wx'});
    inputs.push({artifactType:kind,artifactPath,artifactSha256,schemaVersion:schema(d),collectedAt,observedAt,asOf:observedAt,sourceAsOf,sourceIdentity});return d;
  };
  for(const kind of DATASETS){
    const collectedAt=new Date().toISOString();const s=await acquire(kind);const observedAt=new Date().toISOString();
    assert.ok(s.sourceIdentity.trim());assert.ok(time(collectedAt)<=time(observedAt)&&time(s.sourceAsOf)<=time(observedAt)&&time(observedAt)<time(target.scheduledStart),'AS_OF_UNSAFE');
    docs[kind]=put(kind,Buffer.from(s.bytes),s.sourceIdentity,collectedAt,observedAt,s.sourceAsOf);
  }
  validateDocuments(docs,target,new Date().toISOString());
  const asOf=new Date().toISOString();
  const summary={schemaVersion:'mlb-daily-research-summary-v1',dateKst:target.dateKst,generatedAt:asOf,researchReady:{percent:100,datasets:inputs.map(e=>({dataset:e.artifactType,status:'READY',artifact:e.artifactPath}))}};
  put('Summary',Buffer.from(JSON.stringify(summary)), 'LOCAL_COLLECTION_MANIFEST',asOf,asOf,asOf);
  const sealedAt=new Date().toISOString();assert.ok(time(sealedAt)<time(target.scheduledStart));
  for(const e of inputs)e.asOf=sealedAt; // availability cutoff, distinct from source statistical as-of.
  const e=envelope<MlbSealedManifest>({schemaVersion:'mlb-pregame-input-manifest-v1',target,scopeSha256,sealedAt,inputs});
  writeFileSync(destination,JSON.stringify(e,null,2)+'\n',{flag:'wx'});return e;
}

export function loadSealedMlbInput(root:string,path:string,expectedHash:string,target:MlbManifestTarget,scopeSha256:string){
  return inspectSealedMlbInputAt(root,path,expectedHash,target,scopeSha256,new Date().toISOString());
}

/** Receipt audit only. Prediction always uses loadSealedMlbInput's real clock. */
export function inspectSealedMlbInputAt(root:string,path:string,expectedHash:string,target:MlbManifestTarget,scopeSha256:string,executionAt:string){
  assert.equal(target.dateKst,new Date(time(target.scheduledStart)+9*3600000).toISOString().slice(0,10),'TARGET_DATE_MISMATCH');
  const e=readEnvelope(safePath(root,path));assert.equal(e.sha256,expectedHash,'MANIFEST_HASH_MISMATCH');const m=e.payload as MlbSealedManifest;
  assert.equal(m.schemaVersion,'mlb-pregame-input-manifest-v1');assert.deepEqual(m.target,target,'MANIFEST_TARGET_MISMATCH');assert.equal(m.scopeSha256,scopeSha256,'MANIFEST_SCOPE_MISMATCH');
  assert.deepEqual(m.inputs.map(i=>i.artifactType).sort(),[...DATASETS,'Summary'].sort(),'REQUIRED_INPUTS');
  assert.ok(time(m.sealedAt)<=time(executionAt)&&time(executionAt)<time(target.scheduledStart),'AS_OF_UNSAFE');
  const sources=new Map<string,string>();const docs:Record<string,any>={};
  for(const i of m.inputs){
    assert.ok(time(i.collectedAt)<=time(i.observedAt)&&time(i.observedAt)<=time(i.asOf)&&time(i.asOf)<=time(m.sealedAt)&&time(i.sourceAsOf)<=time(i.observedAt),'AS_OF_UNSAFE');
    const full=safePath(root,i.artifactPath);const real=realpathSync(full);assert.ok(!relative(realpathSync(root),real).startsWith('..'),'SYMLINK_ESCAPE');
    const bytes=readFileSync(full);assert.equal(sha(bytes),i.artifactSha256,'ARTIFACT_HASH_MISMATCH');const text=bytes.toString('utf8');const d=JSON.parse(text);assert.equal(schema(d),i.schemaVersion);sources.set(i.artifactPath,text);docs[i.artifactType]=d;
  }
  validateDocuments(docs,target,m.sealedAt);
  const summaryEntry=m.inputs.find(i=>i.artifactType==='Summary')!;
  const summaryRel=`data/research/mlb/${target.dateKst}-daily-research-summary-v1.json`;
  const entries=docs.Summary.researchReady?.datasets;assert.ok(Array.isArray(entries));
  for(const kind of DATASETS){const refs:any[]=entries.filter((x:any)=>x.dataset===kind);assert.equal(refs.length,1);assert.equal(refs[0].artifact,m.inputs.find(i=>i.artifactType===kind)!.artifactPath);}
  sources.set(summaryRel,sources.get(summaryEntry.artifactPath)!);
  return {manifest:m,hash:e.sha256,executionAt,readJson:async(rel:string)=>{assert.ok(sources.has(rel),'UNSEALED_INPUT_REQUEST');return JSON.parse(sources.get(rel)!);}};
}
