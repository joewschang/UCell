'use strict';
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {PrismaService}=require('@ucell/database');
const {HealthGameService,AdminHealthGame,MemberHealthGame,PublicHealthGame}=require('./dist/modules/content/health-game.controller');
async function run(){
 if(process.env.DATABASE_URL!=='postgres://postgres@localhost/postgres'||process.env.JOURNEY_FIXTURE!=='disposable')throw Error('Requires isolated fixture database');
 const db=new PrismaService();
 const s=new HealthGameService(db,{list:async()=>[]});
 try{
  for(const sql of [
   'CREATE TABLE IF NOT EXISTS integration.topic_tag(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,name text UNIQUE)',
   'CREATE TABLE IF NOT EXISTS integration.topic_tag_assignment(resource_key text,tag_id bigint,source text,basis text,PRIMARY KEY(resource_key,tag_id))',
   'CREATE TABLE IF NOT EXISTS integration.topic_tag_relation(from_id bigint,to_id bigint,kind text,source text,basis text)',
   'CREATE TABLE IF NOT EXISTS learning.member_event_deletion(member_event_id uuid)',
   'CREATE TABLE IF NOT EXISTS commerce.product_content(product_id uuid,published jsonb)'])await db.$executeRawUnsafe(sql);
  await s.onModuleInit();
  const pub=new PublicHealthGame(s),member=new MemberHealthGame(s),admin=new AdminHealthGame(s);
  const person=await db.person.create({data:{legalName:'測試會員',memberNo:randomUUID()}});
  const req={user:{role:'SUPER_ADMIN',personId:person.personId}},visitor=randomUUID(),friend=randomUUID();
  const previous=await admin.journeyAdmin(req);await admin.journeySave({action:'restore',version:1,revision:previous.revision},req);const initial=await admin.journeyAdmin(req);assert.equal(initial.registry.length,3);
  const products=await db.productReference.create({data:{sku:'T-'+randomUUID(),displayName:'測試用品',currentPrice:100}});
  const key='sku:'+products.sku;
  await db.$executeRaw`INSERT INTO commerce.product_content(product_id,published) VALUES(${products.productId}::uuid,'{}')`;
  await db.productRuleProfile.create({data:{productId:products.productId,effectiveFrom:new Date(0),ruleVersionCode:'R1.0B',parameterSnapshotHash:'a'.repeat(64)}});
  await db.commercialOffering.create({data:{offeringCode:products.sku,offeringType:'CORE_PRODUCT',versions:{create:{version:1,status:'ACTIVE',effectiveFrom:new Date(0),channels:['WEB_MEMBER'],composition:[{sku:products.sku,quantity:1}],approvalReference:'fixture',snapshotHash:'a'.repeat(64)}}}});

  const games=structuredClone(initial.draft);games.find(g=>g.id==='egfr').pinned=[key];games.find(g=>g.id==='egfr').campaign=products.sku;
  await admin.journeySave({action:'draft',revision:initial.revision,games},req);
  await assert.rejects(admin.journeySave({action:'draft',revision:initial.revision,games},req));
  await assert.rejects(admin.journeySave({action:'publish',revision:initial.revision+1,games},{user:{...req.user,role:'ORDER_OPS'}}));
  assert.equal((await pub.journeyRelated({game:'egfr'},{})).some(x=>x.id===key),false);
  await admin.journeySave({action:'publish',revision:initial.revision+1,games},req);
  const related=await member.journeyRelated({game:'egfr'},req);
  assert.equal(related[0].id,key);
  const {id}=await pub.journeyInvite({visitor,game:'egfr',channel:'line',generic:false},{});
  assert.equal((await pub.journeyResolve({id})).game,'egfr');
  const attempt=randomUUID(),base={attempt,visitor:friend,game:'egfr',invite:id};
  await assert.rejects(member.journeyEvent({...base,action:'finish'},req));
  await assert.rejects(member.journeyEvent({...base,action:'start',age:62},req));
  for(const action of ['arrive','start','calculate','finish','finish','click','click'])await member.journeyEvent({...base,action,...(action==='click'?{resource:key}:{})},req);
  const other={...base,attempt:randomUUID(),visitor:randomUUID()};
  await pub.journeyEvent({...other,action:'start'},{});await pub.journeyEvent({...other,action:'finish'},{});
  await member.journeyClaim(other,req);await assert.rejects(member.journeyClaim(other,req));
  const passport=(await member.journeyList(req)).passport;assert.equal(passport.find(g=>g.id==='egfr').n,1);
  const order=await db.order.create({data:{purchaserPersonId:person.personId,ruleVersionCode:'TEST',grossAmount:100,netAmount:100,paidAt:new Date(),lines:{create:{productId:products.productId,skuSnapshot:products.sku,productNameSnapshot:'測試用品',quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{}}}},include:{lines:true}});
  await db.returnCase.create({data:{orderId:order.orderId,status:'POSTED',reasonCode:'TEST',occurredAt:new Date(),postedAt:new Date(),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:order.lines[0].orderLineId,quantity:1,returnAmount:30,gpvReversalAmount:0}}}});
  await member.journeyOrder({attempt,visitor:friend,order:order.orderId},req);
  const stats=await admin.journeyAdmin(req);
  const m=stats.metrics.find(g=>g.game==='egfr'&&g.campaign===products.sku);
  assert.equal(m.orders,1);assert.equal(m.direct_orders,1);assert.equal(m.gross-m.refunds,70);assert.equal(m.invited,2);assert.equal(m.finishes,2);
  const game=games.find(g=>g.id==='egfr');
  await admin.journeySave({action:'revoke',revision:stats.revision,game:'egfr',campaign:game.campaign},req);
  assert.equal((await pub.journeyResolve({id})).expired,true);
  game.enabled=false;await admin.journeySave({action:'publish',revision:stats.revision+1,games},req);
  assert.equal((await pub.journeyList({})).games.some(g=>g.id==='egfr'),false);
  await admin.journeySave({action:'restore',version:1,revision:stats.revision+2},req);
  assert.equal((await admin.journeyAdmin(req)).draft.find(g=>g.id==='egfr').enabled,true);
  console.log('PASS catalog, role guard, stale draft, publish, guest visibility, eligible commerce, invitations, privacy, duplicate events/stamps, signed-in recommendations, paid order/refund attribution and rollback');
 }finally{s.onModuleDestroy?.();await db.$disconnect();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
