import {applyFootballDepth} from './load-football-research-depth';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {selectProductionBatch,committedBytes} from '../research/terminal-decision/batch-selection';
import {researchTargetScopeLockRel,isResearchTargetScopeLockDocument} from '../research/daily-scope-lock/paths';
import {digest} from '../football/official-canonical-v1';
import {loadOwnerRichPreviews,ownerRichPreviewEnabled} from './load-owner-rich-preview';
import {researchTier,type ResearchLine} from './research-explorer-contract';
import type {RichPreview} from '../football/official-canonical-v1/rich-preview';
import {playerEvidenceFromContext} from '../football/official-canonical-v1/preview-player-context-v3';
import {safeResearchPlayers} from './research-player-safety';
const stable=(x:unknown):string=>JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export type ResearchDetail={line:ResearchLine;preview:RichPreview|null;players:any[];depth?:{teams:any[]|null;season:number|null;tables:any[];summary:string[];gaps:string[];recencyCheck:string}};
export function loadResearchExplorer(batch:string,date:string,cwd=process.cwd()){
 assert(ownerRichPreviewEnabled(),'LOCAL_OWNER_ONLY');assert(batch,'EXPLICIT_BATCH_REQUIRED');
 const selected=selectProductionBatch(cwd,date,batch),lockRel=researchTargetScopeLockRel(date),bytes=readFileSync(join(selected.root,lockRel));
 assert(bytes.equals(committedBytes(selected.root,lockRel)),'UNCOMMITTED_SCOPE');const lock=JSON.parse(bytes.toString());assert(isResearchTargetScopeLockDocument(lock),'INVALID_SCOPE');
 const sourceBytes=readFileSync(join(selected.root,lock.source.rel));assert.equal(digest(sourceBytes),lock.source.sha256,'SOURCE_HASH');assert(sourceBytes.equals(committedBytes(selected.root,lock.source.rel)),'UNCOMMITTED_SOURCE');
 const source=JSON.parse(sourceBytes.toString());assert.equal(source.dateKst,date);assert.equal(lock.targets.length,lock.targetCount);assert.equal(new Set(lock.targets.map((t:any)=>t.targetId)).size,lock.targetCount,'DUPLICATE_TARGET');
 const statuses=new Map<string,string>(),decisionDir=join(selected.root,'data/research/terminal-decisions',date);
 if(existsSync(decisionDir))for(const name of readdirSync(decisionDir)){const f=join(decisionDir,name,'decision.json');if(!existsSync(f))continue;const e=JSON.parse(readFileSync(f,'utf8'));assert.equal(digest(stable(e.payload)),e.sha256,'DECISION_HASH');assert.equal(e.payload.scopeSha256,selected.binding!.scopeSha256);assert(!statuses.has(e.payload.targetId),'DUPLICATE_DECISION');statuses.set(e.payload.targetId,e.payload.type==='PASS'?`PASS · ${e.payload.reason}`:'SEALED_PREDICTION_PENDING_CANONICAL_LINK');}
 let rich:ReturnType<typeof loadOwnerRichPreviews>=[];let richError=false;try{rich=loadOwnerRichPreviews(date,cwd);}catch{richError=true;}
 const details:ResearchDetail[]=lock.targets.map((t:any)=>{
  const sourceMatches=source.games.filter((g:any)=>g.operatorSlateGameId===t.operatorSlateGameId);assert.equal(sourceMatches.length,1,'SOURCE_IDENTITY');const g=sourceMatches[0];for(const k of ['sport','competitionNameRaw','homeTeamRaw','awayTeamRaw','scheduledStartTimeKst'])assert.equal(t[k],g[k],'LOCK_SOURCE_IDENTITY');
  const matches=rich.filter(r=>r.preview.targetId===t.targetId);assert(matches.length<=1,'AMBIGUOUS_PREVIEW');let preview:RichPreview|null=matches[0]?.preview??null;const quality:string[]=[];
  try{if(preview){
   const bridgeDir=join(selected.root,'data/research/football/operator-identity-bridges',selected.binding!.scopeSha256);let exact=false;
   if(existsSync(bridgeDir))for(const name of readdirSync(bridgeDir)){const e=JSON.parse(readFileSync(join(bridgeDir,name),'utf8')),b=e.payload.binding;if(b.targetId!==t.targetId)continue;assert.equal(digest(stable(e.payload)),e.sha256,'BRIDGE_HASH');const s=JSON.parse(e.payload.sourceUtf8);assert.equal(digest(e.payload.sourceUtf8),b.evidenceSha256);assert(b.scopeSha256===selected.binding!.scopeSha256&&b.reviewStatus==='VERIFIED'&&b.homeRaw===t.homeTeamRaw&&b.awayRaw===t.awayTeamRaw&&b.competitionRaw===t.competitionNameRaw&&Date.parse(b.scheduledStart)===Date.parse(t.scheduledStartTimeKst),'BRIDGE_IDENTITY');assert(b.providerFixtureId===preview.fixtureId&&b.homeProviderId===preview.teams[0].id&&b.awayProviderId===preview.teams[1].id&&b.leagueId===preview.leagueId,'PREVIEW_IDENTITY');assert(s.status==='NS'&&s.fixtureId===b.providerFixtureId&&s.homeTeamId===b.homeProviderId&&s.awayTeamId===b.awayProviderId&&Date.parse(s.observedAt)<Date.parse(t.scheduledStartTimeKst),'SCHEDULE_PROVENANCE');exact=true;}
   if(!exact){preview=null;quality.push('EXACT_PROVIDER_BRIDGE_NOT_AVAILABLE');}
  }
  }catch{preview=null;quality.push('PREVIEW_PROVENANCE_INVALID');}
  if(richError)quality.push('PREVIEW_EVIDENCE_UNAVAILABLE');
  const current=preview?.recency?.teams??preview?.seasonSplit?.teams;const hasCurrent=!!current?.every((x:any)=>x.current?.all?.all?.count>0);
  const probability=preview?{home:preview.officialV1.pHome,draw:preview.officialV1.pDraw,away:preview.officialV1.pAway}:null;
  const available=['HUMAN_VERIFIED_FIXTURE',...(hasCurrent?['CURRENT_SEASON','RECENT_FORM','HOME_AWAY']:[]),...(preview?['PLAYER_CONTEXT','CANONICAL_V1','MATCH_FLOW']:[])];
  const missing=[...(!hasCurrent?['CURRENT_SEASON','RECENT_FORM','HOME_AWAY']:[]),...(!preview?['PLAYER_CONTEXT','MODEL_PROBABILITY','MATCH_FLOW']:[]),'CONFIRMED_LINEUP','COMPLETE_AVAILABILITY','VERIFIED_RECENT_PLAYER_IMPACT'];
  const tier=researchTier({current:hasCurrent,recent:hasCurrent,venue:hasCurrent,players:!!preview,lineup:preview?.lineupStatus==='CONFIRMED',availability:preview?.availabilityStatus==='VERIFIED',probability:!!probability,flow:!!preview?.expectedFlow,engine:true});
  return{preview,players:[],line:{targetId:t.targetId,sport:t.sport,competition:t.competitionNameRaw,home:t.homeTeamRaw,away:t.awayTeamRaw,kickoff:t.scheduledStartTimeKst,tier,modelStatus:probability?'OFFICIAL_V1_SEALED':statuses.get(t.targetId)??'NOT_AVAILABLE',probability,engineAsOf:preview?.officialV1.createdAt??null,previewAsOf:preview?.recency?.previewAsOf??preview?.createdAt??null,lineupStatus:preview?.lineupStatus??'NOT_AVAILABLE',availabilityStatus:preview?.availabilityStatus??'NOT_AVAILABLE',dataAvailable:available,dataMissing:missing,quality:[...quality,...missing.map(m=>m+' 미확보')],pick:null,market:preview?.odds?{left:preview.odds.left??null,middle:preview.odds.middle??null,right:preview.odds.right??null,mapping:preview.odds.mapping}:null}};
 });
 // Already observed market evidence is display-only and joined by the committed evidence ID.
 try{const admission=JSON.parse(committedBytes(selected.root,'admission-audit.json').toString());
 const marketBytes=readFileSync(join(cwd,admission.sourceRel));assert.equal(digest(marketBytes),admission.sourceSha256,'MARKET_SOURCE_HASH');
 const marketSource=JSON.parse(marketBytes.toString());const links=JSON.parse(committedBytes(selected.root,'identity-evidence-links.json').toString());
 const odd=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>1?v:null;
 for(const d of details){const link=links.filter((x:any)=>x.operatorSlateGameId===d.line.targetId);assert.equal(link.length,1,'MARKET_LINK');
  const rows=marketSource.rows.filter((r:any)=>r.gameEvidenceId===link[0].gameEvidenceId);
  for(const r of rows)assert(r.homeTeamRaw===d.line.home&&r.awayTeamRaw===d.line.away&&r.sport===d.line.sport&&Date.parse(r.scheduledStartTimeKst)===Date.parse(d.line.kickoff),'MARKET_IDENTITY');
  d.line.observedMarkets=rows.map((r:any)=>({number:r.visibleGameNumber,type:r.marketType,line:r.line??null,left:odd(r.odds.left),middle:odd(r.odds.middle),right:odd(r.odds.right),mapping:r.selectionMappingStatus}));
  if(rows.length)d.line.dataAvailable.push('OBSERVED_MARKET_VALUES');
 }
 }catch{for(const d of details){d.line.observedMarkets=[];d.line.quality.push('MARKET_EVIDENCE_UNAVAILABLE');}}
 // No provider calls: project already received player counters for the two rich previews.
 const privateRoot=resolve(cwd,'../YANG-EDGE-INBOX/rich-preview-v2',date),contextPath=join(privateRoot,'context.json');
 try{if(existsSync(contextPath)&&details.some(d=>d.preview)){
  const ctx=JSON.parse(readFileSync(contextPath,'utf8')),registry=JSON.parse(readFileSync(join(selected.root,'priority-readiness-v1/player-registry.json'),'utf8'));
  for(const r of ctx.receipts)assert.equal(digest(readFileSync(join(privateRoot,r.sha256+'.json'))),r.sha256,'PLAYER_RAW_HASH');
  for(const d of details)if(d.preview){d.players=d.preview.teams.map(team=>{const c=ctx.teams.find((x:any)=>x.teamId===team.id&&x.fixtureId===d.preview!.fixtureId);if(!c)return{teamId:team.id,name:team.name,roles:null};const candidates=playerEvidenceFromContext(c,registry,d.preview!.createdAt);return{teamId:team.id,name:team.name,roles:safeResearchPlayers(candidates),observedAt:c.playerReceipts.map((r:any)=>r.providerFetchedAt).sort().at(-1)};});}
 }
 }catch{for(const d of details){d.players=[];d.line.quality.push('PLAYER_EVIDENCE_UNAVAILABLE');}}
 applyFootballDepth(details,cwd,selected.binding!.scopeSha256);
 return{batch,date,scopeHash:selected.binding!.scopeSha256,lines:details.map(d=>d.line),details,total:lock.targetCount};
}
