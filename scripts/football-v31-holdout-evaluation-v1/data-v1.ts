import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {loadData as oldData} from '../football-v31-incremental-feature-research-v1/data-v1';
import {exactRawFile} from '../football-v31-incremental-feature-research-v1/evidence-v1';
import {selectTargets,validateTarget,validateMatch,digest,sha,requireRule,type Target,type Match} from './frozen/scripts/football-v31-incremental-feature-research-v1/contracts-v1';
import {parseFeature,type FeatureRecord} from './frozen/scripts/football-v3-feature-research-v1/feature-state-v1';
import {holdoutMetadata,parameters,verifyFreeze,output,readSeal,EXPECTED} from './evidence-v1';
export function load2024(){const data=oldData(),p=parameters();data.enableExposed(join(p.localDirectory,'FINAL_MAP_BETA_SEAL.json'),EXPECTED.source);return data;}
type ProviderFixture={fixture:{id:number;date:string;status:{short:string}};league:{id:number;season:number;round:string};teams:{home:{id:number};away:{id:number}};score:{fulltime:{home:number;away:number}}};
/** This is the only holdout raw accessor. Requires committed/pushed freeze and exclusive execution marker. */
export function load2025(){const f=verifyFreeze();const marker=readSeal<{sourceHash:string}>(join(output,'EXECUTION_STARTED.json'));requireRule(marker.payload.sourceHash===f.sha256,'EXECUTION_AUTHORIZATION');const prior=load2024(),meta=holdoutMetadata().payload;
 const cohort=meta.fixtures.map(r=>({fixtureId:r.fixtureId,leagueId:r.leagueId,season:r.season,kickoffUtc:new Date(r.kickoffUtc).toISOString(),homeTeamId:r.homeTeamId,awayTeamId:r.awayTeamId}));cohort.forEach(validateTarget);
 requireRule(new Set([...prior.targets,...cohort].map(t=>t.fixtureId)).size===prior.targets.length+cohort.length,'DUPLICATE_IDENTITY');const identities=new Map(cohort.map(t=>[t.fixtureId,digest(t)]));const scoreCache=new Map<number,Match>(),featureCache=new Map<number,FeatureRecord>();const archives=new Map<number,Map<number,ProviderFixture>>();
 function bytes(name:string,hash:string){const path=join(meta.provenance.localRunDirectory,name);exactRawFile(meta.provenance.localRunDirectory,path);const b=readFileSync(path);requireRule(sha(b)===hash,'HOLDOUT_RAW_HASH');return b;}
 function identity(t:Target){validateTarget(t);requireRule(t.season===2025&&identities.get(t.fixtureId)===digest(t),'HOLDOUT_IDENTITY');}
 return {targets:[...prior.targets,...cohort],
 score(t:Target):Match{if(t.season!==2025)return prior.score(t);identity(t);if(scoreCache.has(t.fixtureId))return scoreCache.get(t.fixtureId)!;
  if(!archives.has(t.leagueId)){const source=meta.leagues.find(l=>l.leagueId===t.leagueId)!;const body=JSON.parse(bytes('fixtures-'+t.leagueId+'.raw.json',source.source.sourceHash).toString('utf8')) as {errors:object;response:ProviderFixture[]};requireRule(Object.keys(body.errors??{}).length===0&&Array.isArray(body.response),'PROVIDER_BODY');requireRule(new Set(body.response.map(r=>r.fixture.id)).size===body.response.length,'DUPLICATE_PROVIDER_ID');archives.set(t.leagueId,new Map(body.response.map(r=>[r.fixture.id,r])));}
  const r=archives.get(t.leagueId)!.get(t.fixtureId);requireRule(r&&r.league.id===t.leagueId&&r.league.season===2025&&new Date(r.fixture.date).toISOString()===t.kickoffUtc&&r.teams.home.id===t.homeTeamId&&r.teams.away.id===t.awayTeamId,'RAW_SCORE_IDENTITY');requireRule(r.fixture.status.short==='FT'&&/^Regular Season - ([1-9][0-9]*)$/.test(r.league.round),'RAW_SCORE_STAGE');const m={...t,homeGoals:r.score.fulltime.home,awayGoals:r.score.fulltime.away};validateMatch(m);scoreCache.set(t.fixtureId,m);return m;},
 feature(t:Target):FeatureRecord{if(t.season!==2025)return prior.feature(t);identity(t);if(featureCache.has(t.fixtureId))return featureCache.get(t.fixtureId)!;const m=meta.featureRecords.find(r=>r.fixtureId===t.fixtureId);requireRule(m&&m.leagueId===t.leagueId&&m.httpStatus===200,'HOLDOUT_FEATURE_METADATA');const body=JSON.parse(bytes('statistics-'+t.fixtureId+'.raw.json',m.sourceHash).toString('utf8'));const value={target:t,values:{xG:parseFeature(body,t,'xG'),shots:parseFeature(body,t,'shots'),sot:parseFeature(body,t,'sot')},sourceHash:m.sourceHash,providerFetchedAt:m.providerFetchedAt};featureCache.set(t.fixtureId,value);return value;}
 };
}
export type Data={targets:Target[];score:(t:Target)=>Match;feature:(t:Target)=>FeatureRecord};
/** Only selected pre-target rows are looked up; target values never reach the state builder. */
export function causalInputs(data:Data,t:Target){const selected=selectTargets(t,data.targets);return {base:selected.map(x=>data.score(x)),features:selected.map(x=>data.feature(x))};}
