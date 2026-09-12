import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readSeal,requireRule} from '../football-v31-r1-prospective-v1/store-v1';
import type {Target} from '../football-v31-r1-prospective-v1/frozen/scripts/football-v3-feature-research-v1/contracts-v1';

export const FIRST_BATCH_AUDIT='data/audits/football-v31-r1-first-real-batch-v1.json';
export const FIRST_BATCH_AUDIT_SHA='f959518751631281723006d71d66516685fcc62896334ec477e2ca0b6fc29dcd';
export const SECOND_BATCH_AUDIT='data/audits/football-v31-r1-second-real-batch-seal-v1.json';
export const SECOND_BATCH_AUDIT_SHA='405145c492935fc9c789e17e37af3758d77db528ef6a62b034c07ea0fe7fd8d5';
export const SECOND_BATCH_IDS=[1575159,1570376,1557404,1550123] as const;
export const CURRENT_SEALED_R1_PREDICTED=19;

function repoPath(relative:string){return join(fileURLToPath(new URL('../../',import.meta.url)),relative);}

export type SealedExclusion={firstIds:number[];secondIds:number[];ids:Set<number>;r1Predicted:number};

export function loadSealedExclusion(firstFile=repoPath(FIRST_BATCH_AUDIT),secondFile=repoPath(SECOND_BATCH_AUDIT)):SealedExclusion{
 const first=readSeal<{outcomes:{status:string;r1Status?:string;target:Target}[]}>(firstFile);
 const second=readSeal<{outcomes:{status:string;r1Status?:string;fixtureId:number}[];R1_PREDICTED?:number}>(secondFile);
 requireRule(first.sha256===FIRST_BATCH_AUDIT_SHA,'BATCH_AUDIT_HASH_MISMATCH');
 requireRule(second.sha256===SECOND_BATCH_AUDIT_SHA,'BATCH_AUDIT_HASH_MISMATCH');
 const firstSealed=first.payload.outcomes.filter(o=>o.status==='SEALED');
 const secondSealed=second.payload.outcomes.filter(o=>o.status==='SEALED');
 requireRule(firstSealed.length===20,'FIRST_BATCH_SEALED_COUNT');
 requireRule(secondSealed.length===4,'SECOND_BATCH_SEALED_COUNT');
 const firstIds=firstSealed.map(o=>o.target.fixtureId);
 const secondIds=secondSealed.map(o=>o.fixtureId);
 requireRule(SECOND_BATCH_IDS.every(id=>secondIds.includes(id)),'SECOND_BATCH_ID_MISMATCH');
 requireRule(new Set([...firstIds,...secondIds]).size===24,'SEALED_ID_COLLISION');
 const r1Predicted=firstSealed.filter(o=>o.r1Status==='PREDICTED').length+secondSealed.filter(o=>o.r1Status==='PREDICTED').length;
 requireRule(r1Predicted===CURRENT_SEALED_R1_PREDICTED,'CURRENT_SEALED_R1_PREDICTED');
 return {firstIds,secondIds,ids:new Set([...firstIds,...secondIds]),r1Predicted};
}
