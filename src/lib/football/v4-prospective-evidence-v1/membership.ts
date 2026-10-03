/** /players/squads proves an observed roster only; never canonical identity or an interval. */
import {appendObservation,observationId,IDENTITY_CONTRACT,type Observation} from './identity-membership-v2';
import {requireProof,time} from './contracts';
export type SquadReceipt={teamId:string;leagueId:string;season:string;observedAt:string;collectedAt:string;sourceSha256:string;endpoint:'/players/squads';players:{id:number;name:string}[]};
export function populateMembership(receipts:SquadReceipt[],initial:ReadonlyArray<Observation>=[]):ReadonlyArray<Observation>{
 let registry=initial;
 for(const r of receipts){requireProof(r.endpoint==='/players/squads','CURRENT_ROSTER_ENDPOINT_REQUIRED');requireProof(time(r.observedAt)<=time(r.collectedAt),'RECEIPT_ORDER');requireProof(/^[a-f0-9]{64}$/.test(r.sourceSha256),'SOURCE_HASH_REQUIRED');requireProof(r.players.length>0,'EMPTY_ROSTER_UNRESOLVED');const seen=new Set<number>();
 for(const p of r.players){requireProof(Number.isSafeInteger(p.id)&&p.id>0,'PLAYER_ID_REQUIRED');requireProof(!seen.has(p.id),'DUPLICATE_PLAYER_ID');seen.add(p.id);
 registry=appendObservation(registry,{contractVersion:IDENTITY_CONTRACT,recordId:observationId([r.sourceSha256,p.id,r.teamId,r.observedAt,r.collectedAt,r.leagueId,r.season]),providerIdentity:{provider:'api-football',providerPlayerId:String(p.id),providerPlayerKey:`api-football:${p.id}`,status:'EXACT'},observedMembership:{teamProviderId:r.teamId,observedAt:r.observedAt,sourceSha256:r.sourceSha256,status:'OBSERVED'},canonicalMapping:{canonicalPlayerId:null,status:'UNRESOLVED'},context:{leagueId:r.leagueId,season:r.season,sourceProven:false},recordedAt:r.collectedAt,displayNameRaw:p.name,effectiveMembership:null});
 }}return registry;
}
