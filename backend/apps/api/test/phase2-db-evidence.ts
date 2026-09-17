import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
type EvidenceRow = Readonly<{ label:string; result:string; actual:unknown; expected:unknown }>;
let cached:readonly EvidenceRow[]|undefined;
/** Runs the complete destructive Phase 2 fixture once per isolated Jest database. */
export function phase2DbEvidence():readonly EvidenceRow[]{
  if(cached)return cached;
  const root=resolve(__dirname,'../../../..'),directory=mkdtempSync(join(tmpdir(),'ucell-phase2-evidence-'));
  try{
    const file=join(directory,'evidence.json');
    execFileSync(process.execPath,[resolve(root,'backend/scripts/phase2-db-test.mjs')],{cwd:root,env:{...process.env,DATABASE_URL:process.env.PHASE2_TEST_DATABASE_URL??process.env.DATABASE_URL,PHASE2_DB_EVIDENCE_PATH:file},timeout:30000});
    const run=JSON.parse(readFileSync(file,'utf8')) as {result:string;results:EvidenceRow[]};
    if(run.result!=='PASS')throw new Error('PHASE2_DB_EVIDENCE_FAILED');
    cached=Object.freeze(run.results);return cached;
  }finally{rmSync(directory,{recursive:true,force:true});}
}
