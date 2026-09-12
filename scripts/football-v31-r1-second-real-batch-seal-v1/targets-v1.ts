import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readSeal,digest,requireRule} from '../football-v31-r1-prospective-v1/store-v1';
import {validateTarget,type Target} from '../football-v31-r1-prospective-v1/frozen/scripts/football-v3-feature-research-v1/contracts-v1';
import {exactIdentity} from '../football-v31-r1-second-real-batch-preflight-v1/identity-v1';

export const PREFLIGHT_AUDIT_SHA='2fd09298fcf44340bf5818bcde6d19549201b6e803c82db1f24a4da62a638680';
export const PREFLIGHT_DISCOVERY_AT='2026-09-12T16:39:58.999Z';
export const BATCH_ID='SECOND_REAL_ONE_SHOT_V1';
export const READY_TARGETS:Target[]=[
 {fixtureId:1575159,leagueId:78,season:2026,kickoffUtc:'2026-09-13T13:30:00.000Z',homeTeamId:173,awayTeamId:175},
 {fixtureId:1570376,leagueId:140,season:2026,kickoffUtc:'2026-09-13T14:15:00.000Z',homeTeamId:539,awayTeamId:529},
 {fixtureId:1557404,leagueId:39,season:2026,kickoffUtc:'2026-09-13T15:30:00.000Z',homeTeamId:33,awayTeamId:50},
 {fixtureId:1550123,leagueId:135,season:2026,kickoffUtc:'2026-09-13T16:00:00.000Z',homeTeamId:492,awayTeamId:500},
];
export const FIRST_BATCH_IDS=[1550119,1575158,1575160,1575161,1575162,1575163,1557397,1557398,1557399,1557401,1557403,1570377,1550121,1557406,1570373,1575165,1550117,1557405,1570379,1570374];

type ReadyRow={fixtureId:number;league:number;season:number;kickoffUtc:string;homeTeamId:number;awayTeamId:number;className:string};

export function preflightAuditPath(){
 return join(fileURLToPath(new URL('../../',import.meta.url)),'data/audits/football-v31-r1-second-real-batch-preflight-v1.json');
}

export function asTarget(row:ReadyRow):Target{
 return {fixtureId:row.fixtureId,leagueId:row.league,season:row.season,kickoffUtc:row.kickoffUtc,homeTeamId:row.homeTeamId,awayTeamId:row.awayTeamId};
}

export function assertReadyTarget(target:Target){
 validateTarget(target);
 requireRule(READY_TARGETS.some(r=>exactIdentity(r,target)),'NON_READY_TARGET');
}

export function loadReadyTargets(file=preflightAuditPath()){
 const seal=readSeal<{discoveryAt:string;rows:ReadyRow[]}>(file);
 requireRule(seal.sha256===PREFLIGHT_AUDIT_SHA,'PREFLIGHT_AUDIT_HASH');
 requireRule(seal.payload.discoveryAt===PREFLIGHT_DISCOVERY_AT,'PREFLIGHT_DISCOVERY_AT');
 const ready=seal.payload.rows.filter(r=>r.className==='READY').map(asTarget);
 requireRule(ready.length===READY_TARGETS.length,'READY_COUNT');
 for(const target of ready){
  validateTarget(target);
  requireRule(READY_TARGETS.some(r=>exactIdentity(r,target)),'READY_IDENTITY_MISMATCH');
 }
 for(const expected of READY_TARGETS)requireRule(ready.some(r=>exactIdentity(r,expected)),'READY_IDENTITY_MISSING');
 requireRule(digest([...ready].sort((a,b)=>a.fixtureId-b.fixtureId))===digest([...READY_TARGETS].sort((a,b)=>a.fixtureId-b.fixtureId)),'READY_SET_HASH');
 return READY_TARGETS.map(t=>({...t}));
}
