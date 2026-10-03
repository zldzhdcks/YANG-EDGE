/** Versioned interpretation. Roster observations never establish effective intervals. */
import {requireProof,sha,stable,time} from './contracts';
import type {PlayerRecord} from './registry';
export const IDENTITY_CONTRACT='football-v4-player-identity-membership-v2' as const;
export type Observation={contractVersion:typeof IDENTITY_CONTRACT;recordId:string;providerIdentity:{provider:string;providerPlayerId:string;providerPlayerKey:string;status:'EXACT'|'UNRESOLVED'|'CONFLICT'};observedMembership:{teamProviderId:string;observedAt:string;sourceSha256:string;status:'OBSERVED'|'UNRESOLVED'|'CONFLICT'};canonicalMapping:{canonicalPlayerId:null;status:'UNRESOLVED'};context:{leagueId:string;season:string;sourceProven:false};recordedAt:string;displayNameRaw:string;effectiveMembership:null};
export type EvidenceRegistry=ReadonlyArray<Readonly<Observation|PlayerRecord>>;
export type MappingProof={provider:string;providerPlayerId:string;canonicalPlayerId:string;evidenceSha256:string;recordedAt:string};
const hash=(s:string)=>/^[a-f0-9]{64}$/.test(s);
const numeric=(s:string)=>typeof s==='string'&&/^[1-9]\d*$/.test(s)&&Number.isSafeInteger(Number(s));
export function interpret(row:Observation|PlayerRecord):Observation{
 if('contractVersion' in row){assertObservation(row);return row;}
 // A legacy label, interval or EXACT flag is not independent mapping evidence.
 requireProof(numeric(row.providerPlayerId)&&numeric(row.teamProviderId)&&hash(row.sourceSha256),'LEGACY_IDENTITY_SCHEMA');
 time(row.recordedAt);time(row.validFrom);
 return {contractVersion:IDENTITY_CONTRACT,recordId:row.recordId,providerIdentity:{provider:row.provider,providerPlayerId:row.providerPlayerId,providerPlayerKey:row.provider+':'+row.providerPlayerId,status:row.verificationStatus},observedMembership:{teamProviderId:row.teamProviderId,observedAt:row.validFrom,sourceSha256:row.sourceSha256,status:row.verificationStatus==='EXACT'?'OBSERVED':row.verificationStatus},canonicalMapping:{canonicalPlayerId:null,status:'UNRESOLVED'},context:{leagueId:row.competitionProviderId,season:row.season,sourceProven:false},recordedAt:row.recordedAt,displayNameRaw:row.displayNameRaw,effectiveMembership:null};
}
export function assertObservation(r:Observation){
 requireProof(r.contractVersion===IDENTITY_CONTRACT&&typeof r.recordId==='string'&&r.recordId.length>0,'IDENTITY_CONTRACT');
 const p=r.providerIdentity,m=r.observedMembership;
 requireProof(p.provider==='api-football'&&numeric(p.providerPlayerId)&&p.providerPlayerKey===p.provider+':'+p.providerPlayerId&&['EXACT','UNRESOLVED','CONFLICT'].includes(p.status),'PROVIDER_IDENTITY_SCHEMA');
 requireProof(numeric(m.teamProviderId)&&hash(m.sourceSha256)&&['OBSERVED','UNRESOLVED','CONFLICT'].includes(m.status),'OBSERVATION_SCHEMA');
 requireProof(time(m.observedAt)<=time(r.recordedAt),'OBSERVATION_TIME');
 requireProof(r.canonicalMapping.status==='UNRESOLVED'&&r.canonicalMapping.canonicalPlayerId===null,'MAPPING_PROOF_REQUIRED');
 requireProof(r.effectiveMembership===null&&r.context.sourceProven===false&&numeric(r.context.leagueId)&&/^\d{4}$/.test(r.context.season),'CONTEXT_NOT_SOURCE_PROOF');
}
export function appendObservation(rows:ReadonlyArray<Observation>,r:Observation):ReadonlyArray<Observation>{
 assertObservation(r);const existing=rows.find(x=>x.recordId===r.recordId);if(existing){requireProof(stable(existing)===stable(r),'OBSERVATION_REWRITE');return rows;}
 requireProof(rows.every(x=>time(x.recordedAt)<=time(r.recordedAt)),'OBSERVATION_BACKDATE');
 return [...rows,JSON.parse(stable(r)) as Observation];
}
type Query={provider:string;playerId:string;knownAt:string};
function visible(rows:EvidenceRegistry,q:Query){return rows.map(interpret).filter(r=>r.providerIdentity.provider===q.provider&&r.providerIdentity.providerPlayerId===q.playerId&&time(r.recordedAt)<=time(q.knownAt)&&time(r.observedMembership.observedAt)<=time(q.knownAt));}
export function resolveProviderPlayerIdentity(rows:EvidenceRegistry,q:Query){
 const found=visible(rows,q),conflict=found.some(r=>r.providerIdentity.status==='CONFLICT');
 const status=conflict?'CONFLICT':found.some(r=>r.providerIdentity.status==='EXACT')?'EXACT':'UNRESOLVED';
 return {status,providerPlayerKey:status==='EXACT'?q.provider+':'+q.playerId:null,canonicalPlayerId:null};
}
export function resolveObservedMembership(rows:EvidenceRegistry,q:Query&{teamId:string;observedAt?:string}){
 const observations=visible(rows,q).filter(r=>r.observedMembership.teamProviderId===q.teamId&&(!q.observedAt||time(r.observedMembership.observedAt)===time(q.observedAt)));
 const conflicting=observations.some(r=>r.observedMembership.status==='CONFLICT'||visible(rows,q).some(other=>time(other.observedMembership.observedAt)===time(r.observedMembership.observedAt)&&other.observedMembership.teamProviderId!==q.teamId));
 return {status:conflicting?'CONFLICT':observations.some(r=>r.observedMembership.status==='OBSERVED')?'OBSERVED':'UNRESOLVED',observations:observations.map(r=>({...r.observedMembership})),effectiveMembershipReady:false,futureMembershipVerified:false,competitionRegistrationVerified:false};
}
export function resolveEffectiveMembership(_rows:EvidenceRegistry,_q:Query&{teamId:string;at:string}){return {status:'UNRESOLVED',reason:'NO_EFFECTIVE_INTERVAL_PROOF',futureMembershipVerified:false} as const;}
export function resolveCanonicalPlayerMapping(proofs:ReadonlyArray<MappingProof>,q:Query){
 const matches=proofs.filter(p=>p.provider===q.provider&&p.providerPlayerId===q.playerId&&time(p.recordedAt)<=time(q.knownAt));
 if(!matches.length)return {status:'UNRESOLVED',canonicalPlayerId:null} as const;
 for(const p of matches)requireProof(numeric(p.providerPlayerId)&&hash(p.evidenceSha256)&&typeof p.canonicalPlayerId==='string'&&p.canonicalPlayerId.trim().length>0&&p.canonicalPlayerId!==p.providerPlayerId&&p.canonicalPlayerId!==p.provider+':'+p.providerPlayerId,'CANONICAL_MAPPING_PROOF_REQUIRED');
 const ids=new Set(matches.map(p=>p.canonicalPlayerId));return ids.size===1?{status:'MATCHED' as const,canonicalPlayerId:matches[0].canonicalPlayerId}:{status:'CONFLICT' as const,canonicalPlayerId:null};
}
export function requireCanonicalPlayerMapping(proofs:ReadonlyArray<MappingProof>,q:Query){const r=resolveCanonicalPlayerMapping(proofs,q);requireProof(r.status==='MATCHED','CANONICAL_MAPPING_REQUIRED');return r;}
export function observationId(value:unknown){return sha(stable([IDENTITY_CONTRACT,value]));}
