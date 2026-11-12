'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const {randomBytes,randomUUID}=require('node:crypto');
const {patchApi,buildTrackingHelper}=require('./tracking-members.cjs');
const [fullDist,original]=process.argv.slice(2);
const url=new URL(process.env.DATABASE_URL);
assert.equal(url.hostname,'127.0.0.1');
assert(url.port,'Use an isolated local test database');
const req=Module.createRequire(path.resolve(fullDist,'main.js'));
req('reflect-metadata');
const {PrismaService,PiiCryptoService}=req('@ucell/database');
process.env.PII_ENCRYPTION_KEY=randomBytes(32).toString('base64');
process.env.PII_ENCRYPTION_KEY_VERSION='tracking-qa';
const db=new PrismaService();
function compile(name,body,dependency){
  const file=path.resolve(fullDist,'modules/order',name);
  const local=new Module(file);
  local.filename=file; local.paths=Module._nodeModulePaths(path.dirname(file));
  if(dependency){const original=local.require.bind(local);local.require=id=>id==='./tracking-member-names'?dependency:original(id);}
  local._compile(body,file);
  return local.exports;
}
const helper=compile('tracking-member-names.js',buildTrackingHelper());
const {AdminOrderTrackingService}=compile('admin-order-tracking.service.js',patchApi(fs.readFileSync(original,'utf8')),helper);
(async()=>{
  const rollback=new Error('Tracking QA rollback');
  try{
    await db.$transaction(async tx=>{
      const trace='追蹤'+randomUUID().slice(0,8);
      const createPerson=(name)=>tx.person.create({data:{legalName:name,preferredName:'配送聯絡人',membershipState:'FORMAL_MEMBER',status:'EFFECTIVE'}});
      const buyer=await createPerson(trace+'購買人'),former=await createPerson(trace+'原持有人'),current=await createPerson(trace+'新持有人');
      const entity=await tx.legalEntity.create({data:{registeredName:trace+'法人',registrationNo:randomUUID()}});
      const q=await tx.qualification.create({data:{currentHolderPersonId:current.personId,planLevelCode:'STARTER',status:'EFFECTIVE'}});
      const cq=await tx.qualification.create({data:{currentHolderLegalEntityId:entity.legalEntityId,planLevelCode:'STARTER',status:'EFFECTIVE'}});
      const now=Date.now(),past=new Date(now-30000),beforeTransfer=new Date(now-20000),transfer=new Date(now-10000);
      await tx.qualificationHolderHistory.createMany({data:[
        {qualificationId:q.qualificationId,holderPersonId:former.personId,effectiveFrom:past,effectiveTo:transfer,sourceType:'QA'},
        {qualificationId:q.qualificationId,holderPersonId:current.personId,effectiveFrom:transfer,sourceType:'QA'}
      ]});
      const make=(extra)=>tx.order.create({data:{purpose:'RETAIL',status:'CONFIRMED',currency:'TWD',grossAmount:'100',discountAmount:'0',netAmount:'100',ruleVersionCode:'R1.0B',...extra}});
      const retail=await make({purchaserPersonId:buyer.personId,qualificationId:q.qualificationId});
      const historical=await make({qualificationId:q.qualificationId,createdAt:beforeTransfer});
      const corporate=await make({qualificationId:cq.qualificationId});
      const unnamed=await createPerson('');
      const orphan=await make({purchaserPersonId:unnamed.personId});
      const applicant=await createPerson('');
      const encrypted=new PiiCryptoService().encrypt({legalName:trace+'申請姓名',address:'禁止帶入 DTO 的資料'});
      await tx.formalMemberApplication.create({data:{personId:applicant.personId,currentSnapshotHash:'f'.repeat(64),snapshots:{create:{version:1,payloadCiphertext:encrypted.ciphertext,keyVersion:encrypted.keyVersion,payloadHash:'f'.repeat(64)}}}});
      const formalOrder=await make({purchaserPersonId:applicant.personId});
      const packageOrder=await make({qualificationId:q.qualificationId});
      const version=await tx.packageProfileVersion.findFirstOrThrow();
      await tx.packagePurchaseSnapshot.create({data:{orderId:packageOrder.orderId,legalEntityId:entity.legalEntityId,packageProfileVersionId:version.packageProfileVersionId,packageCode:'QA',packageName:'測試套組',packageClass:'QUALIFICATION',currency:'TWD',priceAmount:'100',selectableProductQuantity:0,membershipEffect:'QA',qualificationEffect:'QA',recognitionConfigRef:'QA',packageConfigHash:'f'.repeat(64),purchasedAt:new Date()}});
      const more=await Promise.all(Array.from({length:23},()=>make({purchaserPersonId:buyer.personId})));
      const service=new AdminOrderTrackingService({$transaction:work=>work(tx)},{});
      const found=await service.list({search:trace});
      const rest=await service.list({search:trace,page:2});
      assert.equal(found.total,28);assert.equal(found.orders.length,20);assert.equal(rest.orders.length,8);
      const names=new Map([...found.orders,...rest.orders].map(row=>[row.orderId,row.memberName]));
      assert.equal(names.get(retail.orderId),buyer.legalName);assert.equal(names.get(historical.orderId),former.legalName);
      assert.equal(names.get(corporate.orderId),entity.registeredName);
      assert.equal(names.get(packageOrder.orderId),entity.registeredName);
      assert.equal(names.get(formalOrder.orderId),trace+'申請姓名');
      assert(!JSON.stringify([found,rest]).includes('禁止帶入 DTO 的資料'));
      assert(!names.has(orphan.orderId));for(const order of more)assert.equal(names.get(order.orderId),buyer.legalName);
      const page=await service.list({page:1});
      assert(page.orders.every(row=>'memberName' in row));
      const [display]=await tx.$queryRaw`SELECT public_order_no FROM commerce."order" WHERE order_id=${orphan.orderId}::uuid`;
      const orphanRow=await service.list({search:display.public_order_no});
      assert.equal(orphanRow.orders.find(o=>o.orderId===orphan.orderId)?.memberName,null);
      assert.equal((await service.list({search:current.legalName})).total,0);
      assert.equal((await service.list({search:'配送聯絡人'})).total,0);
      throw rollback;
    },{timeout:30000});
  }catch(error){if(error!==rollback)throw error;}
  console.log('PASS tracking list: 20 + 8 across pages, retail purchaser, legal entity, package buyer, historical transfer owner, encrypted application name, missing name, alternate names excluded; rolled back');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.$disconnect());
