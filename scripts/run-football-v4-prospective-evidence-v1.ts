import {selectProductionBatch,committedBytes} from '../src/lib/research/terminal-decision/batch-selection';
/** Explicit future-scope collector. Default is plan-only. Never invokes prediction. */
import {readFileSync} from 'node:fs';import {resolve,isAbsolute} from 'node:path';import {execFileSync} from 'node:child_process';
import {loadScope,bind,pollPlan,collect,Bridge} from '../src/lib/football/v4-prospective-evidence-v1/collector';
import {officialSource} from '../src/lib/football/v4-prospective-evidence-v1/provider';
import {appendPlayer,Registry,PlayerRecord} from '../src/lib/football/v4-prospective-evidence-v1/registry';
import {sha,requireProof,SourceType} from '../src/lib/football/v4-prospective-evidence-v1/contracts';
async function main(){const repositoryRoot=process.cwd(),args=process.argv.slice(2);const arg=(key:string)=>{const i=args.indexOf(key);return i>=0?args[i+1]:undefined;};const date=arg('--date'),manifest=arg('--manifest');requireProof(date&&manifest,'EXPLICIT_DATE_AND_COMMITTED_MANIFEST_REQUIRED');const root=selectProductionBatch(repositoryRoot,date,arg('--batch')).root;
 function committed(p:string){requireProof(!isAbsolute(p)&&!p.includes('..')&&!p.includes(':'),'REPO_RELATIVE_PATH_REQUIRED');const bytes=readFileSync(resolve(root,p));const git=committedBytes(root,p);requireProof(bytes.toString().replaceAll('\r\n','\n')===git.toString().replaceAll('\r\n','\n'),'MANIFEST_NOT_COMMITTED');return bytes;}
 const m=JSON.parse(committed(manifest).toString()) as {bridge:Bridge;identityEvidence:{path:string;sha256:string};registry:{path:string;sha256:string};rights:{path:string;sha256:string};source:SourceType;teamId:string;page?:number;pollAt:string;requestBudget:number;collectionAuthorized:boolean};
 requireProof(['XI','INJURY','PLAYER_STATS'].includes(m.source),'SOURCE_NOT_ALLOWED');requireProof(m.identityEvidence.sha256===sha(committed(m.identityEvidence.path))&&m.bridge.sourceEvidenceSha256===m.identityEvidence.sha256,'IDENTITY_EVIDENCE_HASH');
 const proof=JSON.parse(committed(m.identityEvidence.path).toString());for(const k of ['targetId','scopeIdentity','providerFixtureId','competitionProviderId','homeTeamId','awayTeamId','homeTeamRaw','awayTeamRaw','scheduledStart'] as const)requireProof(proof[k]===m.bridge[k],'IDENTITY_PROOF_BINDING');requireProof(proof.verificationStatus==='EXACT'&&proof.fuzzyMatching===false,'EXACT_PROOF_REQUIRED');
 const scope=loadScope(root,date),now=()=>new Date().toISOString();bind(scope,m.bridge,now());
 const registryBytes=committed(m.registry.path);requireProof(sha(registryBytes)===m.registry.sha256,'REGISTRY_HASH');let registry:Registry=[];for(const row of JSON.parse(registryBytes.toString()) as PlayerRecord[])registry=appendPlayer(registry,row);
 const rightsBytes=committed(m.rights.path);requireProof(sha(rightsBytes)===m.rights.sha256,'RIGHTS_HASH');const rights=JSON.parse(rightsBytes.toString());requireProof(rights.internalCollectionAuthorized===true&&rights.sourceTypes.includes(m.source),'RIGHTS_NOT_AUTHORIZED');
 if(!args.includes('--collect')){console.log(JSON.stringify({status:'PLAN_ONLY',polls:pollPlan(m.bridge),providerCalls:0}));return;}
 requireProof(m.collectionAuthorized===true,'COLLECTION_NOT_AUTHORIZED');const out=resolve(repositoryRoot,'../YANG-EDGE-INBOX/football-v4-prospective-evidence-v1');
 const result=await collect({scope,bridge:m.bridge,registry,root:out,source:m.source,teamId:m.teamId,page:m.page,pollAt:m.pollAt,now,fetchSource:officialSource(resolve(out,'network'),process.env.API_FOOTBALL_KEY??''),rightsEvidenceHash:m.rights.sha256,requestBudget:m.requestBudget});console.log(JSON.stringify(result));}
main().catch(e=>{console.error(e instanceof Error?e.message:'COLLECTOR_FAILED');process.exitCode=1;});
