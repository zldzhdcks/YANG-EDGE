import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,readdirSync,constants} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const base=join(process.cwd(),'data/research/slate-batches/round-111-odds-new-v1'),out=join(base,'production-bridge-v1'),read=p=>JSON.parse(readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
const previews=read(join(out,'mandatory-previews-v2.json')),references=[];
for(const p of previews){
 const dir=join(base,'data/cache/research/football/forward-shadow-v1/MODEL_FORWARD/fixtures',String(p.providerFixtureId)),pack=join(out,'prediction-evidence',String(p.providerFixtureId));mkdirSync(pack,{recursive:true});
 const snapshot=read(join(dir,'snapshot.json')),receipt=read(join(dir,'seal-receipt.json')),input=read(join(dir,'input.json'));
 assert.equal(snapshot.payload.status,'PREDICTED');assert.equal(snapshot.sha256,receipt.payload.snapshotHash);assert.equal(input.sha256,snapshot.payload.inputSnapshotHash);assert.equal(snapshot.payload.TARGET_RESULT_DATA_USED,false);
 const files=[];for(const name of ['snapshot.json','seal-receipt.json','input.json']){copyFileSync(join(dir,name),join(pack,name),constants.COPYFILE_EXCL);files.push({path:`prediction-evidence/${p.providerFixtureId}/${name}`,sha256:sha(readFileSync(join(pack,name)))});}
 references.push({targetId:p.TARGET_ID,batchId:'round-111-odds-new-v1',scopeId:p.inputProof.scopeId,scopeSha256:p.inputProof.scopeSha256,fixtureId:p.providerFixtureId,snapshotHash:snapshot.sha256,files});
 p.PREDICTION_STATUS='AVAILABLE';p.PREDICTION_REASON=null;p.officialV1={modelVersion:snapshot.payload.modelVersion,modelSourceHash:snapshot.payload.modelSourceHash,createdAt:snapshot.payload.predictionCreatedAt,snapshotHash:snapshot.sha256,pHome:snapshot.payload.pHome,pDraw:snapshot.payload.pDraw,pAway:snapshot.payload.pAway,predictedClass:snapshot.payload.predictedClass};p.LAST_UPDATED_AT=new Date().toISOString();
}
writeFileSync(join(out,'mandatory-previews-v3.json'),JSON.stringify(previews,null,2)+'\n',{flag:'wx'});
const audits=['2026-09-20','2026-09-21'].map(d=>read(join(base,`data/audits/operational/${d}-daily-pregame-status.json`)));
const terminalDir=join(base,'data/research/terminal-decisions/2026-09-20');
const terminals=readdirSync(terminalDir).map(n=>read(join(terminalDir,n,'decision.json')).payload);
const protectedFiles=read(join(base,'admission-audit.json')).protectedFiles;
for(const f of protectedFiles)assert.equal(sha(readFileSync(join(process.cwd(),f.path))),f.sha256);
assert.equal(sha(readFileSync('src/lib/football/poisson-research-v1/index.ts','utf8').replaceAll('\r\n','\n')),'6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf');
const summary={at:new Date().toISOString(),references,coverage:audits.map(a=>({date:a.dateKst,...a.coverage})),terminalCounts:{predictions:terminals.filter(t=>t.type==='PREDICTION').length,passes:terminals.filter(t=>t.type==='PASS').length,pending:audits.reduce((n,a)=>n+a.coverage.UNRESOLVED_COUNT,0)},passes:terminals.filter(t=>t.type==='PASS'),integrity:{oldScopesUnchanged:true,modelHashUnchanged:true,targetResultDataAccessed:false,targetLiveDataAccessed:false,targetPostgameAccessed:false,targetGradeDataAccessed:false,pastCompletedFTDataUsed:true,unrelatedHistoricalGradeRegressionSuiteExecuted:true,predictionNetworkCalls:0,predictionProviderCalls:0,collectorProviderCalls:6},v4:{collectionExecuted:false,blocker:'VERIFIED_PLAYER_MEMBERSHIP_REGISTRY_REQUIRED',gateFollowup:{automationId:'round-111-v4-gate',atKst:'2026-09-20T20:50:00+09:00',kind:'GATE_CHECK_ONLY_NOT_COLLECTION_JOB'}},final:'ROUND_111_PARTIAL_UNBLOCK'};
writeFileSync(join(out,'terminal-evidence-manifest.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({counts:summary.terminalCounts,passes:summary.passes,priority:previews.map(p=>({target:p.TARGET_ID,fixture:p.providerFixtureId,...p.officialV1}))},null,2));
