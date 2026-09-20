/** Acquisition boundary; separate from frozen V4 observation windows and Prediction. */
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {requireProof,sha} from '../v4-prospective-evidence-v1/contracts';
import type {SquadReceipt} from '../v4-prospective-evidence-v1/membership';
export async function collectSquadMembership(q:{teamId:string;leagueId:string;season:string;cutoff:string;rights:{internalCollectionAuthorized:boolean;membershipEndpoints:string[]};localRawDir:string},key:string,transport:typeof fetch=fetch):Promise<SquadReceipt>{
 requireProof(q.rights.internalCollectionAuthorized&&q.rights.membershipEndpoints.includes('/players/squads'),'REGISTRY_COLLECTION_BLOCKED_BY_RIGHTS');
 requireProof(key.length>0&&[q.teamId,q.leagueId,q.season].every(x=>/^\d+$/.test(x)),'EXACT_IDS_REQUIRED');requireProof(Date.now()<Date.parse(q.cutoff),'CUTOFF');
 const response=await transport(`https://v3.football.api-sports.io/players/squads?team=${q.teamId}`,{headers:{'x-apisports-key':key},redirect:'error',signal:AbortSignal.timeout(15000)});requireProof(response.ok,'ROSTER_HTTP_ERROR');
 const raw=await response.json();const collectedAt=new Date().toISOString();requireProof(Date.now()<Date.parse(q.cutoff),'CUTOFF');requireProof(Object.keys(raw.errors??{}).length===0&&Array.isArray(raw.response)&&raw.response.length===1,'ROSTER_RESPONSE_INVALID');requireProof((raw.paging?.total??1)===1,'ROSTER_PAGINATION');
 const team=raw.response[0];requireProof(String(team.team?.id)===q.teamId&&Array.isArray(team.players),'TEAM_MISMATCH');
 const bytes=JSON.stringify(raw),sourceSha256=sha(bytes);mkdirSync(q.localRawDir,{recursive:true});const rawPath=join(q.localRawDir,`${q.teamId}-${sourceSha256}.json`);if(existsSync(rawPath))requireProof(readFileSync(rawPath,'utf8')===bytes+'\n','RAW_HASH_COLLISION');else writeFileSync(rawPath,bytes+'\n',{flag:'wx'});
 // Persist actual reception time before normalization can fail. Collapse only fully identical raw rows.
 const receipt:SquadReceipt={teamId:q.teamId,leagueId:q.leagueId,season:q.season,endpoint:'/players/squads',observedAt:collectedAt,collectedAt,sourceSha256,players:team.players.map((p:{id:number;name:string})=>({id:p.id,name:p.name}))};
 writeFileSync(join(q.localRawDir,`${q.teamId}-${collectedAt.replaceAll(':','-')}-receipt.json`),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
 const unique=new Map<number,{id:number;name:string}>();for(const p of team.players){const prior=unique.get(p.id);if(prior)requireProof(JSON.stringify(prior)===JSON.stringify(p),'CONFLICTING_PLAYER_ROWS');else unique.set(p.id,p);}
 return {...receipt,players:[...unique.values()].map(p=>({id:p.id,name:p.name}))};
}
