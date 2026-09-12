import {readFileSync,readdirSync,mkdirSync,openSync,writeFileSync,fsyncSync,closeSync,existsSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest,sha,requireRule,PROTOCOL_HASH,DESIGN_HASH,MODEL_HASH} from './contracts-evaluation-v1';
export const root=fileURLToPath(new URL('../../../',import.meta.url));
export const code=join(root,'scripts/football-poisson-v2-draw-research/evaluation-v1');
export const devCode=resolve(code,'..');
export const output=join(root,'data/cache/research/football/poisson-v2-draw-research/evaluation-execution-v1');
export const sealPath=join(root,'data/audits/football-poisson-v2-evaluation-source-freeze-v1.json');
export const read=<T>(file:string):T=>JSON.parse(readFileSync(file,'utf8')) as T;
export function readSeal<T>(file:string){const v=read<{payload:T;sha256:string}>(file);requireRule(digest(v.payload)===v.sha256,'SEALED_HASH_MISMATCH');return v;}
export function writeSeal<T>(file:string,payload:T){mkdirSync(resolve(file,'..'),{recursive:true});const value={payload,sha256:digest(payload)},fd=openSync(file,'wx');try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}return value;}
type DevSource={files:Record<string,string>;commonRunnerSha256:string;clarificationHash:string};
export const lf=(f:string)=>readFileSync(f,'utf8').replace(/\r\n/g,'\n');
export function verifyDevelopment(){
  const source=readSeal<DevSource>(join(root,'data/audits/football-poisson-v2-development-source-freeze-v1.json'));
  for(const [n,h] of Object.entries(source.payload.files))requireRule(sha(lf(join(devCode,n)))===h,'DEVELOPMENT_SOURCE_CHANGED');
  const common=Object.fromEntries(Object.entries(source.payload.files).filter(([n])=>!['h1-dixon-coles-v1.ts','h2-ridge-rates-v1.ts','h3-temperature-v1.ts'].includes(n)));
  requireRule(digest(common)===source.payload.commonRunnerSha256,'DEV_COMMON_HASH');
  requireRule(digest(read(join(root,'docs/FOOTBALL_POISSON_V2_DRAW_RESEARCH_PROTOCOL_V1.json')))===PROTOCOL_HASH,'PROTOCOL_HASH');
  requireRule(digest(read(join(root,'docs/FOOTBALL_POISSON_V2_ALGORITHM_DESIGN_FREEZE_V1.json')))===DESIGN_HASH,'DESIGN_HASH');
  requireRule(sha(lf(join(root,'docs/FOOTBALL_POISSON_V2_DEVELOPMENT_EXECUTION_CLARIFICATION_V1.md')))===source.payload.clarificationHash,'CLARIFICATION_HASH');
  requireRule(sha(lf(join(root,'src/lib/football/poisson-research-v1/index.ts')))===MODEL_HASH,'V1_MODEL_HASH');
  requireRule(sha(lf(join(root,'src/lib/football/odds-1x2-v1/instant.ts')))==='c848e4f64438a76bb39531a0f702c01c0aa3c3076f33ef5d39f56c480e97c784','V1_HELPER_HASH');
  return source;
}
export function equivalence(){
  const names=['h1-dixon-coles-v1.ts','h2-ridge-rates-v1.ts','h3-temperature-v1.ts','numerics-v1.ts'];
  for(const name of names)requireRule(lf(join(code,name)).replaceAll("'./contracts-evaluation-v1'","'./contracts-v1'")===lf(join(devCode,name)),'ALGORITHM_EQUIVALENCE_FAILURE');
  const adapter=lf(join(code,'v1-readonly-adapter.ts')).replaceAll("'./contracts-evaluation-v1'","'./contracts-v1'").replace("'../../../src/","'../../src/");
  requireRule(adapter===lf(join(devCode,'v1-readonly-adapter.ts')),'V1_ADAPTER_EQUIVALENCE_FAILURE');
  return {normalizedSourceExact:true,files:names,adapterExact:true};
}
export function sourceFiles(){return Object.fromEntries(readdirSync(code).filter(n=>n.endsWith('.ts')).sort().map(n=>[n,sha(lf(join(code,n)))]));}
export function preservation(){
  const files=new Set<string>();
  function walk(dir:string){if(!existsSync(dir))return;for(const d of readdirSync(dir,{withFileTypes:true})){const f=join(dir,d.name);if(d.isDirectory())walk(f);else files.add(f);}}
  walk(join(root,'data/cache/research/football/forward-shadow-v1'));
  walk(join(root,'data/cache/research/football/poisson-v2-draw-research/protocol-v1'));
  for(const dir of ['scripts','docs','data/audits'])for(const n of readdirSync(join(root,dir)))if(n.includes('forward')||n.includes('FORWARD')||n.includes('poisson-v2-development')||n.includes('POISSON_V2_DEVELOPMENT'))files.add(join(root,dir,n));
  for(const n of readdirSync(devCode).filter(n=>n.endsWith('.ts')))files.add(join(devCode,n));
  for(const n of ['FOOTBALL_POISSON_V2_DRAW_RESEARCH_PROTOCOL_V1','FOOTBALL_POISSON_V2_ALGORITHM_DESIGN_FREEZE_V1'])for(const ext of ['md','json'])files.add(join(root,'docs',n+'.'+ext));
  files.add(join(root,'src/lib/football/poisson-research-v1/index.ts'));files.add(join(root,'src/lib/football/odds-1x2-v1/instant.ts'));
  const p=read<{evidenceSealVerification:{resultFileHashes:{path:string;sha256:string}[]}}>(join(root,'docs/FOOTBALL_POISSON_V2_DRAW_RESEARCH_PROTOCOL_V1.json'));
  for(const r of p.evidenceSealVerification.resultFileHashes){const f=join(root,r.path);requireRule(sha(readFileSync(f))===r.sha256,'BASELINE_RESULT_HASH');files.add(f);}
  const manifest=read<{leagues:{localArchiveRelativePath:string;archiveSha256:string}[]}>(join(root,'data/audits/football-four-major-leagues-historical-archive-v1.json'));
  for(const l of manifest.leagues){const f=join(root,l.localArchiveRelativePath,'archive.json');requireRule(sha(readFileSync(f))===l.archiveSha256,'ARCHIVE_HASH');files.add(f);}
  return Object.fromEntries([...files].sort().map(f=>[relative(root,f).replaceAll('\\','/'),sha(readFileSync(f))]));
}
export function sealSource(){
  const dev=verifyDevelopment(),files=sourceFiles();
  return writeSeal(sealPath,{schemaVersion:'POISSON_V2_EVALUATION_EXECUTION_SOURCE_V1',createdAt:new Date().toISOString(),files,
    EVALUATION_CONTRACT_SHA256:files['contracts-evaluation-v1.ts'],EVALUATION_RUNNER_SHA256:files['run-evaluation-v1.ts'],EVALUATION_EVALUATOR_SHA256:files['evaluator-evaluation-v1.ts'],
    developmentSource:dev,protocolHash:PROTOCOL_HASH,designHash:DESIGN_HASH,equivalence:equivalence(),preservedBytes:preservation(),
    FINAL_FITTING_EXECUTED:false,EVALUATION_EXECUTED:false});
}
export function verifySource(){const seal=readSeal<{files:Record<string,string>;preservedBytes:Record<string,string>}>(sealPath);verifyDevelopment();equivalence();requireRule(digest(sourceFiles())===digest(seal.payload.files),'EVALUATION_SOURCE_CHANGED');requireRule(digest(preservation())===digest(seal.payload.preservedBytes),'PRESERVATION_FAILURE');return seal;}
