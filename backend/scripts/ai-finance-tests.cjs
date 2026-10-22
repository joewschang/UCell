const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {PrismaClient}=require('../packages/database/node_modules/@prisma/client');
const {AiData}=require('../apps/api/dist/modules/ai/ai-data');
assert.ok(['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname));
assert.equal(new URL(process.env.DATABASE_URL).port,'55432','Use the dedicated AI test container');
const db=new PrismaClient();let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
(async()=>{try{await db.$transaction(async tx=>{
 const data=new AiData({$transaction:fn=>fn(tx)}),admin={id:randomUUID(),audience:'ADMIN'},plan={intent:'SUMMARY',start:'2026-09-01',end:'2026-09-02'};
 const person=await tx.person.create({data:{legalName:'AI LOCAL FINANCIAL TEST',status:'EFFECTIVE'}});
 const profile=await tx.packageProfile.create({data:{stableCode:'AI_TEST_'+randomUUID(),packageClass:'QUALIFICATION'}});
 const version=await tx.packageProfileVersion.create({data:{packageProfileId:profile.packageProfileId,version:1,displayName:'LOCAL TEST',currency:'TWD',priceAmount:14400,selectableProductQuantity:3,membershipEffect:'NONE',qualificationEffect:'NONE',configHash:'a'.repeat(64),createdByActor:'TEST'}});
 async function order(goods,fee,extra={}){const o=await tx.order.create({data:{purchaserPersonId:person.personId,grossAmount:goods+fee,netAmount:goods+fee,ruleVersionCode:'TEST',createdAt:new Date('2026-09-01T01:00:00Z'),...extra}});await tx.packagePurchaseSnapshot.create({data:{orderId:o.orderId,personId:person.personId,packageProfileVersionId:version.packageProfileVersionId,packageCode:'STARTER',packageName:'TEST',packageClass:'QUALIFICATION',currency:'TWD',priceAmount:goods,qualificationFee:fee,selectableProductQuantity:goods===0?0:6,membershipEffect:'NONE',qualificationEffect:'NONE',recognitionConfigRef:'PO_20261021_ENTRY_V2',packageConfigHash:'a'.repeat(64),purchasedAt:new Date('2026-09-01T01:00:00Z')}});return o;}
 const paid=async(o,amount=o.netAmount)=>tx.paymentEvent.create({data:{orderId:o.orderId,eventType:'PAYMENT_CONFIRMED',amount,paymentMethod:'TEST',referenceNo:randomUUID(),idempotencyKey:randomUUID(),occurredAt:new Date('2026-09-01T02:00:00Z'),correlationId:randomUUID()}});
 const zero=await order(0,600);await paid(zero);const six=await order(28800,600);await paid(six);await order(57600,600); // unpaid must not count
 let a=await data.execute(admin,plan,null);eq(a.status,'AVAILABLE');eq(a.facts.map(f=>f.value),['30000.00','2','1200.00','28800.00']);
 const [coupon]=await tx.$queryRaw`SELECT id FROM commerce.coupon_definition WHERE code='UCELL888'`;
 await tx.$executeRaw`INSERT INTO commerce.coupon_redemption(coupon_id,order_id,person_id,snapshot,expires_at) VALUES(${coupon.id}::uuid,${zero.orderId}::uuid,${person.personId}::uuid,'{}',now()+interval '1 day')`;
 a=await data.execute(admin,{...plan,intent:'COUPON',couponCode:'UCELL888'},null);eq(a.facts.map(f=>f.value),['600.00','1','600.00','0.00']);
 const own=await data.execute({id:person.personId,audience:'MEMBER'},{...plan,intent:'ORDERS'},null);eq(own.rows.length,3);eq(own.rows.some(r=>r[4]==='0 盒，無需寄送商品'),true);
 eq((await data.execute({id:randomUUID(),audience:'MEMBER'},{...plan,intent:'ORDERS'},null)).rows.length,0);
 const partial=await order(100,600);await paid(partial,300);eq((await data.execute(admin,plan,null)).status,'UNAVAILABLE');
 // Separate day for duplicate confirmation, no partial-payment fixture contamination.
 const dup=await order(100,600);for(let i=0;i<2;i++)await tx.paymentEvent.create({data:{orderId:dup.orderId,eventType:'PAYMENT_CONFIRMED',amount:700,paymentMethod:'TEST',referenceNo:randomUUID(),idempotencyKey:randomUUID(),occurredAt:new Date('2026-09-02T02:00:00Z'),correlationId:randomUUID()}});
 eq((await data.execute(admin,{intent:'SUMMARY',start:'2026-09-02',end:'2026-09-03'},null)).status,'UNAVAILABLE');
 throw Error('ROLLBACK_TEST');
 },{timeout:20000})}catch(e){if(e.message!=='ROLLBACK_TEST')throw e;}finally{await db.$disconnect()}console.log(JSON.stringify({result:'PASS',checks,rolledBack:true}));})().catch(e=>{console.error(e);process.exitCode=1});
