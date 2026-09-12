/** Deterministic evaluation-only source mirror. Originals are never written. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const seeds=['scripts/football-v31-incremental-feature-research-v1/candidate-v1.ts','scripts/football-v31-incremental-feature-research-v1/causal-state-v1.ts','scripts/football-v3-feature-research-v1/metrics-v1.ts'];
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const contract='scripts/football-poisson-v2-draw-research/evaluation-v1/contracts-evaluation-v1.ts';
const map='scripts/football-v31-incremental-feature-research-v1/residual-map-v1.ts';
const hydration=`
/** Evaluation-only hydration; caller supplies a sealed final map. No fitting. */
export function hydrateFinalMap(map:MapRecord, expectedRecordHash:string, expectedParameterHash:string){
  requireRule(map.kind==='FINAL'&&map.targetId===null&&map.fit.status==='FITTED','FINAL_MAP_REQUIRED');
  requireRule(digest(map)===expectedRecordHash&&digest(map.fit.parameters)===expectedParameterHash&&map.parameterHash===expectedParameterHash,'FINAL_MAP_HASH');
  requireRule(map.fit.parameters.length===2&&map.fit.parameters.every(r=>r.length===3&&r.every(Number.isFinite)),'FINAL_MAP_DIMENSION');
  trusted.set(map,digest(map));return map;
}
`;
function expected(){const out={};function visit(p){if(out[p])return;let original=fs.readFileSync(path.join(root,p),'utf8').replaceAll('\r\n','\n'),text=original;const changes=[];
 if(p===contract){if(text.split('[2023,2024].includes(t.season)').length!==2)throw Error('CONTRACT_PATCH_COUNT');text=text.replace('[2023,2024].includes(t.season)','[2023,2024,2025].includes(t.season)');changes.push('Allow authorized 2025 identity; all numerical/history contracts unchanged.');}
 if(p===map){text+=hydration;changes.push('Append hash-checked final-map hydration; original functions unchanged.');}
 out[p]={originalHash:hash(original),mirrorHash:hash(text),changes,text};
 for(const m of original.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){let dep=path.posix.normalize(path.posix.join(path.posix.dirname(p),m[1]));if(!dep.endsWith('.ts'))dep+='.ts';visit(dep);}}
 seeds.forEach(visit);return out;}
function run(write=false){const entries=expected();for(const [p,r]of Object.entries(entries)){const dest=path.join(__dirname,'frozen',p);if(write){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,r.text,{flag:'wx'});}else if(fs.readFileSync(dest,'utf8').replaceAll('\r\n','\n')!==r.text)throw Error('MIRROR_EQUIVALENCE:'+p);}
 return Object.fromEntries(Object.entries(entries).map(([p,{text,...r}])=>[p,r]));}
module.exports={run};if(require.main===module)console.log(JSON.stringify(run(process.argv.includes('--create')),null,2));
