import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {canonicalForFixture,digest} from '../src/lib/football/official-canonical-v1';
import {buildRichPreview,richMarkdown} from '../src/lib/football/official-canonical-v1/rich-preview';
import {buildGameId} from '../src/lib/game-id';
const repo=process.cwd(),batch=join(repo,'data/research/slate-batches/round-111-odds-new-v1');
const source=JSON.parse(readFileSync(join(batch,'canonicalization-v1/mandatory-previews-v5.json'),'utf8'));
const root=resolve(repo,'../YANG-EDGE-INBOX/rich-preview-v2/2026-09-20'),contextBytes=readFileSync(join(root,'context.json'));
const context=JSON.parse(contextBytes.toString()),registry=JSON.parse(readFileSync(join(batch,'priority-readiness-v1/player-registry.json'),'utf8'));
// Verify original byte receipts before using derived provider context.
for(const r of context.receipts)assert.equal(digest(readFileSync(join(root,r.sha256+'.json'))),r.sha256,'RAW_RECEIPT_MISMATCH');
const out=join(root,'previews');mkdirSync(out,{recursive:true});const manifestPath=join(out,'manifest-v2.json');assert(!existsSync(manifestPath),'VERSION_EXISTS');const entries=[];
for(const p of source){const c=canonicalForFixture(join(repo,'data/cache/research/football/forward-shadow-v1'),p.providerFixtureId);assert(c);
 const preview=buildRichPreview(p,c,context,registry,new Date().toISOString());const stem=p.TARGET_ID+'-rich-preview-v2';
 const json=JSON.stringify(preview,null,2)+'\n',markdown=richMarkdown(preview);assert(!existsSync(join(out,stem+'.json'))&&!existsSync(join(out,stem+'.md')),'VERSION_EXISTS');
 writeFileSync(join(out,stem+'.json'),json,{flag:'wx'});writeFileSync(join(out,stem+'.md'),markdown,{flag:'wx'});
 entries.push({targetId:p.TARGET_ID,fixtureId:p.providerFixtureId,canonicalPredictionId:c.predictionId,version:2,dateKst:p.kickoffKst.slice(0,10),file:stem+'.json',markdown:stem+'.md',sha256:digest(json),markdownSha256:digest(markdown),gameIds:[p.TARGET_ID,buildGameId(p.competition,p.home,p.away),buildGameId(p.competition,c.snapshot.payload.homeTeam.name,c.snapshot.payload.awayTeam.name)]});
 console.log(JSON.stringify({targetId:p.TARGET_ID,quality:preview.quality,teams:preview.teams.map(t=>({name:t.name,last5:t.form.last5.rows.map(r=>r.result).join(''),keyPlayers:t.keyPlayers.map(k=>k.name),season:t.seasonContext?.rank})),canonical:preview.canonicalPredictionId}));
}
writeFileSync(manifestPath,JSON.stringify({schemaVersion:'OWNER_RICH_PREVIEW_MANIFEST_V2',createdAt:new Date().toISOString(),contextHash:digest(contextBytes),providerCalls:context.providerCalls,publicDisplayAllowed:false,entries},null,2)+'\n',{flag:'wx'});
