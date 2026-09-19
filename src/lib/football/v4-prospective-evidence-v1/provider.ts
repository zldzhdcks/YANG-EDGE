import {mkdir,readFile,writeFile,rmdir} from 'node:fs/promises';
import {join} from 'node:path';
import {FetchSource} from './collector';
import {requireProof,time} from './contracts';
/** Only network layer. A filesystem mutex serializes requests across processes.
 * Crash leaves a fail-closed mutex requiring attended recovery, never blind retries. */
export function officialSource(root:string,key:string):FetchSource{return async(source,c,team,page)=>{
 requireProof(key.length>0,'API_KEY_REQUIRED');await mkdir(root,{recursive:true});const lock=join(root,'network.lock');await mkdir(lock);try{
 let previous=0;try{previous=Number(await readFile(join(root,'last-request'),'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 const wait=Math.max(0,6500-(Date.now()-previous));if(wait)await new Promise(r=>setTimeout(r,wait));requireProof(Date.now()<time(c.predictionCutoff),'CUTOFF_BEFORE_NETWORK');
 const endpoint=source==='XI'?'/fixtures/lineups':source==='INJURY'?'/injuries':'/players';const url=new URL('https://v3.football.api-sports.io'+endpoint);
 if(source==='PLAYER_STATS'){url.searchParams.set('team',team);url.searchParams.set('league',c.competitionProviderId);url.searchParams.set('season',c.season);url.searchParams.set('page',String(page));}else url.searchParams.set('fixture',c.providerFixtureId);
 await writeFile(join(root,'last-request'),String(Date.now()),'utf8');const response=await fetch(url,{headers:{'x-apisports-key':key},redirect:'error',signal:AbortSignal.timeout(15000)});requireProof(response.ok,'PROVIDER_HTTP_ERROR');const json=await response.json();requireProof(Array.isArray(json.response)&&(!json.errors||Object.keys(json.errors).length===0),'PROVIDER_SCHEMA_ERROR');
 // Receipt proves when these bytes arrived, not provider publication or data-through.
 const collectedAt=new Date().toISOString();return{raw:json.response,observedAt:collectedAt,collectedAt,asOf:collectedAt,providerUpdatedAt:null,paging:json.paging??null};
 }finally{await rmdir(lock);}};}
