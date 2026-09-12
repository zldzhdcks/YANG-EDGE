import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {digest,sha,storeRoot} from '../football-v31-r1-prospective-v1/store-v1';

export function treeFingerprint(root:string,ids:number[]){
 const parent=join(storeRoot(root),'fixtures');
 const rows:{id:number;file:string;sha:string}[]=[];
 for(const id of [...ids].sort((a,b)=>a-b)){
  const dir=join(parent,String(id));
  if(!existsSync(dir))continue;
  for(const file of readdirSync(dir).sort())rows.push({id,file,sha:sha(readFileSync(join(dir,file)))});
 }
 return digest(rows);
}
