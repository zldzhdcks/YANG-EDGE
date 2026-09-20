import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {digest} from '../src/lib/football/official-canonical-v1';
import {loadResearchExplorer} from '../src/lib/public-analysis/load-research-explorer';
process.env.YANG_EDGE_OWNER_PREVIEW='1';
const path='data/audits/2026-09-20-football-provider-identity-resolution-v1.json',a=JSON.parse(readFileSync(path,'utf8'));
assert(!a.finalizedAt,'FINALIZED_AUDIT_IMMUTABLE');
const data=loadResearchExplorer(a.batch,a.date);
const history=JSON.parse(readFileSync('../YANG-EDGE-INBOX/football-provider-identity-v1/2026-09-20/research/collection-audit.json','utf8'));
for(const r of a.rows){const d=data.details.find(d=>d.line.targetId===r.targetId)!;r.researchTierAfter=d.line.tier;r.researchGapReasons=d.depth?.gaps??[];r.researchObservedAt=d.line.previewAsOf;r.researchHistoryCounts=d.depth?.teams?.map(t=>({teamId:t.teamId,count:t.current.all.all.count}))??[];}
a.finalizedAt=new Date().toISOString();a.providerCalls=1+history.providerCalls;a.callBreakdown={identityMetadata:1,completedHistory:history.providerCalls};a.historyCollectionHash=digest(readFileSync('../YANG-EDGE-INBOX/football-provider-identity-v1/2026-09-20/research/collection-audit.json'));a.aliasRegistryHash=digest(readFileSync(a.registryFile));a.skippedResearch=history.skipped;a.research={standardBefore:2,basicBefore:29,standardAfter:a.rows.filter((r:any)=>r.researchTierAfter==='STANDARD').length,basicAfter:a.rows.filter((r:any)=>r.researchTierAfter==='BASIC').length,basicToStandard:a.rows.filter((r:any)=>r.researchTierBefore==='BASIC'&&r.researchTierAfter==='STANDARD').length,targetWithoutLine:31-a.rows.length};a.research.standardCoverageRate=100*a.research.standardAfter/31;a.engineChanged=false;a.weightsChanged=false;a.thresholdsChanged=false;a.featureSetChanged=false;a.oneOffHardcodeDefinition='Target-specific provider-ID assignments: none; reusable competition-scoped alias review records are registry data.';
writeFileSync(path,JSON.stringify(a,null,2)+'\n');console.log(JSON.stringify({identity:a.counts,registry:{newTeams:a.newTeamIdentities,newAliases:a.newAliases,reused:a.reusedIdentities},research:a.research,providerCalls:a.providerCalls}));
