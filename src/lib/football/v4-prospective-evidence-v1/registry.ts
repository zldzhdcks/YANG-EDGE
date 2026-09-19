import {id,requireProof,stable,time} from './contracts';
export type PlayerRecord={recordId:string;provider:string;providerPlayerId:string;canonicalPlayerId:string;displayNameRaw:string;teamProviderId:string;competitionProviderId:string;season:string;validFrom:string;validTo:string|null;verificationStatus:'EXACT'|'UNRESOLVED'|'CONFLICT';recordedAt:string;sourceSha256:string;supersedesId?:string};
export type Registry=ReadonlyArray<Readonly<PlayerRecord>>;
function active(r:Registry,knownAt:string){const visible=r.filter(x=>time(x.recordedAt)<=time(knownAt));const superseded=new Set(visible.map(x=>x.supersedesId));return visible.filter(x=>!superseded.has(x.recordId));}
export function appendPlayer(r:Registry,row:PlayerRecord):Registry{
 requireProof([row.recordId,row.provider,row.providerPlayerId,row.canonicalPlayerId,row.teamProviderId,row.competitionProviderId,row.season].every(id),'IDENTITY_REQUIRED');
 requireProof(/^[a-f0-9]{64}$/.test(row.sourceSha256),'REGISTRY_SOURCE_HASH');time(row.recordedAt);time(row.validFrom);if(row.validTo)requireProof(time(row.validTo)>time(row.validFrom),'INVALID_INTERVAL');
 const existing=r.find(x=>x.recordId===row.recordId);if(existing){requireProof(stable(existing)===stable(row),'REGISTRY_CONFLICT');return r;}
 requireProof(!r.length||time(row.recordedAt)>=Math.max(...r.map(x=>time(x.recordedAt))),'REGISTRY_BACKDATE');
 const prior=row.supersedesId?r.find(x=>x.recordId===row.supersedesId):null;
 if(row.supersedesId){requireProof(prior&&!r.some(x=>x.supersedesId===prior.recordId),'INVALID_SUPERSESSION');for(const k of ['provider','providerPlayerId','canonicalPlayerId','teamProviderId','competitionProviderId','season','validFrom'] as const)requireProof(prior[k]===row[k],'IDENTITY_REWRITE');requireProof(prior.validTo===null&&row.validTo!==null,'ONLY_CLOSE_OPEN_MEMBERSHIP');}
 for(const x of r)if(x.provider===row.provider&&x.providerPlayerId===row.providerPlayerId)requireProof(x.canonicalPlayerId===row.canonicalPlayerId,'REGISTRY_CONFLICT');
 for(const x of active(r,row.recordedAt).filter(x=>x.recordId!==row.supersedesId))if(x.provider===row.provider&&x.providerPlayerId===row.providerPlayerId&&x.competitionProviderId===row.competitionProviderId&&x.season===row.season){const end=x.validTo?time(x.validTo):Infinity,newEnd=row.validTo?time(row.validTo):Infinity;requireProof(Math.max(time(x.validFrom),time(row.validFrom))>=Math.min(end,newEnd),'OVERLAPPING_MEMBERSHIP');}
 return Object.freeze([...r,Object.freeze({...row})]);
}
export function resolvePlayer(r:Registry,q:{provider:string;playerId:string;teamId:string;competitionId:string;season:string;at:string;knownAt:string}):{status:'EXACT'|'UNRESOLVED'|'CONFLICT';canonicalPlayerId:string|null}{
 const matches=active(r,q.knownAt).filter(x=>x.provider===q.provider&&x.providerPlayerId===q.playerId&&x.teamProviderId===q.teamId&&x.competitionProviderId===q.competitionId&&x.season===q.season&&time(x.validFrom)<=time(q.at)&&(!x.validTo||time(q.at)<time(x.validTo)));
 if(matches.length>1||matches.some(x=>x.verificationStatus==='CONFLICT'))return{status:'CONFLICT',canonicalPlayerId:null};if(matches.length!==1||matches[0].verificationStatus!=='EXACT')return{status:'UNRESOLVED',canonicalPlayerId:null};return{status:'EXACT',canonicalPlayerId:matches[0].canonicalPlayerId};
}
