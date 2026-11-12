'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {randomUUID,randomBytes,createHash}=require('node:crypto');
const [base,release,dist,template]=process.argv.slice(2),control=new URL(process.env.DATABASE_URL);
assert.equal(control.hostname,'127.0.0.1');assert.equal(control.pathname,'/postgres');assert.match(template,/^ucell_jest_[0-9a-f]{32}$/);
const req=Module.createRequire(path.resolve(dist,'main.js'));
req('reflect-metadata');
const {PrismaClient}=req('@prisma/client'),{PiiCryptoService}=req('@ucell/database');
process.env.PII_ENCRYPTION_KEY=randomBytes(32).toString('base64');process.env.PII_ENCRYPTION_KEY_VERSION='synthetic';
const dbName='ucell_jest_'+randomUUID().replaceAll('-',''),target=new URL(control);target.pathname='/'+dbName;
const admin=new PrismaClient({datasourceUrl:control.href}),db=new PrismaClient({datasourceUrl:target.href});
const {migration}=require('./migrate.cjs'),{patch,expected}=require('./install.cjs'),sql=fs.readFileSync(path.join(release,'migration.sql'),'utf8');
const cache=new Map();
function load(unit){
 if(cache.has(unit))return cache.get(unit);
 const virtual=path.resolve(dist,'modules',unit+'.js'),m=new Module(virtual);
 const filepath=path.join(base,unit+'.js');
 let js;
 if(unit in expected){js=patch(unit,fs.readFileSync(filepath,'utf8'));}
 else if(unit==='member/contract-renewal'&&process.env.TEST_CONTRACT_MODULE){js=fs.readFileSync(process.env.TEST_CONTRACT_MODULE,'utf8');}
 else if(unit.startsWith('member/formal-payout-method')){js=fs.readFileSync(path.join(release,path.basename(unit)+'.js'),'utf8');}
 else return req(virtual);
 m.filename=virtual;m.paths=Module._nodeModulePaths(path.dirname(virtual));
 const need=m.require.bind(m);
 m.require=id=>{
   if(id.startsWith('.')){
    const other=path.posix.normalize(path.posix.join(path.posix.dirname(unit),id));
    if(other in expected||other.startsWith('member/formal-payout-method'))return load(other);
    if(other==='admin-operations/bank-payout-artifact'&&process.env.TEST_BANK_ARTIFACT){
      const ref=path.resolve(process.env.TEST_BANK_ARTIFACT),name=path.basename(ref),dir=path.dirname(ref),original=path.resolve(dist,'modules/admin-operations');
      for(const n of [name,'bank-template-workbook.js'])assert.deepEqual(fs.readFileSync(path.join(original,n)),fs.readFileSync(path.join(dir,n)));
      return require(ref);
    }
    if(other==='member/contract-renewal'&&process.env.TEST_CONTRACT_MODULE)return load(other);
   }
   return need(id);
 };
 m._compile(js,virtual);cache.set(unit,m.exports);return m.exports;
}
const core=load('member/formal-payout-method'),pii=new PiiCryptoService(),actor=randomUUID(),request={user:{personId:actor,role:'MEMBERSHIP_OPS'},requestId:randomUUID()};
const {AuditService}=req('./common/audit/audit.service'),{IdempotencyService}=req('./common/idempotency/idempotency.service');
const {FormalPayoutMethodController}=load('member/formal-payout-method.controller');
const controller=new FormalPayoutMethodController(db,new IdempotencyService(db),new AuditService());
const {FormalMemberApplicationService}=load('member/formal-member-application.service');
const {IdentityMatchFingerprintService}=req('./common/security/identity-match-fingerprint.service');
process.env.IDENTITY_MATCH_HMAC_SECRET=randomBytes(32).toString('hex');
const appService=new FormalMemberApplicationService(db,new IdempotencyService(db),new AuditService(),pii,new IdentityMatchFingerprintService());
const err=code=>e=>e.getResponse?.()?.code===code;
const hash=s=>createHash('sha256').update(s).digest('hex');
async function fixture(paper,corp=false){
 const no='QA'+randomUUID().slice(0,8),name='Fixture QA',identity='QA'+randomUUID();
 const p=await db.person.create({data:{legalName:name,memberNo:no,membershipState:'NETWORK_MEMBER'}});
 const f={legalName:name,identityDocumentNumber:identity},h=hash(JSON.stringify(f)),sealed=pii.encrypt(f);
 const app=await db.formalMemberApplication.create({data:{personId:p.personId,status:'SUBMITTED',applicantType:corp?'LEGAL_ENTITY':'INDIVIDUAL',sourceChannel:paper?'ADMIN_PAPER':'MEMBER_WEB',currentSnapshotHash:h,...(paper?{paperApplicationReference:'QA-'+randomUUID(),enteredBy:actor,enteredAt:new Date()}:{})}});
 const id=app.formalMemberApplicationId;
 await db.formalMemberApplicationSnapshot.create({data:{formalMemberApplicationId:id,version:1,payloadHash:h,payloadCiphertext:sealed.ciphertext,keyVersion:sealed.keyVersion}});
 return {id,app,p,name,no,identity};
}
const method=(id,method,expectedMethod,expectedVersion,key=randomUUID())=>controller.change(id,{method,expectedMethod,expectedVersion},request,key);
const CASH='COMPANY_CASH',BANK='BANK_TRANSFER',sig='SIGNED_APPLICATION_AGREEMENT';
async function run(){
 const migrate=command=>db.$transaction(tx=>migration(tx,command,sql));
 assert.equal((await migrate('check')).status,'pending');
 await assert.rejects(db.$transaction(async tx=>{assert.equal((await migration(tx,'trial',sql)).status,'trial');throw Error('rollback');}),/rollback/);
 assert.equal((await migrate('check')).status,'pending');assert.equal((await migrate('apply')).status,'applied');assert.equal((await migrate('apply')).status,'applied');
 const mutateRoles=Reflect.getMetadata('roles',FormalPayoutMethodController.prototype.change);assert.deepEqual(mutateRoles,['SUPER_ADMIN','MEMBERSHIP_OPS']);
 const w=await fixture(false),corp=await fixture(true,true);
 assert.deepEqual(await controller.read(w.id),{method:BANK,version:0,editable:true});
 const key=randomUUID();assert.equal((await method(w.id,CASH,BANK,0,key)).method,CASH);assert.equal((await method(w.id,CASH,BANK,0,key)).version,1);
 await assert.rejects(method(w.id,BANK,BANK,0),err('FORMAL_PAYOUT_METHOD_CONFLICT'));
 for(const kind of ['IDENTITY_FRONT','IDENTITY_BACK'])await db.formalApplicationDocument.create({data:{formalMemberApplicationId:w.id,documentType:kind,status:'PRESENT',storageObjectKey:randomUUID(),contentSha256:hash(kind),mimeType:'image/png',sizeBytes:32,uploadedAt:new Date()}});
 assert.deepEqual((await appService.evidenceGate(w.id)).codes,[sig+'_MISSING']);
 await db.formalApplicationDocument.create({data:{formalMemberApplicationId:w.id,documentType:sig,status:'PRESENT',storageObjectKey:randomUUID(),contentSha256:hash(sig),mimeType:'image/png',sizeBytes:32,uploadedAt:new Date()}});
 assert.equal((await appService.evidenceGate(w.id)).ready,true);
 assert.equal(await db.formalMemberApplicationSnapshot.count({where:{formalMemberApplicationId:w.id}}),1);
 assert.equal(await db.auditEvent.count({where:{action:'FORMAL_PAYOUT_METHOD_CHANGED',entityId:w.id}}),1);
 assert.equal((await method(w.id,BANK,CASH,1)).version,2);
 assert.deepEqual((await appService.evidenceGate(w.id)).codes,['FORMAL_BANK_CODE_REQUIRED','FORMAL_BANK_ACCOUNT_REQUIRED','FORMAL_ACCOUNT_HOLDER_REQUIRED']);
 await method(w.id,CASH,BANK,2);
 await method(corp.id,CASH,BANK,0);
 const legal=await appService.evidenceGate(corp.id);
 assert.deepEqual(legal.codes,[sig,'CORPORATE_REGISTRATION','REPRESENTATIVE_IDENTITY_FRONT','REPRESENTATIVE_IDENTITY_BACK'].map(k=>k+'_REVIEW_REQUIRED'));
 for(const code of legal.codes)await db.formalPaperEvidence.create({data:{formalMemberApplicationId:corp.id,evidenceType:code.replace('_REVIEW_REQUIRED',''),status:'REVIEWED',reviewedAt:new Date(),reviewedBy:actor,sourceReference:'QA'}});
 assert.equal((await appService.evidenceGate(corp.id)).ready,true);
 for(const data of [w,corp])await db.$transaction(async tx=>{await core.saveApprovedMethod(tx,{...data.app,legalEntityId:data===corp?corp.id:null});await tx.formalMemberApplication.update({where:{formalMemberApplicationId:data.id},data:{status:'APPROVED'}});});
 await assert.rejects(method(w.id,BANK,CASH,3),err('FORMAL_PAYOUT_METHOD_CONFLICT'));
 assert.equal(await core.holderMethod(db,'PERSON',w.p.personId),CASH);assert.equal(await core.holderMethod(db,'LEGAL_ENTITY',corp.id),CASH);
 await paperApproval();
 const entity=await paperApproval(true);
 await payout(w,entity);
 console.log('PASS migration trial/apply/replay, role metadata, CAS & idempotency, audit, immutable snapshot, paper/web gates, bank revalidation, holder mapping, cash-only/mixed/bank reports and receipt.');
}
async function paperApproval(corporate=false){
 const text='QA '+randomUUID(),contract=await db.contractDocumentVersion.create({data:{contractType:'FORMAL_MEMBERSHIP',versionCode:text,title:text,contentText:text,contentHash:hash(text),audience:'FORMAL_MEMBER',required:true,effectiveFrom:new Date(Date.now()-1000),approvalReference:'TEST'}});
 const p=await db.person.create({data:{legalName:'Fixture',status:'EFFECTIVE',membershipState:'NETWORK_MEMBER'}});
 const payload={applicantType:'INDIVIDUAL',formalContractVersionId:contract.contractDocumentVersionId,representativePersonId:p.personId,paperApplicationReference:'QA-'+randomUUID(),legalName:'Fixture',gender:'UNDISCLOSED',birthDate:'1990-01-02',nationalityCode:'TW',identityDocumentType:'NATIONAL_ID',identityDocumentNumber:'QA'+randomUUID(),communicationAddress:'QA',phone:'+886900000000',payoutMethod:CASH};
 await assert.rejects(appService.createPaper({...payload,payoutMethod:BANK},actor,randomUUID(),randomUUID()),err('FORMAL_BANK_CODE_REQUIRED'));
 if(corporate)Object.assign(payload,{applicantType:'LEGAL_ENTITY',legalEntityName:'Fixture',legalEntityRegistrationNo:'QA'+randomUUID(),legalEntityRegisteredAddress:'QA',legalEntityRegistrationCountryCode:'TW',representativeLegalName:'Fixture QA',representativeNationalityCode:'TW',representativeIdentityDocumentType:'NATIONAL_ID',representativeIdentityDocumentNumber:payload.identityDocumentNumber});
 const {value}=await appService.createPaper(payload,actor,randomUUID(),randomUUID());const id=value.id;
 assert.equal((await controller.read(id)).method,CASH);
 const complete=corporate?['SIGNED_APPLICATION_AGREEMENT','CORPORATE_REGISTRATION','REPRESENTATIVE_IDENTITY_FRONT','REPRESENTATIVE_IDENTITY_BACK']:['SIGNED_APPLICATION_AGREEMENT','IDENTITY_FRONT','IDENTITY_BACK'];
 for(const type of complete)await appService.reviewPaperEvidence(id,type,'REVIEWED','QA','test',actor,randomUUID());
 assert.equal((await appService.beginReview(id,actor,randomUUID())).status,'UNDER_REVIEW');
 assert.equal((await appService.approve(id,actor,randomUUID())).status,'APPROVED');
 if(corporate){
  const app=await db.formalMemberApplication.findUnique({where:{formalMemberApplicationId:id},include:{legalEntity:true}});
  assert.equal(await core.holderMethod(db,'LEGAL_ENTITY',app.legalEntityId),CASH);
  assert.equal(await core.holderMethod(db,'PERSON',p.personId),BANK);
  return app.legalEntity;
 }
 assert.equal(await core.holderMethod(db,'PERSON',p.personId),CASH);
}
async function payout(w,entity){
 const {NhiPayoutService}=load('nhi-payout/nhi-payout.service'),service=new NhiPayoutService(db,{});
 const finance={role:'FINANCE',personId:actor},day=req('./modules/nhi-payout/nhi-calculation').taipeiDay(new Date());
 const profile={legalName:w.name,identityNumber:w.identity.toUpperCase(),validFrom:'2026-01-01',validTo:'2027-12-31',treatment:'STANDARD',reason:'QA'};
 const saved=await service.saveProfile(w.no,{...profile},finance);assert.equal(saved.payoutMethod,CASH);assert.equal(saved.accountMasked,null);
 const b=await fixture(false),bankData={bankBranchCode:'0040000',accountNumber:'1234567890',accountName:b.name};
 await assert.rejects(service.saveProfile(b.no,{...profile,identityNumber:b.identity.toUpperCase()},finance),/帳號/);
 await db.formalMemberApplication.update({where:{formalMemberApplicationId:b.id},data:{status:'APPROVED'}});
 const savedBank=await service.saveProfile(b.no,{...profile,identityNumber:b.identity.toUpperCase(),...bankData},finance);assert.equal(savedBank.payoutMethod,BANK);
 if(process.env.TEST_LEGAL_ENTITY_SCHEMA){
  const [exists]=await db.$queryRawUnsafe("SELECT to_regclass('ledger.nhi_payout_entity_profile') IS NOT NULL AS ok");
  if(!exists.ok){
   const ddl=fs.readFileSync(process.env.TEST_LEGAL_ENTITY_SCHEMA,'utf8').match(/CREATE TABLE ledger\.nhi_payout_entity_profile\s*\([\s\S]*?\);/);
   assert.ok(ddl);await db.$executeRawUnsafe(ddl[0]);
  }
 }
 const company=await service.saveProfile(entity.memberNo,{...profile,legalName:entity.registeredName,identityNumber:entity.registrationNo,treatment:'NOT_APPLICABLE',reason:'QA',evidence:'QA'},finance);
 assert.equal(company.payoutMethod,CASH);assert.equal(company.accountMasked,null);
 const bid=randomUUID(),line=(user,party,id)=>({payoutLineId:randomUUID(),recipientQualificationId:randomUUID(),grossAmount:'20000',recoveryOffset:'0',netAmount:'20000',payableEntries:[],recipient:{ballNo:randomUUID(),kind:'MEMBER_ORIGIN'},detailJson:{payee:{party,id,no:user}}});
 const lines=[line(entity.memberNo,'LEGAL_ENTITY',entity.legalEntityId),line(w.no,'PERSON',w.p.personId),line(b.no,'PERSON',b.p.personId)];
 const summary=await db.$transaction(async tx=>{
   const forPreview=new Proxy(tx,{get(target,key){if(key==='payoutBatch')return {findMany:async()=>[{payoutBatchId:bid,status:'READY',approvals:[],paymentResults:[],lines}]};return target[key];}});
   return service.previewTx(forPreview,{payDate:day,batchIds:[bid]});
 });
 assert.deepEqual(summary.issues,[]);assert.equal(summary.groups.length,3);
 assert.equal(summary.groups.find(g=>g.legalEntityId===entity.legalEntityId).nhi,'0');
 assert.equal(summary.groups.find(g=>g.personId===w.p.personId).transfer,summary.groups.find(g=>g.personId===b.p.personId).transfer);
 const personGroup=async (user,method)=>({id:randomUUID(),personId:user.p.personId,memberNo:user.no,payoutMethod:method,
   profile:(await db.$queryRawUnsafe('SELECT payload FROM ledger.nhi_payout_profile WHERE person_id=$1::uuid',user.p.personId))[0].payload,lines:[],
   gross:'20000',taxBase:'20000',nhi:'422',transfer:'19578.0000',other:'0',recovery:'0',reason:'QA'});
 const groups=[await personGroup(w,CASH),await personGroup(b,BANK)],rule={rate:'0.0211',version:'qa'};
 for(const set of [[groups[0]],groups,[groups[1]]]){
  const id=randomUUID(),reference='QA-'+id,runStatus=async()=>(await db.$queryRawUnsafe('SELECT status FROM ledger.nhi_payout_run WHERE id=$1::uuid',id))[0].status;
  await db.$executeRawUnsafe("INSERT INTO ledger.nhi_payout_run(id,reference,pay_date,status,snapshot,created_by) VALUES ($1::uuid,$2,$3::date,'APPROVED',$4::jsonb,$5::uuid)",id,reference,day,JSON.stringify({rule,groups:set,batchIds:[]}),actor);
  const read=async kind=>Buffer.from((await service.download(id,kind,finance)).contentBase64,'base64').toString('utf8');
  const hasCash=set.includes(groups[0]),hasBank=set.includes(groups[1]);
  const nhi=await read('NHI');assert.equal(nhi.includes(w.identity.toUpperCase()),hasCash);assert.equal(nhi.includes(b.identity.toUpperCase()),hasBank);assert.match(nhi,/422/);
  if(hasCash){if(!hasBank)await assert.rejects(read('BANK'),/領現/);
    const csv=await read('CASH');assert.match(csv,/待領取/);assert.ok(csv.includes(w.no)&&!csv.includes(b.no)&&!csv.includes(bankData.accountNumber));assert.equal(await runStatus(),'EXPORTED');
    const body={groupId:groups[0].id,amount:'19578',reference:'Signed QA',status:'PAID',occurredAt:new Date().toISOString()};
    await assert.rejects(service.result(id,body,finance),/領款方式/);
    await assert.rejects(service.result(id,{...body,payoutMethod:CASH,amount:'0'},finance),/金額/);
    assert.equal((await service.result(id,{...body,payoutMethod:CASH},finance)).ok,true);
    assert.equal((await service.result(id,{...body,payoutMethod:CASH},finance)).replayed,true);
  }else{await assert.rejects(read('CASH'),/沒有公司領現/);}
  if(hasBank){
    const csv=await read('BANK');assert.ok(csv.includes(b.no)&&csv.includes(bankData.accountNumber)&&!csv.includes(w.no));
    const xls=await service.download(id,'BANK_XLS',finance);assert.ok(xls.contentBase64);
    await service.result(id,{groupId:groups[1].id,amount:'19578',reference:'Bank QA',status:'PAID',occurredAt:new Date().toISOString()},finance);
  }
  assert.equal(await runStatus(),'PAID');
 }
}
(async()=>{let cloned=false;try{await admin.$executeRawUnsafe('CREATE DATABASE "'+dbName+'" TEMPLATE "'+template+'"');cloned=true;await run();}
 finally{await db.$disconnect();if(cloned)await admin.$executeRawUnsafe('DROP DATABASE "'+dbName+'"');await admin.$disconnect();}})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
