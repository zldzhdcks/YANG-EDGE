/** Append-only schedule evidence. Historical timestamps must come from sealed run evidence. */
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {envelope,readSealed,writeOnce,validateFixture,type Fixture} from './football-forward-shadow-v1';

export function observeSchedule(root:string,f:Fixture,sourceHash:string,recordedAt=Date.now()){
  validateFixture(f);assert.match(sourceHash,/^[a-f0-9]{64}$/);
  assert.ok(Date.parse(f.scheduleFetchedAt)<=recordedAt,'FUTURE_SCHEDULE_OBSERVATION');
  const dir=join(root,'MODEL_FORWARD','schedule-ledger',String(f.fixtureId));mkdirSync(join(dir,'observations'),{recursive:true});
  const firstFile=join(dir,'first.json');
  if(!existsSync(firstFile)){
    const first=envelope({fixtureId:f.fixtureId,leagueId:f.leagueId,kickoffUtc:f.kickoffUtc,firstObservedAt:f.scheduleFetchedAt,firstSourceHash:sourceHash,recordedAt:new Date(recordedAt).toISOString()});
    try{writeOnce(firstFile,JSON.stringify(first,null,2)+'\n');}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
  }
  const first=readSealed(firstFile).payload;assert.equal(first.leagueId,f.leagueId,'LEDGER_IDENTITY_CONFLICT');
  assert.ok(Date.parse(first.firstObservedAt)<=Date.parse(f.scheduleFetchedAt),'EARLIER_OBSERVATION_REQUIRES_REVIEW');
  const observation=envelope({fixtureId:f.fixtureId,leagueId:f.leagueId,kickoffUtc:f.kickoffUtc,firstObservedAt:first.firstObservedAt,latestObservedAt:f.scheduleFetchedAt,firstSourceHash:first.firstSourceHash,sourceHash,schedule:f});
  const file=join(dir,'observations',observation.sha256+'.json');
  if(existsSync(file))assert.equal(readSealed(file).sha256,observation.sha256);else writeOnce(file,JSON.stringify(observation,null,2)+'\n');
  return first as {fixtureId:number;leagueId:number;kickoffUtc:string;firstObservedAt:string;firstSourceHash:string};
}

export function scheduleState(root:string,fixtureId:number){
  const dir=join(root,'MODEL_FORWARD','schedule-ledger',String(fixtureId));
  const first=readSealed(join(dir,'first.json')).payload;
  const observations=readdirSync(join(dir,'observations')).sort().map(n=>readSealed(join(dir,'observations',n)));
  assert.ok(observations.length,'INCOMPLETE_SCHEDULE_LEDGER');
  observations.sort((a,b)=>a.payload.latestObservedAt.localeCompare(b.payload.latestObservedAt)||a.sha256.localeCompare(b.sha256));
  return {first,latest:observations.at(-1)!.payload,observations};
}

export function restoreScheduleLedger(root:string,now=Date.now()){
  const runs=join(root,'MODEL_FORWARD','runs');if(!existsSync(runs))return;
  const entries:{f:Fixture;sourceHash:string}[]=[];
  for(const n of readdirSync(runs).filter(n=>n.endsWith('-schedule.json'))){const source=readSealed(join(runs,n));for(const f of source.payload.fixtures)entries.push({f,sourceHash:source.sha256});}
  entries.sort((a,b)=>a.f.scheduleFetchedAt.localeCompare(b.f.scheduleFetchedAt)||a.f.fixtureId-b.f.fixtureId);
  for(const e of entries)observeSchedule(root,e.f,e.sourceHash,now);
}
