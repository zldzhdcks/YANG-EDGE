import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {readEnvelope,sha,canonical,time} from './evidence';
export type BatchInputProof={inputSnapshotId:string;inputSha256:string;targetId:string;batchId:string;scopeId:string;scopeSha256:string;observedAt:string;collectedAt:string;asOf:string;predictionCutoff:string;scheduledStart:string};
/** No network. Bind the entire selected artifact pair and authority, not a loose timestamp claim. */
export function validateBatchInputProof(root:string,b:{batchId:string;scopeId:string;scopeSha256:string},targetId:string,start:string,p:BatchInputProof|undefined,inputs:{fixtureEvidencePath:string;fixtureEvidenceHash:string;historyPath:string;historyHash:string}){
 assert(p,'INPUT_PROVENANCE_BLOCKED');
 for(const k of ['batchId','scopeId','scopeSha256'] as const)assert.equal(p[k],b[k],'WRONG_BATCH_INPUT');
 assert.equal(p.targetId,targetId);assert.equal(time(p.scheduledStart),time(start));
 const fixture=readEnvelope(resolve(root,inputs.fixtureEvidencePath)),history=readEnvelope(resolve(root,inputs.historyPath));
 assert.equal(fixture.sha256,inputs.fixtureEvidenceHash);assert.equal(history.sha256,inputs.historyHash);
 assert.equal(p.inputSnapshotId,`${b.scopeSha256}:${targetId}`);
 assert.equal(p.inputSha256,sha(canonical({fixtureHash:fixture.sha256,historyHash:history.sha256,targetId,batchId:b.batchId,scopeId:b.scopeId,scopeSha256:b.scopeSha256})));
 assert.equal(time(p.observedAt),Math.max(time(fixture.payload.observedAt),time(history.payload.sealedAt)));
 assert.equal(time(p.collectedAt),Math.max(time(fixture.payload.collectedAt),time(history.payload.sealedAt)));
 assert(time(p.observedAt)<=time(p.collectedAt)&&time(p.asOf)<=time(p.collectedAt),'PROVENANCE_ORDER');
 assert.equal(time(p.asOf),time(p.observedAt));
 assert(time(p.collectedAt)<time(p.predictionCutoff)&&time(p.predictionCutoff)<=time(start)-60000,'PROVENANCE_CUTOFF');
 assert(time(p.collectedAt)<=Date.now()&&Date.now()<time(p.predictionCutoff),'PROVENANCE_CURRENT_WINDOW');
}
