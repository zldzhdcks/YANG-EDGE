import audit from '../../../data/audits/2026-09-20-atletico-showcase-research-availability-v1.json';
import type {RichPreview} from '../football/official-canonical-v1/rich-preview';

export const SHOWCASE_TARGET='BETMAN-20260920-91';
export const SHOWCASE_DATE='2026-09-20';
export const SHOWCASE_ROUTE='/analysis/BETMAN-20260920-91?fromDate=2026-09-20';
export function isAtleticoShowcase(p:RichPreview){return p.targetId===SHOWCASE_TARGET&&p.fixtureId===1570394&&p.kickoffKst.slice(0,10)===SHOWCASE_DATE;}
export function engineLabFor(p:RichPreview){
 if(!isAtleticoShowcase(p)||p.canonicalPredictionId!==audit.canonicalPredictionId)throw Error('SHOWCASE_CANONICAL_MISMATCH');
 return{
  v1:{name:'V1 — Poisson Baseline',status:'OFFICIAL BASELINE',probabilities:p.officialV1},
  h2:{status:'RESEARCH_UNPROMOTED',currentMatch:audit.h2CurrentMatch,probabilities:null},
  v3:{status:'RESEARCH_CLOSED_UNPROMOTED',features:['xG','Total Shots','Shots on Goal'],currentMatch:audit.v3CurrentMatch,probabilities:null},
  v31:{status:'RESEARCH_CLOSED_UNPROMOTED',currentMatch:audit.v31CurrentMatch,probabilities:null},
  v4:{status:'IN DEVELOPMENT',phase:'0.5',playerRegistry:'READY',membership:'READY',xiFoundation:'READY',injuryStructure:'READY',confirmedXI:p.lineupStatus==='CONFIRMED'?'VERIFIED_EVIDENCE_AVAILABLE':'WAITING',playerImpact:'RESEARCH',replacementDelta:'RESEARCH',lineupStrengthDelta:'NOT YET PROMOTED',officialPrediction:'NOT IMPLEMENTED',probabilities:null},
  checkedAt:audit.auditedAt,
 };
}
