'use strict';
const assert=require('node:assert/strict');
const base='/app/apps/api/dist/modules/content/';
const {view,write}=require(base+'topics');
const {PrismaClient}=require('/app/packages/database/node_modules/@prisma/client');
const db=new PrismaClient();
const abort=new Error('rollback verification');
async function verify(){
 await assert.rejects(db.$transaction(async tx=>{
 const dbFacade=new Proxy(tx,{get(t,key){return key==='$transaction'?fn=>fn(tx):Reflect.get(t,key);}});
 const svc={db:dbFacade};
 const model=()=>view(svc,null,true);
 const update=async body=>write(svc,{version:(await model()).version,...body},'rollback verification');
 const example=(await model()).rows.find(r=>r.id==='guide');
 const x='測試'+Date.now().toString(36),y=x+'乙',z=x+'丙';
 await update({action:'assign',id:'guide',tags:[...example.tags,x]});
 let cfg=(await tx.$queryRawUnsafe('SELECT config FROM integration.health_game_config WHERE id=1'))[0].config;
 assert.ok(cfg.links.guide.includes(x));
 await update({action:'renameTag',name:x,target:y});
 assert.equal((await model()).aliases[x],y);
 await update({action:'createTag',name:z});
 await update({action:'edge',a:y,b:'腿部肌力',kind:'相關主題'});
 await update({action:'mergeTag',name:y,target:z});
 let m=await model();
 assert.equal(m.aliases[x],z);assert.ok(m.edges.some(e=>e.a===z));
 await update({action:'archiveTag',name:z});
 assert.ok((await model()).archived.includes(z));
 await update({action:'restoreTag',name:z});
 assert.ok((await model()).rows.find(r=>r.id==='guide').tags.includes(z));
 await assert.rejects(write(svc,{action:'assign',id:'guide',tags:[],version:'obsolete'},'test'),e=>e.status===409);
 const candidate=m.jobs.find(j=>j.state==='review'&&j.proposal.tags.length);
 if(candidate){const {hash}=require(base+'topics');await update({action:'apply',id:candidate.id,proposalKey:hash(candidate.proposal)});}
 console.log('Passed assignment, health sync, rename, aliases, merge, edge, archive, restore, conflict; AI approval tested:',!!candidate);
 throw abort;
 },{timeout:30000}),e=>e===abort);
 const leaked=await db.$queryRawUnsafe("SELECT count(*)::int AS n FROM integration.topic_tag_change WHERE actor='rollback verification'");
 assert.equal(leaked[0].n,0);
}
verify().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
