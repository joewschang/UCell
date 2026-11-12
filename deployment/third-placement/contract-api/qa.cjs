'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {randomUUID,randomBytes,createHash}=require('node:crypto');
const [dir,dist,template]=process.argv.slice(2),control=new URL(process.env.DATABASE_URL);
assert.equal(control.hostname,'127.0.0.1');assert.equal(control.pathname,'/postgres');assert.match(template,/^ucell_jest_[a-f0-9]{32}$/);
const requireDb=Module.createRequire(path.resolve(dist,'main.js'));requireDb('reflect-metadata');
const {PrismaClient}=requireDb('@prisma/client'),{PiiCryptoService}=requireDb('@ucell/database');
process.env.PII_ENCRYPTION_KEY=randomBytes(32).toString('base64');process.env.PII_ENCRYPTION_KEY_VERSION='synthetic';
const dbName='ucell_jest_'+randomUUID().replaceAll('-',''),target=new URL(control);target.pathname='/'+dbName;
const admin=new PrismaClient({datasourceUrl:control.href}),db=new PrismaClient({datasourceUrl:target.href});
const hash=x=>createHash('sha256').update(x).digest('hex'), pii=new PiiCryptoService();
const loaded=new Map();
function load(unit,stubs={}){
 const candidates=[unit,unit+'.js',unit+'.cjs'];
 let found;
 for(const root of [dir,process.env.PINNED_RUNTIME].filter(Boolean)){
   for(const name of candidates){
     const file=path.resolve(root,name);
     if(fs.statSync(file,{throwIfNoEntry:false})?.isFile()){found={file,name};break;}
   }
   if(found)break;
 }
 if(!found)throw Error('Pinned module missing: '+unit);
 if(loaded.has(found.file))return loaded.get(found.file).exports;
 const filename=path.resolve(dist,'modules/member',found.name),m=new Module(filename);
 loaded.set(found.file,m);
 m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));const req=m.require.bind(m);
 m.require=id=>{
   if(stubs[id])return stubs[id];
   if(id.startsWith('.')){
     const name=path.join(path.dirname(unit),id);
     if([dir,process.env.PINNED_RUNTIME].filter(Boolean).some(root=>[name,name+'.js',name+'.cjs'].some(f=>fs.statSync(path.resolve(root,f),{throwIfNoEntry:false})?.isFile())))return load(name);
   }
   return req(id);
 };
 m._compile(fs.readFileSync(found.file,'utf8'),filename);return m.exports;
}
const rules=load('contract-renewal'),error=code=>e=>e.getResponse?.()?.code===code;
const time=n=>new Date(Date.now()+n*86400000);
async function contract(name,from,to){
 return db.contractDocumentVersion.create({data:{contractType:'FORMAL_MEMBERSHIP',versionCode:name,title:name,contentText:name,contentHash:hash(name),required:true,audience:'FORMAL_MEMBER',effectiveFrom:time(from),effectiveTo:to==null?null:time(to),approvalReference:'QA'}});
}
async function addApp(old,options={}){
 const p=await db.person.create({data:{legalName:'Fixture member',membershipState:'NETWORK_MEMBER'}});
 const f={legalName:'Fixture',phone:'0900000000',bankCode:'004',formalContractVersionId:old.contractDocumentVersionId,extra:{retain:true}};
 const digest=hash(JSON.stringify(f)),sealed=pii.encrypt(f),id=randomUUID(),snap={formalMemberApplicationId:id,version:1,payloadHash:digest,payloadCiphertext:sealed.ciphertext,keyVersion:sealed.keyVersion,createdAt:time(-5)};
 const app=await db.formalMemberApplication.create({data:{formalMemberApplicationId:id,personId:p.personId,applicantType:options.corp?'LEGAL_ENTITY':'INDIVIDUAL',sourceChannel:options.paper?'ADMIN_PAPER':'MEMBER_WEB',status:options.submitted?'SUBMITTED':'DRAFT',submittedAt:options.submitted?time(-3):null,currentSnapshotHash:digest,...(options.paper?{paperApplicationReference:'QA-'+id,enteredBy:randomUUID(),enteredAt:time(-5)}:{})}});
 await db.formalMemberApplicationSnapshot.create({data:snap});
 const document=(type,at)=>db.formalApplicationDocument.create({data:{formalMemberApplicationId:id,documentType:type,status:'PRESENT',storageObjectKey:randomUUID(),contentSha256:hash(type),mimeType:'image/png',sizeBytes:54,uploadedAt:at}});
 await document('BANKBOOK_COVER',time(-4));
 if(options.signature)await document('SIGNED_APPLICATION_AGREEMENT',time(options.signature));
 if(options.equalSnapshot)await db.formalMemberApplicationSnapshot.create({data:{...snap,version:2,createdAt:time(0)}});
 return {app,id,p:p.personId,f,digest};
}
async function makePackageOrder(tx,purpose,personId,qualificationId){
  const packageClass=purpose==='ENTRY'?'QUALIFICATION':'ACTIVE_DURATION';
  const profile=await tx.packageProfileVersion.findFirstOrThrow({where:{profile:{packageClass,stableCode:purpose==='ENTRY'?'STARTER':'ACTIVE_QUARTER'},...(purpose==='REPURCHASE'?{activeDurationValue:3}:{})},include:{profile:true}});
  const o=await tx.order.create({data:{qualificationId:qualificationId,purpose,status:'CONFIRMED',grossAmount:profile.priceAmount,discountAmount:'0',netAmount:profile.priceAmount,ruleVersionCode:'QA'}});
  await tx.packagePurchaseSnapshot.create({data:{orderId:o.orderId,personId:personId,targetQualificationId:purpose==='REPURCHASE'?qualificationId:null,
    packageProfileVersionId:profile.packageProfileVersionId,packageCode:profile.profile.stableCode,packageName:profile.displayName,packageClass,
    currency:profile.currency,priceAmount:profile.priceAmount,selectableProductQuantity:profile.selectableProductQuantity,
    membershipEffect:profile.membershipEffect,qualificationEffect:profile.qualificationEffect,activeDurationUnit:profile.activeDurationUnit,
    activeDurationValue:profile.activeDurationValue,recognitionConfigRef:profile.recognitionConfigRef??'QA',packageConfigHash:profile.configHash,purchasedAt:time(-3),paymentDeadline:time(3)}});
  return o.orderId;
}
async function run(){
 const old=await contract('old',-8,-2),current=await contract('current',-2,null),actor=randomUUID();
 const body=x=>({confirmed:true,expectedSnapshotHash:x.digest,contractVersionId:current.contractDocumentVersionId,contentHash:current.contentHash});
 const update=(x,p=x.p,b=body(x))=>db.$transaction(tx=>rules.renewContract(tx,x.id,p,p??actor,b,randomUUID()));
 const state=x=>rules.renewalView(db,x.id,x.p);
 const unsigned=await addApp(old);
 assert.equal((await state(unsigned)).requiresRefresh,true);
 const {MemberContractRenewalController,AdminContractRenewalController}=load('contract-renewal.controller');
 const self=new MemberContractRenewalController(db),staff=new AdminContractRenewalController(db);
 const request=personId=>({user:{personId},requestId:randomUUID()});
 assert.equal((await self.read(unsigned.id,request(unsigned.p))).requiresRefresh,true);
 assert.equal((await staff.read(unsigned.id)).requiresRefresh,true);
 await assert.rejects(()=>self.read(unsigned.id,request(randomUUID())),error('FORMAL_APPLICATION_NOT_FOUND'));
 const {FormalKycDocumentService}=load('formal-kyc-document.service');
 const documents=new FormalKycDocumentService(db,{put:async()=>{}},{write:async()=>{}});
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==';
 assert.equal((await documents.listOwn(unsigned.p,unsigned.id)).signingContext,null);
 await assert.rejects(()=>documents.upload(unsigned.p,unsigned.id,'SIGNED_APPLICATION_AGREEMENT','image/png',png,randomUUID(),unsigned.digest),error('FORMAL_CONTRACT_REFRESH_REQUIRED'));
 await assert.rejects(()=>documents.adminUpload(unsigned.id,'SIGNED_APPLICATION_AGREEMENT','image/png',png,actor,randomUUID()),error('FORMAL_CONTRACT_REFRESH_REQUIRED'));
 const {FormalEnrollmentService}=load('formal-enrollment.service');
 const enrollment=new FormalEnrollmentService(db,{}, {execute:(scope,key,body,write)=>db.$transaction(write)},{write:async()=>{}},{});
 await assert.rejects(()=>enrollment.submit(unsigned.p,unsigned.id,randomUUID(),randomUUID()),error('FORMAL_CONTRACT_REFRESH_REQUIRED'));
 assert.equal(await db.formalMemberApplicationSnapshot.count({where:{formalMemberApplicationId:unsigned.id}}),1);
 await assert.rejects(()=>update(unsigned,randomUUID()),error('FORMAL_APPLICATION_NOT_FOUND'));
 await assert.rejects(()=>update(unsigned,unsigned.p,{...body(unsigned),expectedSnapshotHash:hash('stale')}),error('FORMAL_APPLICATION_VERSION_CONFLICT'));
 await assert.rejects(()=>rules.checkContract(db,unsigned.id,'sign'),error('FORMAL_CONTRACT_REFRESH_REQUIRED'));
 await assert.rejects(()=>rules.checkContract(db,unsigned.id,'submit'),error('FORMAL_CONTRACT_REFRESH_REQUIRED'));
 const bundles=[];
 for(const [plan,num] of [['EXCELLENCE',3],['CUSTOM',2]]){
   const enrol=plan==='EXCELLENCE'?unsigned:await addApp(old);
   const bundleId=randomUUID();
   await db.$transaction(async tx=>{
     await tx.$executeRaw`INSERT INTO membership.enrollment_bundle(bundle_id,application_id,person_id,request_hash,plan_code,payment_policy)
       VALUES (${bundleId}::uuid,${enrol.id}::uuid,${enrol.p}::uuid,${hash(plan)},${plan},'COMBINED')`;
     for(let position=1;position<=num;position++){
       const q=await tx.qualification.create({data:{currentHolderPersonId:enrol.p,planLevelCode:'STARTER'}});
       const entry=await makePackageOrder(tx,'ENTRY',enrol.p,q.qualificationId),repurchase=await makePackageOrder(tx,'REPURCHASE',enrol.p,q.qualificationId);
       await tx.$executeRaw`INSERT INTO membership.enrollment_bundle_ball(bundle_id,position,qualification_id,qualification_order_id,repurchase_order_id)
         VALUES(${bundleId}::uuid,${position},${q.qualificationId}::uuid,${entry}::uuid,${repurchase}::uuid)`;
     }
   });
   const read=()=>db.$queryRaw`SELECT to_jsonb(b) AS bundle,to_jsonb(bb) AS ball,to_jsonb(o) AS order_data,to_jsonb(s) AS package
     FROM membership.enrollment_bundle b JOIN membership.enrollment_bundle_ball bb USING(bundle_id)
     JOIN commerce."order" o ON o.order_id IN(bb.qualification_order_id,bb.repurchase_order_id)
     JOIN commerce.package_purchase_snapshot s ON s.order_id=o.order_id WHERE b.bundle_id=${bundleId}::uuid
     ORDER BY bb.position,o.purpose`;
   const before=await read(),totalOrders=await db.order.count();
   const [a,c]=await Promise.all([update(enrol),update(enrol)]);assert.equal(a.snapshotHash,c.snapshotHash);assert.equal(a.version,2);
   assert.deepEqual(await read(),before);assert.equal(await db.order.count(),totalOrders);bundles.push(plan);
   const snapshots=await db.formalMemberApplicationSnapshot.findMany({where:{formalMemberApplicationId:enrol.id},orderBy:{version:'asc'}});
   assert.equal(snapshots.length,2);assert.deepEqual(pii.decrypt(snapshots[1].payloadCiphertext,snapshots[1].keyVersion),{...enrol.f,formalContractVersionId:current.contractDocumentVersionId});
   assert.equal((await db.formalApplicationDocument.findFirstOrThrow({where:{formalMemberApplicationId:enrol.id,documentType:'BANKBOOK_COVER'}})).status,'PRESENT');
 }
 const signed=await addApp(old,{signature:-4,equalSnapshot:true});assert.equal((await state(signed)).preservedSignature,true);assert.equal((await state(signed)).requiresRefresh,false);await rules.checkContract(db,signed.id,'submit');await assert.rejects(()=>rules.checkContract(db,signed.id,'sign'),error('FORMAL_CONTRACT_REFRESH_REQUIRED'));await assert.rejects(()=>update(signed),error('FORMAL_APPLICATION_VERSION_CONFLICT'));
 assert.equal((await state(signed)).current.content,undefined);
 const oldApp=await db.formalMemberApplication.findUniqueOrThrow({where:{formalMemberApplicationId:signed.id},include:{snapshots:{orderBy:{version:'desc'},take:1}}});
 const newForm={...signed.f,formalContractVersionId:current.contractDocumentVersionId};
 assert.deepEqual(await rules.priorUnchanged(db,oldApp,newForm),signed.f);
 await assert.rejects(()=>rules.priorUnchanged(db,oldApp,{...newForm,phone:'0900999999'}),error('FORMAL_CONTRACT_REFRESH_REQUIRED'));
 await db.consentEvidence.create({data:{personId:signed.p,contractDocumentVersionId:current.contractDocumentVersionId,contentHashSnapshot:current.contentHash,
   channel:'MEMBER_WEB',requestId:randomUUID(),correlationId:randomUUID(),evidenceHash:hash('synthetic-explicit-consent')}});
 assert.equal(await rules.priorUnchanged(db,oldApp,{...newForm,phone:'0900999999'}),null);
 await db.person.update({where:{personId:signed.p},data:{status:'EFFECTIVE',securityStatus:'NORMAL',mobile:signed.f.phone,mobileVerifiedAt:time(-4)}});
 await db.consentEvidence.create({data:{personId:signed.p,contractDocumentVersionId:old.contractDocumentVersionId,contentHashSnapshot:old.contentHash,
   channel:'MEMBER_WEB',acceptedAt:time(-4),requestId:randomUUID(),correlationId:randomUUID(),evidenceHash:hash('synthetic-original-consent')}});
 for(const documentType of ['IDENTITY_FRONT','IDENTITY_BACK']){
   await db.formalApplicationDocument.create({data:{formalMemberApplicationId:signed.id,documentType,status:'PRESENT',storageObjectKey:randomUUID(),contentSha256:hash(documentType),mimeType:'image/png',sizeBytes:54,uploadedAt:time(-4)}});
 }
 const qualification=await db.qualification.create({data:{currentHolderPersonId:signed.p,planLevelCode:'STARTER'}});
 const pending=await makePackageOrder(db,'ENTRY',signed.p,qualification.qualificationId);
 assert.equal((await enrollment.submit(signed.p,signed.id,randomUUID(),randomUUID(),{orderId:pending,paymentMethod:'BANK_TRANSFER'})).status,'SUBMITTED');
 assert.equal((await db.formalMemberApplication.findUniqueOrThrow({where:{formalMemberApplicationId:signed.id}})).currentSnapshotHash,signed.digest);
 const bad=await addApp(old,{signature:-1});assert.equal((await state(bad)).requiresRefresh,true);await update(bad);assert.equal((await db.formalApplicationDocument.findFirstOrThrow({where:{formalMemberApplicationId:bad.id,documentType:'SIGNED_APPLICATION_AGREEMENT'}})).status,'SUPERSEDED');
 const sent=await addApp(old,{submitted:true});assert.equal((await state(sent)).requiresRefresh,false);await assert.rejects(()=>update(sent),error('FORMAL_APPLICATION_VERSION_CONFLICT'));
 for(const corp of [false,true]){
   const paper=await addApp(old,{paper:true,corp});
   const {FormalMemberApplicationService}=load('formal-member-application.service');
   const formal=new FormalMemberApplicationService(db,{}, {write:async()=>{}},pii,{});
   await assert.rejects(()=>formal.reviewPaperEvidence(paper.id,'SIGNED_APPLICATION_AGREEMENT','REVIEWED','QA','QA',actor,randomUUID()),error('FORMAL_CONTRACT_REFRESH_REQUIRED'));
   const where={formalMemberApplicationId:paper.id};await db.formalPaperEvidence.createMany({data:[{...where,evidenceType:'SIGNED_APPLICATION_AGREEMENT',status:'PENDING'},{...where,evidenceType:'BANKBOOK_COVER',status:'REVIEWED',reviewedAt:time(-4),reviewedBy:actor}]});
   assert.equal((await state(paper)).canRefresh,false);await assert.rejects(()=>update(paper),error('FORMAL_APPLICATION_NOT_FOUND'));
   await update(paper,null);
   assert.equal((await db.formalPaperEvidence.findFirstOrThrow({where:{...where,evidenceType:'BANKBOOK_COVER'}})).status,'REVIEWED');
 }
 const roundCase=await addApp(old,{paper:true,signature:-4}),{id,p}=roundCase;
 await db.person.update({where:{personId:p},data:{mobileVerifiedAt:time(-6)}});
 await db.identityLink.create({data:{personId:p,provider:'LINE',providerSubject:randomUUID()}});
 const proofs=await db.formalApplicationDocument.findMany({where:{formalMemberApplicationId:id},select:{formalApplicationDocumentId:true,documentType:true}});
 const bank=proofs.find(d=>d.documentType==='BANKBOOK_COVER').formalApplicationDocumentId;
 await db.formalApplicationDocument.update({where:{formalApplicationDocumentId:bank},data:{uploadedByPersonId:p}});
 const roundModule=load('paper-reconfirmation',{'./contract-renewal':rules});
 const oldRound=await roundModule.startRound(db,id,actor,{note:'reconfirm',version:1,changes:['身分資料'],documents:['BANKBOOK_COVER']});
 await db.$executeRaw`UPDATE identity.paper_reconfirmation SET proof_ids=ARRAY[${bank}::uuid] WHERE id=${oldRound.id}::uuid`;
 assert.equal((await state(roundCase)).canRefresh,false);
 await assert.rejects(()=>update(roundCase),error('FORMAL_APPLICATION_NOT_FOUND'));
 await roundModule.memberRound(db,id,p,'view',{roundId:oldRound.id});
 assert.equal((await state(roundCase)).requiresRefresh,true);
 await assert.rejects(()=>roundModule.memberRound(db,id,p,'submit',{roundId:oldRound.id,version:1}),error('FORMAL_CONTRACT_REFRESH_REQUIRED'));
 const renewed=await update(roundCase),r=await roundModule.latestRound(db,id);
 assert.equal(r.version,2);assert.equal(r.hash,renewed.snapshotHash);assert.equal(r.contractId,current.contractDocumentVersionId);
 assert.deepEqual(r.proofIds,[bank]);assert.equal(r.viewedAt,null);
 assert.equal((await db.$queryRaw`SELECT status FROM identity.paper_reconfirmation WHERE id=${oldRound.id}::uuid`)[0].status,'REPLACED');
 await assert.rejects(()=>roundModule.memberRound(db,id,p,'submit',{roundId:oldRound.id,version:1}),error('PAPER_CONFIRM_REQUIRED'));
 assert.deepEqual((await roundModule.memberRound(db,id,p,'view',{roundId:r.id})).received,['BANKBOOK_COVER']);
 const precisionId=randomUUID();
 await db.$executeRaw`INSERT INTO identity.contract_document_version(contract_document_version_id,contract_type,version_code,title,content_text,content_hash,audience,required,effective_from,effective_to,approval_reference)
   VALUES(${precisionId}::uuid,'FORMAL_MEMBERSHIP','precision','precision','precision',${hash('precision')},'FORMAL_MEMBER',true,${time(-8)},date_trunc('milliseconds',${time(-2)}::timestamptz)+interval '610 microseconds','QA')`;
 const boundary=await addApp({contractDocumentVersionId:precisionId},{signature:-3});
 await db.$executeRaw`UPDATE identity.formal_application_document SET uploaded_at=(SELECT effective_to-interval '1 microsecond' FROM identity.contract_document_version WHERE contract_document_version_id=${precisionId}::uuid) WHERE formal_member_application_id=${boundary.id}::uuid AND document_type='SIGNED_APPLICATION_AGREEMENT'`;
 assert.equal((await state(boundary)).preservedSignature,true);
 await db.$executeRaw`UPDATE identity.formal_application_document SET uploaded_at=uploaded_at+interval '1 microsecond' WHERE formal_member_application_id=${boundary.id}::uuid AND document_type='SIGNED_APPLICATION_AGREEMENT'`;
 assert.equal((await state(boundary)).requiresRefresh,true);
 console.log('PASS real candidate + PostgreSQL: owner scope, stale inputs, simultaneous renewal/retry, read-only GET, preserved same-content old signature, rejected late signature, untouched submission, personal/corporate paper, KYC, identical EXCELLENCE and CUSTOM order/ball/repurchase snapshots.');
}
(async()=>{let created=false;try{
 await admin.$executeRawUnsafe('CREATE DATABASE "'+dbName+'" TEMPLATE "'+template+'"');created=true;
 if(process.env.PAPER_MIGRATIONS){
   for(const name of ['20261103180000_paper_reconfirmation','20261103181500_paper_round_proofs']){
     const ddl=fs.readFileSync(path.join(process.env.PAPER_MIGRATIONS,name,'migration.sql'),'utf8');
     for(const statement of ddl.split(';').map(s=>s.trim()).filter(Boolean))await db.$executeRawUnsafe(statement);
   }
 }
 await run();
}finally{await db.$disconnect();if(created)await admin.$executeRawUnsafe('DROP DATABASE "'+dbName+'" WITH (FORCE)');await admin.$disconnect();}})().catch(e=>{console.error(e);process.exitCode=1;});
