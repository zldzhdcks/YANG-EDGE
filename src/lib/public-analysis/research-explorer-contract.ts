export const TODAY_RESEARCH_BATCH='round-111-odds-new-v1';
export const TODAY_RESEARCH_DATE='2026-09-20';
export type Tier='FULL'|'STANDARD'|'BASIC';
export type ResearchLine={targetId:string;sport:string;competition:string;home:string;away:string;kickoff:string;tier:Tier;modelStatus:string;probability:{home:number;draw:number;away:number}|null;engineAsOf:string|null;previewAsOf:string|null;lineupStatus:string;availabilityStatus:string;dataAvailable:string[];dataMissing:string[];quality:string[];pick:null;summary?:string;currentForm?:string[];recentForm?:string[];recencyAdded?:{teamId:number;added:number}[];observedMarkets?:{number:string;type:string;line:number|null;left:number|null;middle:number|null;right:number|null;mapping:string}[];market:{left:number|null;middle:number|null;right:number|null;mapping:string}|null};
export function researchTier(e:{current:boolean;recent:boolean;venue:boolean;players:boolean;lineup:boolean;availability:boolean;probability:boolean;flow:boolean;engine:boolean}):Tier{
 if(Object.values(e).every(Boolean))return'FULL';
 return (e.current||e.recent)&&(e.venue||e.players)&&e.engine?'STANDARD':'BASIC';
}
export type ExplorerQuery={sport?:string;competition?:string;tier?:string;sort?:string};
export function queryResearch(lines:ResearchLine[],query:ExplorerQuery){
 const selected=lines.filter(l=>(!query.sport||l.sport===query.sport)&&(!query.competition||l.competition===query.competition)&&(!query.tier||l.tier===query.tier));
 const key=query.sort==='home'?'home':query.sort==='draw'?'draw':query.sort==='away'?'away':null;
 return selected.sort((a,b)=>{if(key){const x=a.sport==='SOCCER'?a.probability?.[key]:null,y=b.sport==='SOCCER'?b.probability?.[key]:null;if(x==null&&y!=null)return 1;if(x!=null&&y==null)return-1;if(x!=null&&y!=null&&x!==y)return y-x;}return Date.parse(a.kickoff)-Date.parse(b.kickoff)||a.targetId.localeCompare(b.targetId);});
}
export const researchHref=(id:string,batch=TODAY_RESEARCH_BATCH,date=TODAY_RESEARCH_DATE)=>`/research/${encodeURIComponent(id)}?batch=${encodeURIComponent(batch)}&date=${date}`;
