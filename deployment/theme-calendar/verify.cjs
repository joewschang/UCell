const assert=require('node:assert/strict');
const {current,save}=require('./calendar.cjs');
const rows=new Map(), db={
 async $executeRawUnsafe(sql,theme,enabled,starts,ends,actor){if(sql.startsWith('INSERT'))rows.set(theme,{theme,enabled,starts,ends,revision:(rows.get(theme)?.revision||0)+1,actor});},
 async $queryRawUnsafe(sql){return sql.includes('advisory')?[]:[...rows.values()]},
 $transaction:fn=>fn(db)
};
(async()=>{
 const starts='2026-12-24T16:00:00.000Z',ends='2026-12-25T16:00:00.000Z';
 const first={theme:'christmas',enabled:true,starts,ends,revision:0};
 const staged=await save(db,first,'qa');assert.equal(current(staged,Date.parse(starts)-1).theme,'classic');assert.equal(current(staged,Date.parse(starts)).theme,'christmas');assert.equal(current(staged,Date.parse(ends)).theme,'classic');
 await assert.rejects(save(db,{...first,theme:'newyear'},'qa'));await assert.rejects(save(db,first,'qa'));
 await save(db,{...first,theme:'newyear',starts:ends,ends:null},'qa');
 assert.equal(current(await save(db,{...first,enabled:false,revision:1},'qa'),Date.parse(starts)).theme,'classic');
 console.log('PASS scheduling, boundaries, overlap, stale edits and unpublish');
})().catch(e=>{console.error(e);process.exitCode=1});
