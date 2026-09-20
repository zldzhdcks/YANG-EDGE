/** Current-roster evidence only. Names are labels, never identity or transfer evidence. */
import {appendPlayer,type Registry,type PlayerRecord} from './registry';
import {requireProof,sha,stable,time} from './contracts';
export type SquadReceipt={teamId:string;leagueId:string;season:string;observedAt:string;collectedAt:string;sourceSha256:string;endpoint:'/players/squads';players:{id:number;name:string}[]};
export function populateMembership(receipts:SquadReceipt[],initial:Registry=[]):Registry{
 let registry=initial;
 for(const r of receipts){requireProof(r.endpoint==='/players/squads','CURRENT_ROSTER_ENDPOINT_REQUIRED');requireProof(time(r.observedAt)<=time(r.collectedAt),'RECEIPT_ORDER');requireProof(/^[a-f0-9]{64}$/.test(r.sourceSha256),'SOURCE_HASH_REQUIRED');requireProof(r.players.length>0,'EMPTY_ROSTER_UNRESOLVED');const seen=new Set<number>();
  for(const p of r.players){requireProof(Number.isSafeInteger(p.id)&&p.id>0,'PLAYER_ID_REQUIRED');requireProof(!seen.has(p.id),'DUPLICATE_PLAYER_ID');seen.add(p.id);
   const row:PlayerRecord={recordId:sha(stable([r.sourceSha256,p.id,r.teamId,r.leagueId,r.season])),provider:'api-football',providerPlayerId:String(p.id),canonicalPlayerId:`api-football:${p.id}`,displayNameRaw:p.name,teamProviderId:r.teamId,competitionProviderId:r.leagueId,season:r.season,validFrom:r.observedAt,validTo:null,verificationStatus:'EXACT',recordedAt:r.collectedAt,sourceSha256:r.sourceSha256};
   registry=appendPlayer(registry,row);
  }
 }
 return registry;
}
