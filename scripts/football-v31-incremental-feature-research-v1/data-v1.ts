import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {beforeInputRead,validateTarget,validateMatch,digest,sha,requireRule,order,type Target,type Match} from './contracts-v1';
import {parseFeature,type FeatureRecord} from '../football-v3-feature-research-v1/feature-state-v1';
import {root,censusMetadata,exactRawFile,readSeal} from './evidence-v1';
const rawRoot=join(root,'../YANG-EDGE-INBOX/football-v3-historical-feature-census-v1/2026-09-12T06-18-23-453Z');
type ArchiveRow={providerFixtureId:number;leagueId:number;season:number;round:string;fixtureStatus:string;kickoffUtc:string;homeTeamId:number;awayTeamId:number;fullTimeHomeGoals:number;fullTimeAwayGoals:number};
/** Mixed-season archive bytes may be read for hash verification; only an authorized single fixture is decoded. */
export function indexArchive(text:string){
  const start=/"matches"\s*:\s*\[/.exec(text);requireRule(start,'ARCHIVE_MATCHES');const records=new Map<number,string>();let depth=0,inString=false,escape=false,begin=-1;
  for(let i=start.index+start[0].length;i<text.length;i++){const c=text[i];if(inString){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')inString=false;continue;}if(c==='"'){inString=true;continue;}if(c==='{'&&depth++===0)begin=i;else if(c==='}'){depth--;if(depth===0){const object=text.slice(begin,i+1),m=/"providerFixtureId"\s*:\s*(\d+)\s*[,}]/.exec(object);requireRule(m,'ARCHIVE_FIXTURE_ID');const id=Number(m[1]);requireRule(!records.has(id),'DUPLICATE_ARCHIVE_FIXTURE');records.set(id,object);}}else if(c===']'&&depth===0)return records;}
  requireRule(false,'TRUNCATED_ARCHIVE');
}
export function loadData(){
  const c=censusMetadata().payload;for(const r of c.records)validateTarget({fixtureId:r.fixtureId,leagueId:r.leagueId,season:r.season,kickoffUtc:r.kickoffUtc,homeTeamId:r.homeTeamId,awayTeamId:r.awayTeamId});
  const targets=[39,140,135,78].flatMap(l=>order(c.records.filter(r=>r.leagueId===l).map(r=>({fixtureId:r.fixtureId,leagueId:r.leagueId,season:r.season,kickoffUtc:r.kickoffUtc,homeTeamId:r.homeTeamId,awayTeamId:r.awayTeamId}))));
  requireRule(targets.length===2892&&sha(JSON.stringify(targets.map(t=>t.fixtureId)))===c.cohortIdsHash,'COHORT_CHANGED');requireRule(new Set(targets.map(t=>t.fixtureId)).size===targets.length,'DUPLICATE_TARGET');
  const metadata=new Map(c.records.map(r=>[r.fixtureId,r])),identity=new Map(targets.map(t=>[t.fixtureId,digest(t)])),archives=new Map<number,Map<number,string>>(),scores=new Map<number,Match>(),features=new Map<number,FeatureRecord>();let exposedEnabled=false;
  function allow(t:Target){validateTarget(t);requireRule(t.season===2023||exposedEnabled&&t.season===2024,'EXPOSED_NOT_ENABLED');requireRule(identity.get(t.fixtureId)===digest(t),'INPUT_IDENTITY');}
  return {targets,
    enableExposed(finalSealFile:string,sourceHash:string){const s=readSeal<{sourceHash:string;finals:{status:string}[];createdAt:string}>(finalSealFile);requireRule(s.payload.sourceHash===sourceHash&&s.payload.finals.length===8&&s.payload.finals.every(x=>x.status==='PASS'),'FINAL_MAP_BETA_SEAL_REQUIRED');exposedEnabled=true;},
    score(t:Target):Match{return beforeInputRead(t,()=>{allow(t);if(scores.has(t.fixtureId))return scores.get(t.fixtureId)!;
      if(!archives.has(t.leagueId)){const a=c.archiveHashes.find(x=>x.leagueId===t.leagueId);requireRule(a&&a.path.startsWith('data/cache/research/football/historical-archive-v1/'),'ARCHIVE_PATH');const bytes=readFileSync(join(root,a.path));requireRule(sha(bytes)===a.sha256,'ARCHIVE_HASH');archives.set(t.leagueId,indexArchive(bytes.toString('utf8')));}
      const text=archives.get(t.leagueId)!.get(t.fixtureId);requireRule(text,'MISSING_ARCHIVE_ID');const r=JSON.parse(text) as ArchiveRow;
      requireRule(r.providerFixtureId===t.fixtureId&&r.leagueId===t.leagueId&&r.season===t.season&&r.kickoffUtc===t.kickoffUtc&&r.homeTeamId===t.homeTeamId&&r.awayTeamId===t.awayTeamId,'ARCHIVE_IDENTITY');requireRule(/^Regular Season - ([1-9][0-9]*)$/.test(r.round)&&r.fixtureStatus==='FT','ARCHIVE_STAGE_STATUS');const m={...t,homeGoals:r.fullTimeHomeGoals,awayGoals:r.fullTimeAwayGoals};validateMatch(m);scores.set(t.fixtureId,m);return m;});},
    feature(t:Target):FeatureRecord{return beforeInputRead(t,()=>{allow(t);if(features.has(t.fixtureId))return features.get(t.fixtureId)!;const m=metadata.get(t.fixtureId)!;requireRule(m.httpStatus===200,'FEATURE_API_ERROR');const file=join(rawRoot,'historical-'+t.fixtureId+'.raw.json');exactRawFile(rawRoot,file);const bytes=readFileSync(file);requireRule(sha(bytes)===m.sourceHash,'RAW_FEATURE_HASH');const body=JSON.parse(bytes.toString('utf8'));const f:FeatureRecord={target:t,values:{xG:parseFeature(body,t,'xG'),shots:parseFeature(body,t,'shots'),sot:parseFeature(body,t,'sot')},sourceHash:m.sourceHash,providerFetchedAt:m.providerFetchedAt};features.set(t.fixtureId,f);return f;});}
  };
}
