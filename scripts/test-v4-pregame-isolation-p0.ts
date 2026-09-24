import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {collect} from '../src/lib/football/v4-prospective-evidence-v1/collector';
import {sha,stable,type Envelope,type SourceType} from '../src/lib/football/v4-prospective-evidence-v1/contracts';
import {projectPregame,assertSafePregame,serializePregame,readPregame,PREGAME_SCHEMA} from '../src/lib/football/v4-prospective-evidence-v1/projection';
import {put,get,exactEvidence} from '../src/lib/football/v4-prospective-evidence-v1/store';
import {CANARIES,canaryCount,contaminatedResponse,syntheticIsolationContext,provePregameIsolation} from '../src/lib/football/v4-prospective-evidence-v1/isolation-proof';
import {collectionReadiness} from '../src/lib/football/v4-prospective-evidence-v1/readiness';
import {withVerifiedXI} from '../src/lib/football/official-canonical-v1/rich-preview-xi';
import type {RichPreview} from '../src/lib/football/official-canonical-v1/rich-preview';
import {validateXI,validateInjuries} from '../src/lib/football/v4-prospective-evidence-v1/validate';
import {committedBytes} from '../src/lib/research/terminal-decision/batch-selection';
const ctx=syntheticIsolationContext();
// Any accidental global network use fails this suite immediately.
globalThis.fetch=async()=>{throw Error('NETWORK_FORBIDDEN_IN_P0_TEST');};
async function stored(source:SourceType,raw:unknown[],late=false,receiptExtra:Record<string,unknown>={}){
 const root=await mkdtemp(join(tmpdir(),'v4-p0-test-'));const at=late?ctx.bridge.predictionCutoff:ctx.before;
 try {const input={...ctx,root,source,teamId:'10',pollAt:ctx.before,now:()=>ctx.before,rightsEvidenceHash:sha('rights'),requestBudget:1,fetchSource:async()=>({raw,observedAt:at,collectedAt:at,asOf:at,providerUpdatedAt:null,...receiptExtra})};
  const result=await collect(input),dir=join(root,late?'quarantine':'pregame'),bytes=await readFile(join(dir,result.evidenceId+'.json'));const value=JSON.parse(bytes.toString());
  assert.equal(canaryCount(value),0);assert(!bytes.includes(Buffer.from('"raw"')));
  if(!late){assert.deepEqual(await exactEvidence(dir,result.evidenceId,result.sha256!),value);assert.equal((await put(dir,result.evidenceId,bytes)).status,'IDEMPOTENT_REPLAY');assert.equal((await put(dir,result.evidenceId,Buffer.from('{}'))).status,'CONFLICT');assert((await get(dir,result.evidenceId,result.sha256!)).equals(bytes));assert.equal((await collect(input)).status,'ALREADY_CLAIMED_NO_REFETCH');}
  return {value:value as Envelope,bytes,root};
 }finally{await rm(root,{recursive:true,force:true});}
}
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
const forbidden=/^(raw|results?|scores?|final_?score|winner|outcome|live(?:_?data)?|elapsed|minute|events?|post_?game(?:_?stats)?|statistics|goals|homegoals|awaygoals|halftimescore|fulltimescore)$/i;
function assertNoForbiddenKeys(v:unknown){if(!v||typeof v!=='object')return;for(const [key,value] of Object.entries(v)){assert(!forbidden.test(key),key);assertNoForbiddenKeys(value);}}
for(const source of ['XI','INJURY','PLAYER_STATS'] as const)test(source+' full collector serialization excludes nested canaries and unapproved keys',async()=>{
 const raw=contaminatedResponse(source);assert(canaryCount(raw)>0);const old=stable(raw);const {value}=await stored(source,raw);assert.equal(stable(raw),old);assertNoForbiddenKeys(value);assert.equal(value.schemaVersion,PREGAME_SCHEMA);
 const safe=readPregame(value,ctx.bridge);
 if(safe.sourceType==='XI'){assert.deepEqual((value.payload as any).validation,validateXI(safe,ctx.bridge,ctx.registry));assert.equal(value.validationStatus,'CONFIRMED_COMPLETE');assert.equal(safe.teams[0].formation,'4-4-2');assert.equal(safe.teams[0].starters[0].position,'D');}
 if(safe.sourceType==='INJURY'){assert.deepEqual((value.payload as any).validation,validateInjuries(safe.rows,ctx.bridge,ctx.registry));assert.equal(value.validationStatus,'VALID');assert.equal(safe.rows[0].reason,'Suspended');}
 if(safe.sourceType==='PLAYER_STATS')assert.deepEqual(safe,{sourceType:'PLAYER_STATS',status:'UNRESOLVED'});
});
for(const source of ['XI','INJURY','PLAYER_STATS'] as const)test(source+' quarantine stores safe projection only',async()=>{const {value}=await stored(source,contaminatedResponse(source),true);assertSafePregame((value as any).pregame);assertNoForbiddenKeys((value as any).pregame);assert.equal((value as any).status,'TEMPORAL_UNVERIFIED');});
for(const [home,away,status] of [[11,11,'CONFIRMED_COMPLETE'],[11,0,'INCOMPLETE'],[0,11,'INCOMPLETE'],[11,7,'INCOMPLETE'],[0,0,'UNKNOWN']] as const)test('stored XI '+home+'/'+away+' preserves '+status,async()=>{const raw=contaminatedResponse('XI') as any[];raw[0].startXI=raw[0].startXI.slice(0,home);raw[1].startXI=raw[1].startXI.slice(0,away);assert.equal((await stored('XI',raw)).value.validationStatus,status);});
for(const kind of ['duplicate','wrongTeam','missingPlayer'] as const)test('stored invalid XI '+kind,async()=>{const raw=contaminatedResponse('XI') as any[];if(kind==='duplicate')raw[0].startXI[1]=raw[0].startXI[0];if(kind==='wrongTeam')raw[0].team.id=99;if(kind==='missingPlayer')raw[0].startXI[0].player.id=null;assert.equal((await stored('XI',raw)).value.validationStatus,'INVALID');});
test('stored injury wrong fixture remains INVALID',async()=>{const raw=contaminatedResponse('INJURY') as any[];raw[0].fixture.id=2;assert.equal((await stored('INJURY',raw)).value.validationStatus,'INVALID');});
test('canaries smuggled into approved scalar slots cannot survive',async()=>{
 const raw=contaminatedResponse('XI') as any[];raw[0].formation=CANARIES[0];raw[0].startXI[0].player.pos={score:CANARIES[1]};raw[0].startXI[0].player.id=CANARIES[2];await stored('XI',raw,false,{providerUpdatedAt:{result:CANARIES[0]},paging:{current:1,total:1,extension:CANARIES[1]}});
 const injuries=contaminatedResponse('INJURY') as any[];injuries[0].player.reason=CANARIES[0];injuries[0].player.type={live:CANARIES[1]};const {value}=await stored('INJURY',injuries);assert.equal(value.validationStatus,'UNRESOLVED');
});
test('malformed provider clock is quarantined as null, never copied',async()=>{
 const root=await mkdtemp(join(tmpdir(),'v4-p0-clock-'));try{const r=await collect({...ctx,root,source:'XI',teamId:'10',pollAt:ctx.before,now:()=>ctx.before,rightsEvidenceHash:sha('rights'),requestBudget:1,fetchSource:async()=>({raw:contaminatedResponse('XI'),observedAt:CANARIES[0],collectedAt:ctx.before,asOf:ctx.before,providerUpdatedAt:null})});assert.equal(r.status,'TEMPORAL_REJECTED');const q=JSON.parse(await readFile(join(root,'quarantine',r.evidenceId+'.json'),'utf8'));assert.equal(q.clocks.observedAt,null);assert.equal(canaryCount(q),0);}finally{await rm(root,{recursive:true,force:true});}
});
test('serializer and read-back reject broadened schema, even with recomputed source hash',async()=>{
 const {value}=await stored('XI',contaminatedResponse('XI'));
 for(const location of ['root','payload','pregame','player','validation','paging']){const bad=clone(value) as any;const p=bad.payload;if(location==='root')bad.result=CANARIES[0];if(location==='payload')p.raw=[];if(location==='pregame')p.pregame.metadata={score:CANARIES[0]};if(location==='player')p.pregame.teams[0].starters[0].extension=CANARIES[1];if(location==='validation')p.validation.raw=CANARIES[2];if(location==='paging')p.paging={current:1,total:1,result:CANARIES[0]};bad.sourceArtifactSha256=sha(stable(p.pregame));assert.throws(()=>serializePregame(bad));assert.throws(()=>readPregame(bad,ctx.bridge));}
 const bad=clone(value);bad.sourceArtifactSha256=sha('wrong');assert.throws(()=>readPregame(bad,ctx.bridge),/HASH/);
 const root=await mkdtemp(join(tmpdir(),'v4-p0-hash-'));try{const bytes=serializePregame(value);await put(root,value.evidenceId,bytes);await assert.rejects(exactEvidence(root,value.evidenceId,sha('wrong')),/HASH/);const wrong=sha('wrong-id');await put(root,wrong,bytes);await assert.rejects(exactEvidence(root,wrong,sha(bytes)),/IDENTITY/);}finally{await rm(root,{recursive:true,force:true});}
});
test('legacy source hash preserved; legacy object projected only in memory',()=>{const raw=contaminatedResponse('XI');const legacy={schemaVersion:'football-v4-prospective-evidence-v1',sourceType:'XI',sourceArtifactSha256:sha(stable(raw)),payload:{raw}} as Envelope;const bytes=stable(legacy);assertSafePregame(readPregame(legacy,ctx.bridge));assert.equal(stable(legacy),bytes);assert.equal(canaryCount(readPregame(legacy,ctx.bridge)),0);assert.throws(()=>readPregame({...legacy,sourceArtifactSha256:sha('wrong')},ctx.bridge),/HASH/);});
test('safe XI downstream replay preserves probabilities, lineup and hash checks',async()=>{
 const {value:e}=await stored('XI',contaminatedResponse('XI'));
 const previous={targetId:ctx.bridge.targetId,fixtureId:1,leagueId:39,season:2030,kickoffKst:ctx.bridge.scheduledStart,createdAt:'2030-09-01T10:00:00.000Z',version:1,teams:[{id:10,name:'Home',keyPlayers:[]},{id:20,name:'Away',keyPlayers:[]}],sections:[{title:'LINEUP / ABSENCES',text:'UNKNOWN'}],dataQuality:['Starting XI: UNKNOWN'],officialV1:{pHome:.4,pDraw:.3,pAway:.3}} as unknown as RichPreview;
 const old=stable(previous),out=withVerifiedXI(previous,e,ctx.registry,'2030-09-01T11:01:00.000Z',sha('prior'));assert.equal(out.status,'PREVIEW_XI_AVAILABLE');assert.equal(out.lineups[0].starters.length,11);assert.equal(out.lineups[0].formation,'4-4-2');assert.deepEqual(out.officialV1,previous.officialV1);const legacy={...e,schemaVersion:'football-v4-prospective-evidence-v1' as const,sourceArtifactSha256:sha(stable(contaminatedResponse('XI'))),payload:{raw:contaminatedResponse('XI'),registryHash:sha(stable(ctx.registry)),season:'2030'}};assert.deepEqual(withVerifiedXI(previous,legacy,ctx.registry,'2030-09-01T11:01:00.000Z',sha('prior')).lineups,out.lineups);const injuryRaw=contaminatedResponse('INJURY') as any[];injuryRaw[0].player.type='Injury';injuryRaw[0].player.reason='Knee';const injury=(await stored('INJURY',injuryRaw)).value;const withInjury=withVerifiedXI(previous,e,ctx.registry,'2030-09-01T11:01:00.000Z',sha('prior'),injury);assert.equal(withInjury.absences[0].playerId,'1');assert.equal(withInjury.absences[0].status,'UNKNOWN');assert.equal(withInjury.absences[0].reason,'UNKNOWN');assert.equal(stable(previous),old);assert.deepEqual(withVerifiedXI(previous,e,ctx.registry,'2030-09-01T11:01:00.000Z',sha('prior')),out);
 assert.throws(()=>withVerifiedXI(previous,{...e,sourceArtifactSha256:sha('bad')},ctx.registry,'2030-09-01T11:01:00.000Z',sha('prior')),/HASH/);
});
test('readiness requires executed full-path isolation proof, no collection enabled',async()=>{const proof=await provePregameIsolation();assert.equal(proof.CANARY_MATCH_COUNT,0);assert.equal(proof.syntheticCases,6);assert.equal(proof.PROVIDER_CALLS,0);const gate=await collectionReadiness(ctx.scope,ctx.bridge,ctx.registry,ctx.before);assert.equal(gate.PREGAME_RESULT_FIELD_ISOLATION,'PASS');assert.equal(gate.realCollectionEnabled,false);});
test('existing committed manifest/identity/registry/rights hashes remain bound',async()=>{
 const root=resolve('data/research/slate-batches/round-111-odds-new-v1'),dir=join(root,'priority-readiness-v1');let count=0;
 for(const name of await readdir(dir)){if(!/^poll-\d+.*\.json$/.test(name))continue;const m=JSON.parse(readFileSync(join(dir,name),'utf8'));for(const field of ['identityEvidence','registry','rights']){const ref=m[field];const bytes=readFileSync(join(root,ref.path));assert.equal(sha(bytes),ref.sha256);assert.equal(bytes.toString().replaceAll('\r\n','\n'),committedBytes(root,ref.path).toString().replaceAll('\r\n','\n'));count++;}assert.equal(m.bridge.sourceEvidenceSha256,m.identityEvidence.sha256);}
 assert.equal(count,42);
});

