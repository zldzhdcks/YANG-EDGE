import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync,realpathSync} from 'node:fs';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {researchTargetScopeLockRel} from '../daily-scope-lock/paths';

/** Git paths are repository-relative even when an explicit batch supplies the data root. */
export function committedBytes(root:string,rel:string):Buffer {
  assert(!isAbsolute(rel)&&!rel.split(/[\\/]/).includes('..')&&!rel.includes(':'),'RELATIVE_EVIDENCE_PATH_REQUIRED');
  const args=['-c',`safe.directory=${root.replaceAll('\\','/')}`];
  const prefix=execFileSync('git',[...args,'rev-parse','--show-prefix'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  return execFileSync('git',[...args,'show',`HEAD:${prefix}${rel.replaceAll('\\','/')}`],{cwd:root,stdio:['ignore','pipe','pipe']});
}
export function assertDateSelection(root:string,date:string){
  const dir=join(root,'data/research/slate-batches');
  const batches=existsSync(dir)?readdirSync(dir,{withFileTypes:true}).filter(d=>d.isDirectory()&&existsSync(join(dir,d.name,researchTargetScopeLockRel(date)))):[];
  assert.equal(batches.length,0,'EXPLICIT_BATCH_REQUIRED: named scope exists; date-only selection forbidden');
}
export type BatchManifest={schemaVersion:'production-batch-selection-v1';round:number;batchId:string;dates:Record<string,{scopeSha256:string}>};
export function selectProductionBatch(root:string,date:string,batchId?:string){
  assert.match(date,/^\d{4}-\d{2}-\d{2}$/);
  if(!batchId){assertDateSelection(root,date);return {root,binding:null};}
  assert.match(batchId,/^[a-z0-9]+(?:-[a-z0-9]+)*$/,'INVALID_BATCH_ID');
  const base=resolve(root,'data/research/slate-batches'),selected=resolve(base,batchId);
  const within=relative(realpathSync(base),realpathSync(selected));
  assert(within&&!within.startsWith('..')&&!isAbsolute(within),'BATCH_PATH_ESCAPE');
  const rel='batch-manifest.json',bytes=readFileSync(join(selected,rel));
  assert(bytes.equals(committedBytes(selected,rel)),'BATCH_MANIFEST_NOT_COMMITTED');
  const m=JSON.parse(bytes.toString()) as BatchManifest;
  assert.equal(m.schemaVersion,'production-batch-selection-v1');assert.equal(m.batchId,batchId);assert(Number.isSafeInteger(m.round)&&m.round>0);
  assert(m.dates[date],'DATE_NOT_IN_BATCH');
  const lockRel=researchTargetScopeLockRel(date),lockBytes=readFileSync(join(selected,lockRel));
  const hash=createHash('sha256').update(lockBytes).digest('hex');assert.equal(hash,m.dates[date].scopeSha256,'BATCH_SCOPE_SHA_MISMATCH');
  const lock=JSON.parse(lockBytes.toString());assert.equal(lock.dateKst,date);
  return {root:selected,binding:{round:m.round,batchId,date,sourceFreezeId:`${batchId}/${lock.source.rel}`,scopeId:`${batchId}/${lockRel}`,scopeSha256:hash}};
}
