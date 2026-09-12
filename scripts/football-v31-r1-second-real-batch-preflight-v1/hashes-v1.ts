import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadParameters,MAP_HASH,BETA_HASH} from '../football-v31-r1-prospective-v1/adapter-v1';
import {sha,requireRule} from '../football-v31-r1-prospective-v1/store-v1';

export const V1_HASH='6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf';
export const ADAPTER_HASH='125f715c85a5199b7f5725949c4b1ff6f12b1e5d6ef65095c5af0d0673682b6b';
export const H2_HASH='fab9d235b885207a0feba198f1e777f0a8ee0577e50d14f317613e7dcfef0aea';
export {MAP_HASH,BETA_HASH};

const repo=fileURLToPath(new URL('../../',import.meta.url));
export function sourceHash(relative:string){return sha(readFileSync(join(repo,relative),'utf8').replace(/\r\n/g,'\n'));}

export function verifyFrozen(){
 loadParameters();
 requireRule(sourceHash('src/lib/football/poisson-research-v1/index.ts')===V1_HASH,'V1_SOURCE_CHANGED');
 requireRule(sourceHash('scripts/football-v31-r1-prospective-v1/adapter-v1.ts')===ADAPTER_HASH,'ADAPTER_CHANGED');
 requireRule(sourceHash('scripts/football-v31-r1-prospective-v1/frozen/scripts/football-poisson-v2-draw-research/evaluation-v1/h2-ridge-rates-v1.ts')===H2_HASH,'H2_CHANGED');
 return {V1_HASH,ADAPTER_HASH,H2_HASH,MAP_HASH,BETA_HASH};
}