test('starter/substitute role survives projection without provider child extensions',async()=>{const raw=contaminatedResponse('XI') as any[];raw[0].substitutes=[raw[0].startXI.pop()];const {value}=await stored('XI',raw);const x=readPregame(value,ctx.bridge);assert(x.sourceType==='XI');assert.equal(x.teams[0].starters.length,10);assert.equal(x.teams[0].substitutes[0].playerId,'11');assert.equal(value.validationStatus,'INCOMPLETE');});
test('unknown source rejects before synthetic fetch or filesystem claims',async()=>{const root=await mkdtemp(join(tmpdir(),'v4-p0-source-'));let calls=0;try{await assert.rejects(collect({...ctx,root,source:'RESULT' as SourceType,teamId:'10',pollAt:ctx.before,now:()=>ctx.before,rightsEvidenceHash:sha('rights'),requestBudget:1,fetchSource:async()=>{calls++;throw Error('MUST_NOT_FETCH');}}),/SOURCE_NOT_ALLOWED/);assert.equal(calls,0);assert.deepEqual(await readdir(root),[]);}finally{await rm(root,{recursive:true,force:true});}});

test('bounded football scalars retain legitimate formation and reject unsafe IDs',()=>{const raw=contaminatedResponse('XI') as any[];raw[0].formation='6-3-1';raw[0].startXI[0].player.id='9999999999999999';const safe=projectPregame('XI',raw,ctx.bridge);assert(safe.sourceType==='XI');assert.equal(safe.teams[0].formation,'6-3-1');assert.equal(safe.teams[0].starters[0].playerId,'');raw[0].formation='7-8';const invalid=projectPregame('XI',raw,ctx.bridge);assert(invalid.sourceType==='XI');assert.equal(invalid.teams[0].formation,null);});
