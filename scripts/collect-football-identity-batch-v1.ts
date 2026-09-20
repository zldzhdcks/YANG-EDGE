import assert from 'node:assert/strict';
import {mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {digest} from '../src/lib/football/official-canonical-v1';
import {projectScheduleIdentity} from '../src/lib/public-analysis/provider-identity-batch';
async function main(){
 const root=resolve('../YANG-EDGE-INBOX/football-provider-identity-v1/2026-09-20');mkdirSync(root,{recursive:true});const file=join(root,'schedule.json');assert(!existsSync(file),'IMMUTABLE_SCHEDULE_EXISTS');
 const key=process.env.FOOTBALL_API_KEY??process.env.API_FOOTBALL_KEY;assert(key,'KEY_REQUIRED');
 const params={date:'2026-09-20',timezone:'Asia/Seoul'};const url=new URL('https://v3.football.api-sports.io/fixtures');url.search=new URLSearchParams(params).toString();
 const response=await fetch(url,{headers:{'x-apisports-key':key},redirect:'error',signal:AbortSignal.timeout(25000)});
 assert(response.ok,'HTTP_'+response.status);const raw=await response.json();assert(Object.keys(raw.errors??{}).length===0,'PROVIDER_ERROR');assert(Array.isArray(raw.response)&&(raw.paging?.total??1)===1,'INCOMPLETE_RESPONSE');
 const observedAt=new Date().toISOString(),fixtures=raw.response.map(projectScheduleIdentity);
 assert(new Set(fixtures.map((f:any)=>f.fixtureId)).size===fixtures.length,'DUPLICATE_PROVIDER_ID');
 const payload={schemaVersion:'IDENTITY_ONLY_SCHEDULE_V1',params,observedAt,providerCalls:1,reservedV4BudgetUsed:0,identityOnly:true,rawStored:false,fixtures};const bytes=JSON.stringify(payload,null,2)+'\n';writeFileSync(file,bytes,{flag:'wx'});
 console.log(JSON.stringify({sha256:digest(bytes),providerCalls:1,rows:fixtures.length,leagues:[...new Set(fixtures.map((f:any)=>f.leagueId))]}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
