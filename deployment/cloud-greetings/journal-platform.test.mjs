import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initializeJournal,inspectJournal} from './retry-journal.mjs';

test('journal requires its reviewed Linux filesystem contract before creating files',async t=>{
  const parent=mkdtempSync(join(tmpdir(),'ucell-platform-test-'));
  t.after(()=>rmSync(parent,{recursive:true,force:true}));
  const directory=join(parent,'journal');
  if(process.platform==='linux'){
    initializeJournal(directory);
    assert.equal(existsSync(join(directory,'jobs.sqlite')),true);
    await assert.rejects(inspectJournal({directory,date:'2026-11-17'}),/JOB_MISSING/);
  }else{
    assert.throws(()=>initializeJournal(directory),/^Error: JOURNAL_PLATFORM_UNSUPPORTED$/);
    assert.equal(existsSync(directory),false);
    await assert.rejects(inspectJournal({directory,date:'2026-11-17'}),/^Error: JOURNAL_PLATFORM_UNSUPPORTED$/);
    assert.equal(existsSync(directory),false);
  }
});
