import {mkdir,open,link,unlink,readFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {sha,requireProof} from './contracts';
import {Envelope,stable} from './contracts';
function destination(root:string,evidenceId:string){requireProof(/^[a-f0-9]{64}$/.test(evidenceId),'INVALID_EVIDENCE_ID');return join(resolve(root),evidenceId+'.json');}
/** Publish a fully flushed same-volume temporary inode with atomic no-replace hard link.
 * No exists-then-write and no overwrite rename. Unsupported filesystems fail closed. */
export async function put(root:string,evidenceId:string,bytes:Buffer){const dest=destination(root,evidenceId);await mkdir(resolve(root),{recursive:true});requireProof(!(await lstat(resolve(root))).isSymbolicLink(),'STORE_SYMLINK');const tmp=join(resolve(root),'.pending-'+randomUUID());const f=await open(tmp,'wx',0o600);try{await f.writeFile(bytes);await f.sync();}finally{await f.close();}
 try{await link(tmp,dest);requireProof((await readFile(dest)).equals(bytes),'WRITE_VERIFICATION_FAILED');return{status:'CREATED' as const,evidenceId,sha256:sha(bytes)};}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;requireProof(!(await lstat(dest)).isSymbolicLink(),'STORE_SYMLINK');const old=await readFile(dest);return{status:old.equals(bytes)?'IDEMPOTENT_REPLAY' as const:'CONFLICT' as const,evidenceId,sha256:sha(old)};}finally{await unlink(tmp);}}
export async function get(root:string,evidenceId:string,expectedSha:string){requireProof(/^[a-f0-9]{64}$/.test(expectedSha),'EXPECTED_HASH_REQUIRED');const dest=destination(root,evidenceId);requireProof(!(await lstat(dest)).isSymbolicLink(),'STORE_SYMLINK');const bytes=await readFile(dest);requireProof(sha(bytes)===expectedSha,'HASH_MISMATCH');return bytes;}
export async function exactEvidence(root:string,evidenceId:string,expectedSha:string){const e=JSON.parse((await get(root,evidenceId,expectedSha)).toString()) as Envelope;requireProof(e.schemaVersion==='football-v4-prospective-evidence-v1'&&e.evidenceId===evidenceId,'ENVELOPE_IDENTITY');requireProof(sha(stable((e.payload as {raw:unknown}).raw))===e.sourceArtifactSha256,'SOURCE_HASH_MISMATCH');return e;}
