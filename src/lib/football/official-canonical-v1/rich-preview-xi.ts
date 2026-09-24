/** Append-only editorial update from the existing V4 evidence contract. No collection. */
import assert from 'node:assert/strict';
import {validateXI,validateInjuries} from '../v4-prospective-evidence-v1/validate';
import {temporal,sha,stable,type Envelope,type Context} from '../v4-prospective-evidence-v1/contracts';
import type {Registry} from '../v4-prospective-evidence-v1/registry';
import type {RichPreview} from './rich-preview';
import {readPregame} from '../v4-prospective-evidence-v1/projection';
export function withVerifiedXI(previous:RichPreview,e:Envelope,registry:Registry,now:string,previousHash:string,injury?:Envelope){
 assert(e.sourceType==='XI'&&['VALID','CONFIRMED_COMPLETE'].includes(e.validationStatus)&&e.identityStatus==='EXACT'&&e.temporalStatus==='SAFE'&&temporal(e),'VALID_XI_REQUIRED');
 assert(e.targetId===previous.targetId&&e.providerFixtureId===String(previous.fixtureId)&&e.competitionProviderId===String(previous.leagueId),'XI_IDENTITY');
 assert(Date.parse(now)<Date.parse(previous.kickoffKst)&&Date.parse(now)>=Date.parse(e.collectedAt)&&Date.parse(now)>Date.parse(previous.createdAt),'XI_UPDATE_TIME');
 assert(Date.parse(e.scheduledStart)===Date.parse(previous.kickoffKst),'XI_START_TIME');
 const payload=e.payload as {registryHash:string;season:string};assert(payload.registryHash===sha(stable(registry)),'XI_HASH');
 assert(String(payload.season)===String(previous.season),'XI_SEASON');
 const c={...e,providerFixtureId:String(previous.fixtureId),competitionProviderId:String(previous.leagueId),season:String(previous.season),homeTeamId:String(previous.teams[0].id),awayTeamId:String(previous.teams[1].id)} as Context;
 const x=readPregame(e,c);assert(x.sourceType==='XI','XI_SOURCE');
 assert(validateXI(x,c,registry).status==='CONFIRMED_COMPLETE','XI_REGISTRY_VALIDATION');
 const lineups=x.teams.map(t=>({teamId:Number(t.teamId),formation:t.formation,starters:t.starters.map(p=>({id:Number(p.playerId),name:registry.find(r=>r.providerPlayerId===p.playerId&&r.teamProviderId===t.teamId)!.displayNameRaw,position:p.position??null})),bench:t.substitutes.map(p=>({id:Number(p.playerId),name:registry.find(r=>r.providerPlayerId===p.playerId&&r.teamProviderId===t.teamId)!.displayNameRaw}))}));
 const absences:{playerId:string;name:string;status:'OUT'|'UNKNOWN';reason:string}[]=[];
 if(injury){assert(injury.sourceType==='INJURY'&&injury.validationStatus==='VALID'&&injury.identityStatus==='EXACT'&&injury.temporalStatus==='SAFE'&&temporal(injury),'VALID_INJURY_REQUIRED');assert(injury.targetId===e.targetId&&injury.providerFixtureId===e.providerFixtureId&&injury.scopeIdentity===e.scopeIdentity&&Date.parse(injury.scheduledStart)===Date.parse(e.scheduledStart)&&Date.parse(injury.collectedAt)<=Date.parse(now),'INJURY_IDENTITY_TIME');const ip=injury.payload as {registryHash:string};assert(ip.registryHash===sha(stable(registry)),'INJURY_HASH');const safeInjury=readPregame(injury,c);assert(safeInjury.sourceType==='INJURY','INJURY_SOURCE');const rows=safeInjury.rows;assert(validateInjuries(rows,c,registry).status==='VALID','INJURY_REGISTRY');for(const r of rows){const out=r.type==='Missing Fixture'||r.type==='Suspension'||r.reason==='Suspended';assert(!out||!lineups.some((t:any)=>t.starters.some((s:any)=>String(s.id)===r.playerId)),'XI_ABSENCE_CONFLICT');absences.push({playerId:r.playerId,name:registry.find(x=>x.providerPlayerId===r.playerId&&x.teamProviderId===r.teamId)!.displayNameRaw,status:out?'OUT':'UNKNOWN',reason:r.reason});}}
 const narrative=lineups.map((t:any)=>`${previous.teams.find(v=>v.id===t.teamId)!.name}: ${t.formation??'포메이션 미표시'} · 선발 ${t.starters.map((v:any)=>v.name).join(', ')}. 벤치 ${t.bench.map((v:any)=>v.name).join(', ')||'명단 미표시'}.`).join(' ')+(absences.length?' 가용 선수 관측: '+absences.map(x=>`${x.name} ${x.status} (${x.reason})`).join('; '):'');
 return{...previous,version:previous.version+1,createdAt:now,cutoffAt:now,status:'PREVIEW_XI_AVAILABLE',lineupStatus:'CONFIRMED',previousHash,revisionReason:'VALID_PROSPECTIVE_XI_OBSERVED',xiEvidenceId:e.evidenceId,xiSourceHash:e.sourceArtifactSha256,lineups,absences,injuryEvidenceId:injury?.evidenceId??null,sections:previous.sections.map(s=>s.title==='LINEUP / ABSENCES'?{...s,text:narrative}:s),dataQuality:previous.dataQuality.map(s=>s.startsWith('Starting XI:')?'Starting XI: CONFIRMED · '+e.observedAt:s.startsWith('Injuries /')&&injury?'Injuries / suspensions: 개별 관측 확보 · 전체 가용 상태 UNKNOWN':s),
  teams:previous.teams.map(t=>({...t,keyPlayers:t.keyPlayers.map(k=>({...k,status:lineups.find((l:any)=>l.teamId===t.id)!.starters.some((s:any)=>s.id===k.providerPlayerId)?'CONFIRMED_STARTER' as const:absences.some(a=>a.playerId===String(k.providerPlayerId)&&a.status==='OUT')?'UNAVAILABLE' as const:k.status}))})),
  confirmedKeyPlayerIds:previous.teams.flatMap(t=>t.keyPlayers.filter(k=>lineups.find((l:any)=>l.teamId===t.id)!.starters.some((s:any)=>s.id===k.providerPlayerId)).map(k=>k.providerPlayerId))};
}
