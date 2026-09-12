import {existsSync,readFileSync} from 'node:fs';
import {digest,sha,readSeal,requireRule} from '../football-v31-r1-prospective-v1/store-v1';
import {type ExpectedSeal} from './grader-v1';
import {resolvePregameArtifact} from './resolve-v1';

export function verifyPregameHashes(root:string,batchId:string,expected:ExpectedSeal){
 const files=resolvePregameArtifact(root,batchId,expected.fixtureId);
 const snap=readSeal(files.snapshotPath),input=readSeal(files.inputPath);
 requireRule(snap.sha256===expected.snapshotHash,'SNAPSHOT_HASH_MISMATCH');
 requireRule(input.sha256===expected.inputHash,'INPUT_HASH_MISMATCH');
 return files;
}

export function pregameFingerprint(root:string,batchId:string,ids:number[]){
 const rows:{id:number;file:string;sha:string}[]=[];
 for(const id of ids){
  const files=resolvePregameArtifact(root,batchId,id);
  for(const file of ['input.json','snapshot.json']){
   const p=file==='input.json'?files.inputPath:files.snapshotPath;
   if(existsSync(p))rows.push({id,file,sha:sha(readFileSync(p))});
  }
 }
 return digest(rows);
}

export function postgameFingerprint(root:string,batchId:string,ids:number[]){
 const rows:{id:number;sha:string}[]=[];
 for(const id of ids){
  const files=resolvePregameArtifact(root,batchId,id);
  if(existsSync(files.postgamePath))rows.push({id,sha:sha(readFileSync(files.postgamePath))});
 }
 return digest(rows);
}

export function existingPostgameIds(root:string,batchId:string,ids:number[]){
 return ids.filter(id=>existsSync(resolvePregameArtifact(root,batchId,id).postgamePath));
}
