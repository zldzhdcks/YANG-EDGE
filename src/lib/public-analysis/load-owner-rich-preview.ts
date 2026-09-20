/** Server-side, local owner display only. Never bundle private evidence into public builds. */
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,join,basename} from 'node:path';
import {canonicalForFixture,digest} from '../football/official-canonical-v1';
import type {RichPreview} from '../football/official-canonical-v1/rich-preview';
import type {PublicGameAnalysisViewV1} from '../../types/public-game-analysis-view';
import {unresolvedPublicView} from './project-fallbacks';

export function ownerRichPreviewEnabled(){return process.env.NODE_ENV!=='production'&&process.env.YANG_EDGE_OWNER_PREVIEW==='1';}
export function loadOwnerRichPreviews(dateKst:string,cwd=process.cwd()):{preview:RichPreview;gameIds:string[]}[]{
 if(!ownerRichPreviewEnabled()||!/^\d{4}-\d{2}-\d{2}$/.test(dateKst))return[];
 const root=resolve(cwd,'../YANG-EDGE-INBOX/rich-preview-v2',dateKst,'previews');if(!existsSync(root))return[];
 const manifests=readdirSync(root).filter(n=>/^manifest-v\d+\.json$/.test(n)).sort((a,b)=>Number(b.match(/\d+/)![0])-Number(a.match(/\d+/)![0]));if(!manifests.length)return[];const file=join(root,manifests[0]);
 const manifest=JSON.parse(readFileSync(file,'utf8'));if(manifest.publicDisplayAllowed!==false||manifest.schemaVersion!=='OWNER_RICH_PREVIEW_MANIFEST_V2')return[];
 return manifest.entries.flatMap((entry:any)=>{
  if(entry.dateKst!==dateKst||basename(entry.file)!==entry.file)return[];
  const bytes=readFileSync(join(root,entry.file));if(digest(bytes)!==entry.sha256)return[];
  const p:RichPreview=JSON.parse(bytes.toString());
  if(!p.seasonSplit)return[]; // Archived mixed-window editions are not current-season previews.
  const c=canonicalForFixture(join(cwd,'data/cache/research/football/forward-shadow-v1'),entry.fixtureId);
  if(!c||c.predictionId!==entry.canonicalPredictionId||p.canonicalPredictionId!==c.predictionId||p.targetId!==entry.targetId||p.fixtureId!==c.fixtureId||p.kickoffKst.slice(0,10)!==dateKst)return[];
  if(p.canonicalInputHash!==c.inputHash||p.teams[0].id!==c.identity?.homeTeamId||p.teams[1].id!==c.identity?.awayTeamId)return[];
  for(const k of ['pHome','pDraw','pAway','predictedClass'] as const)if(p.officialV1[k]!==c.snapshot.payload[k])return[];
  return[{preview:p,gameIds:entry.gameIds}];
 });
}
export function richPreviewView(p:RichPreview,publicGameId=p.targetId):PublicGameAnalysisViewV1{
 const view=unresolvedPublicView(publicGameId,p.kickoffKst.slice(0,10));
 return{...view,game:{...view.game,sport:'football',league:p.competition,startTimeKst:p.kickoffKst,homeTeam:p.teams[0].name,awayTeam:p.teams[1].name},analysis:{state:'YANG_EDGE_ANALYSIS',headline:p.headline,description:p.outlook,officialPredictionAvailable:true,predictedSide:p.officialV1.predictedClass,probability:Math.max(p.officialV1.pHome,p.officialV1.pDraw,p.officialV1.pAway),confidence:null},quickPreview:{available:true,basis:'ANALYSIS_IDENTITY',sentences:[p.outlook,p.expectedFlow],rich:p},meta:{...view.meta,updatedAt:p.createdAt,preparingFallback:false}};
}
