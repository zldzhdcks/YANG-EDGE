import {readFileSync,readdirSync,mkdirSync,openSync,writeFileSync,fsyncSync,closeSync,realpathSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {digest,sha,requireRule,INPUT_SCHEMA,FEATURES,REQUIRED,validateTarget,validateMatch,order,type Target,type Match,type Candidate} from './contracts-v1';
import {parseFeature,type FeatureRecord} from './feature-state-v1';
export const root=fileURLToPath(new URL('../../',import.meta.url));
export const code=join(root,'scripts/football-v3-feature-research-v1');
export const output=resolve(root,'../YANG-EDGE-INBOX/football-v3-development-v1');
const rawRoot=resolve(root,'../YANG-EDGE-INBOX/football-v3-historical-feature-census-v1/2026-09-12T06-18-23-453Z');
export const sourceSealPath=join(root,'data/audits/football-v3-feature-source-freeze-v1.json');
export const read=<T>(p:string):T=>JSON.parse(readFileSync(p,'utf8')) as T;
export function readSeal<T>(p:string){const s=read<{payload:T;sha256:string}>(p);requireRule(digest(s.payload)===s.sha256,'SEAL_HASH');return s;}
export function writeSeal<T>(p:string,payload:T){mkdirSync(resolve(p,'..'),{recursive:true});const value={payload,sha256:digest(payload)},fd=openSync(p,'wx');try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}return value;}
export const git=(...args:string[])=>execFileSync('git',['-C',root,...args],{encoding:'utf8',maxBuffer:20e6}).trim();
export const parents=[
  ['docs/FOOTBALL_V3_FEATURE_RESEARCH_PROTOCOL_V1.json','0b30bc4d41684f2797d0a8e0a2a53694ecc6d5dc8f151b45213af1f1f9dc1bb8'],
  ['docs/FOOTBALL_V3_FEATURE_ALGORITHM_DESIGN_FREEZE_V1.json','04803e9b26acfd43de263c9b52c575ed2231d91984f82877da5e63b0cde6207a'],
  ['data/audits/football-v3-2025-independent-holdout-cohort-seal-v1.json','7924420956e419af1a7f14b8b2eb520cc55d37b46534736d35b0fbdcf51c2581'],
] as const;
export function verifyParents(){for(const [p,h] of parents)requireRule(readSeal<unknown>(join(root,p)).sha256===h,'PARENT_CHANGED');}
function filesUnder(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?filesUnder(join(dir,d.name)):d.name.endsWith('.ts')?[join(dir,d.name)]:[]);}
export function sourceFiles(){return Object.fromEntries(filesUnder(code).sort().map(f=>[relative(root,f).replaceAll('\\','/'),sha(readFileSync(f,'utf8').replaceAll('\r\n','\n'))]));}
export function dependencyHashes(){const paths=[...filesUnder(join(root,'scripts/football-poisson-v2-draw-research')),join(root,'src/lib/football/poisson-research-v1/index.ts'),join(root,'src/lib/football/odds-1x2-v1/instant.ts')];return Object.fromEntries(paths.sort().map(p=>[relative(root,p).replaceAll('\\','/'),sha(readFileSync(p))]));}
export function preservation(){
  const prior=read<Record<string,string>>(resolve(root,'../YANG-EDGE-INBOX/football-v3-algorithm-design-v1/preservation-before.json'));
  for(const [p,h] of Object.entries(prior))requireRule(sha(readFileSync(join(root,p)))===h,'PROTECTED_FILE_CHANGED');
  const extra=[parents[1][0],'docs/FOOTBALL_V3_FEATURE_ALGORITHM_DESIGN_FREEZE_V1.md',parents[2][0],'docs/FOOTBALL_V3_2025_INDEPENDENT_HOLDOUT_COHORT_SEAL_V1.md'];
  return {...prior,...Object.fromEntries(extra.map(p=>[p,sha(readFileSync(join(root,p)))]))};
}
type CensusRow=Target & {sourceHash:string;providerFetchedAt:string;httpStatus:number};
type Census={records:CensusRow[];archiveHashes:{leagueId:number;path:string;sha256:string}[];cohortIdsHash:string};
export function censusMetadata(){const s=readSeal<Census>(join(root,'data/audits/football-v3-historical-feature-coverage-census-v1.json'));requireRule(s.sha256==='0f215fba91a68cdd0a4a53b5124a311f193821baddd2ff1764d8942cb8718c41','CENSUS_CHANGED');return s;}
export function sealSource(){verifyParents();const census=censusMetadata();return writeSeal(sourceSealPath,{schemaVersion:'FOOTBALL_V3_FEATURE_SOURCE_FREEZE_V1',createdAt:new Date().toISOString(),sourceCommit:git('rev-parse','HEAD'),parents,files:sourceFiles(),dependencies:dependencyHashes(),inputSchema:INPUT_SCHEMA,inputSchemaHash:digest(INPUT_SCHEMA),censusHash:census.sha256,inputHashes:census.payload.records.map(r=>({fixtureId:r.fixtureId,season:r.season,sha256:r.sourceHash})),preserved:preservation(),tests:read<unknown>(join(output,'pre-result-tests.json')),fittingExecuted:false,resultsViewed:false});}
export function verifySource(){verifyParents();const s=readSeal<{files:Record<string,string>;dependencies:Record<string,string>;preserved:Record<string,string>}>(sourceSealPath);requireRule(digest(s.payload.files)===digest(sourceFiles()),'SOURCE_CHANGED');requireRule(digest(s.payload.dependencies)===digest(dependencyHashes()),'READONLY_DEPENDENCY_CHANGED');requireRule(digest(s.payload.preserved)===digest(preservation()),'PRESERVATION_CHANGED');requireRule(git('rev-parse','HEAD')===git('rev-parse','origin/agent/astra/football-historical-source-gate-v1'),'SOURCE_NOT_PUSHED');requireRule(digest(JSON.parse(git('show','HEAD:data/audits/football-v3-feature-source-freeze-v1.json')))===digest(s),'SOURCE_SEAL_NOT_COMMITTED');return s;}
type ArchiveRow={providerFixtureId:number;leagueId:number;season:number;round:string;fixtureStatus:string;kickoffUtc:string;homeTeamId:number;awayTeamId:number;fullTimeHomeGoals:number;fullTimeAwayGoals:number};
/** Only the fixed 2023/2024 archive/census paths exist here. No arbitrary raw-directory argument. */
export function loadData(){
  const c=censusMetadata().payload,targets:Target[]=[],archives=new Map<number,ArchiveRow>(),source=new Map(c.records.map(r=>[r.fixtureId,r]));
  for(const a of c.archiveHashes){const bytes=readFileSync(join(root,a.path));requireRule(sha(bytes)===a.sha256,'ARCHIVE_HASH');const rows=(JSON.parse(bytes.toString('utf8')) as {matches:ArchiveRow[]}).matches;
    for(const row of rows){requireRule([2023,2024].includes(row.season)&&row.leagueId===a.leagueId,'ARCHIVE_SEASON_FIREWALL');if(!/^Regular Season - ([1-9][0-9]*)$/.test(row.round))continue;requireRule(row.fixtureStatus==='FT','NON_FT_ARCHIVE');
      const t:Target={fixtureId:row.providerFixtureId,leagueId:row.leagueId,season:row.season,kickoffUtc:row.kickoffUtc,homeTeamId:row.homeTeamId,awayTeamId:row.awayTeamId};validateTarget(t);requireRule(!archives.has(t.fixtureId),'DUPLICATE_ARCHIVE');archives.set(t.fixtureId,row);targets.push(t);}
  }
  const sorted=[39,140,135,78].flatMap(leagueId=>order(targets.filter(t=>t.leagueId===leagueId)));requireRule(sorted.length===2892&&sha(JSON.stringify(sorted.map(t=>t.fixtureId)))===c.cohortIdsHash,'COHORT_IDS_CHANGED');
  for(const t of sorted){const r=source.get(t.fixtureId);requireRule(r&&r.season===t.season&&r.leagueId===t.leagueId&&r.homeTeamId===t.homeTeamId&&r.awayTeamId===t.awayTeamId&&r.kickoffUtc===t.kickoffUtc,'CENSUS_IDENTITY');}
  let exposedEnabled=false;const cache=new Map<string,FeatureRecord>();
  const allow=(t:Target)=>{validateTarget(t);requireRule(t.season===2023||exposedEnabled&&t.season===2024,'EXPOSED_LABELS_NOT_ENABLED');const row=archives.get(t.fixtureId);requireRule(row&&row.leagueId===t.leagueId&&row.season===t.season&&row.kickoffUtc===t.kickoffUtc&&row.homeTeamId===t.homeTeamId&&row.awayTeamId===t.awayTeamId,'INPUT_IDENTITY');};
  return {targets:sorted,enableExposed(){exposedEnabled=true;},score(t:Target):Match{allow(t);const r=archives.get(t.fixtureId)!;const m={...t,homeGoals:r.fullTimeHomeGoals,awayGoals:r.fullTimeAwayGoals};validateMatch(m);return m;},feature(t:Target,candidate:Candidate):FeatureRecord{
    allow(t);const key=candidate+':'+t.fixtureId;if(cache.has(key))return cache.get(key)!;const s=source.get(t.fixtureId)!;requireRule(s.httpStatus===200,'FEATURE_API_ERROR');
    const file=join(rawRoot,'historical-'+t.fixtureId+'.raw.json');requireRule(realpathSync(file)===join(realpathSync(rawRoot),'historical-'+t.fixtureId+'.raw.json'),'RAW_PATH_FIREWALL');const bytes=readFileSync(file);requireRule(sha(bytes)===s.sourceHash,'RAW_FEATURE_HASH');const body=JSON.parse(bytes.toString('utf8'));const values=Object.fromEntries(FEATURES.map(f=>[f,REQUIRED[candidate].includes(f)?parseFeature(body,t,f):null])) as FeatureRecord['values'];
    const record={target:t,values,sourceHash:s.sourceHash,providerFetchedAt:s.providerFetchedAt};cache.set(key,record);return record;
  }};
}
