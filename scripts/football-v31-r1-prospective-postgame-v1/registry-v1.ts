import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readSeal,requireRule} from '../football-v31-r1-prospective-v1/store-v1';

export const FIRST_BATCH_ID='FIRST_REAL_ONE_SHOT_V1';
export const SECOND_BATCH_ID='SECOND_REAL_ONE_SHOT_V1';
export const LAYOUT_NAMESPACE_FIXTURES='NAMESPACE_FIXTURES_DIR';
export type BatchId=typeof FIRST_BATCH_ID|typeof SECOND_BATCH_ID;
export type ArtifactLayout=typeof LAYOUT_NAMESPACE_FIXTURES;
export type BatchDescriptor={batchId:BatchId;auditFile:string;auditSha256:string;artifactLayout:ArtifactLayout;targetCount:number};

export const BATCHES:Record<BatchId,BatchDescriptor>={
 [FIRST_BATCH_ID]:{batchId:FIRST_BATCH_ID,auditFile:'data/audits/football-v31-r1-first-real-batch-v1.json',auditSha256:'f959518751631281723006d71d66516685fcc62896334ec477e2ca0b6fc29dcd',artifactLayout:LAYOUT_NAMESPACE_FIXTURES,targetCount:20},
 [SECOND_BATCH_ID]:{batchId:SECOND_BATCH_ID,auditFile:'data/audits/football-v31-r1-second-real-batch-seal-v1.json',auditSha256:'405145c492935fc9c789e17e37af3758d77db528ef6a62b034c07ea0fe7fd8d5',artifactLayout:LAYOUT_NAMESPACE_FIXTURES,targetCount:4},
};

export function repoPath(relative:string){return join(fileURLToPath(new URL('../../',import.meta.url)),relative);}
export function descriptor(batchId:string){
 requireRule(batchId===FIRST_BATCH_ID||batchId===SECOND_BATCH_ID,'UNKNOWN_BATCH');
 return BATCHES[batchId];
}
export function bindBatchAudit(batchId:string,auditFile?:string){
 const desc=descriptor(batchId),file=auditFile??repoPath(desc.auditFile),seal=readSeal(file);
 requireRule(seal.sha256===desc.auditSha256,'BATCH_AUDIT_HASH_MISMATCH');
 return {desc,file,sha256:seal.sha256,payload:seal.payload};
}
