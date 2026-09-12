import {join} from 'node:path';
import {storeRoot,requireRule} from '../football-v31-r1-prospective-v1/store-v1';
import {ARTIFACT} from './grader-v1';
import {descriptor,type BatchId,type ArtifactLayout} from './registry-v1';

export type PregameArtifact={batchId:BatchId;fixtureId:number;layout:ArtifactLayout;dir:string;inputPath:string;snapshotPath:string;postgamePath:string};

/** Observed layout: both sealed batches store input.json and snapshot.json under the private namespace fixtures directory. */
export function resolvePregameArtifact(root:string,batchId:string,fixtureId:number):PregameArtifact{
 const desc=descriptor(batchId);
 requireRule(desc.artifactLayout==='NAMESPACE_FIXTURES_DIR','UNKNOWN_ARTIFACT_LAYOUT');
 const dir=join(storeRoot(root),'fixtures',String(fixtureId));
 return {batchId:desc.batchId,fixtureId,layout:desc.artifactLayout,dir,inputPath:join(dir,'input.json'),snapshotPath:join(dir,'snapshot.json'),postgamePath:join(dir,ARTIFACT)};
}

export function batchReceiptDir(root:string,batchId:string){return join(storeRoot(root),'batches',descriptor(batchId).batchId,'postgame-runs');}
