const assert=require('node:assert/strict');
const {PrismaClient}=require('/app/packages/database/node_modules/@prisma/client');
const {AdminFaqController,faqList}=require('/app/apps/api/dist/modules/public-website/faq.controller');
const fields={categories:['id','label','sortOrder','published','version'],items:['id','category','question','answer','keywords','sortOrder','published','version']};
function normalized(kind,row){return JSON.stringify(fields[kind].map(k=>row[k]));}
exports.publish=async function(data,baseline,dryRun){
 const db=new PrismaClient();
 try{
  assert.equal(new Set(data.categories.map(r=>r.id)).size,data.categories.length);
  assert.equal(new Set(data.items.map(r=>r.id)).size,data.items.length);
  for(const row of data.items){assert(data.categories.some(c=>c.id===row.category));assert(row.question.trim()&&row.question.length<=200);assert(row.answer.trim()&&row.answer.length<=12000);assert(row.keywords.length<=500);}
  try{await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT true FROM (SELECT pg_advisory_xact_lock(19670919,1026)) q`;
   const before=await faqList(tx,true);
   for(const kind of ['categories','items'])for(const row of data[kind]){
    const old=before[kind].find(r=>r.id===row.id),expected=baseline[kind].find(r=>r.id===row.id);
    if(expected){assert(old,'FAQ_ROW_MISSING:'+row.id);assert.equal(normalized(kind,old),normalized(kind,expected),'FAQ_CHANGED_SINCE_REVIEW:'+row.id);}
    else assert(!old,'FAQ_NEW_ID_COLLISION:'+row.id);
   }
   const actor='USER_AUTHORIZED_FAQ_ENRICHMENT_20261026';
   await tx.$executeRaw`INSERT INTO content.faq_change(actor_id,entity_id,action,payload) VALUES (${actor},'faq-content-20261026','BEFORE_ENRICHMENT',${JSON.stringify(before)}::jsonb)`;
   const wrapped=new Proxy(tx,{get:(t,k)=>k==='$transaction'?fn=>fn(tx):t[k]}),controller=new AdminFaqController(wrapped),req={user:{subject:actor}};
   for(const row of data.categories){const old=before.categories.find(c=>c.id===row.id);await controller.category(row.id,{label:row.label,sortOrder:row.sortOrder,published:true,version:old?.version??0},req);}
   for(const [index,row] of data.items.entries()){const old=before.items.find(c=>c.id===row.id);await controller.item(row.id,{category:row.category,question:row.question,answer:row.answer,keywords:row.keywords,sortOrder:index*10,published:true,version:old?.version??0},req);}
   const published=await faqList(tx);
   for(const row of data.items){const saved=published.items.find(i=>i.id===row.id);assert(saved);assert.equal(saved.answer,row.answer);assert.equal(saved.question,row.question);}
   if(dryRun)throw Error('FAQ_DRY_RUN_SUCCESS');
  },{timeout:45000,isolationLevel:'Serializable'});}catch(error){if(!(dryRun&&error.message==='FAQ_DRY_RUN_SUCCESS'))throw error;}
  console.log(JSON.stringify({mode:dryRun?'ROLLED_BACK_VALIDATION':'PUBLISHED',categories:data.categories.length,items:data.items.length}));
 }finally{await db.$disconnect();}
};
