import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {runMemberAdminIntegration} from './member-admin-integration-cases.mjs';
const require=createRequire(new URL('../package.json',import.meta.url)),apiRequire=createRequire(new URL('../apps/api/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const {NestFactory}=apiRequire('@nestjs/core'),{FastifyAdapter}=apiRequire('@nestjs/platform-fastify');
const {ValidationPipe,UnauthorizedException}=apiRequire('@nestjs/common');
const {ConfigService}=apiRequire('@nestjs/config');
const {SwaggerModule,DocumentBuilder}=apiRequire('@nestjs/swagger');
const {AppModule}=require('./apps/api/dist/app.module.js');
const replay=require('./packages/database/dist/historical-replay.js');
const {RpvService}=require('./apps/api/dist/modules/rpv/rpv.service.js');
const {EpvService}=require('./apps/api/dist/modules/epv/epv.service.js');
const {EpvMonthService}=require('./apps/api/dist/modules/epv/epv-month.service.js');
const {RuntimeRuleService}=require('./apps/api/dist/modules/rules/runtime-rule.service.js');
const {BonusQueryService}=require('./apps/api/dist/modules/bonus/bonus-query.service.js');
const {LineTokenVerifierService}=require('./apps/api/dist/modules/auth/line-token-verifier.service.js');
const {IdentityTokenService}=require('./apps/api/dist/modules/auth/identity-token.service.js');
const {MemberService}=require('./apps/api/dist/modules/member/member.service.js');
const {MemberShareLinkService}=require('./apps/api/dist/modules/member/member-share-link.service.js');
const {OtpCodeService}=require('./apps/api/dist/modules/auth/otp-code.service.js');
const {SmsOtpProviderService}=require('./apps/api/dist/modules/auth/sms-otp-provider.service.js');
const {AuditService}=require('./apps/api/dist/common/audit/audit.service.js');
const {claimOutboxLease,processMemberOrderNotification,captureParameters,releaseFailedOutboxLease}=require('./packages/database/dist/index.js');
const {EnvelopeInterceptor}=require('./apps/api/dist/common/interceptors/envelope.interceptor.js');
const {RequestContextInterceptor}=require('./apps/api/dist/common/interceptors/request-context.interceptor.js');
const url=new URL(process.env.DATABASE_URL??'');assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.match(process.env.GOLDEN_ISOLATION_DATABASE??'',/^ucell_dev_golden_[a-f0-9]{32}$/);assert.equal(url.pathname,'/'+process.env.GOLDEN_ISOLATION_DATABASE);
const db=new PrismaClient();let app,assertions=0;const results=[];
function equal(actual,expected,label){assert.deepEqual(actual,expected,label);assertions++;results.push({label,actual,expected,result:'PASS'});}
try{
 process.env.OTP_HASH_SECRET='TEST_ONLY_OTP_HASH_SECRET_32_BYTES_MINIMUM';
 process.env.AUTH_CHANNEL_ENABLE_SMS_OTP='true';
 process.env.PII_ENCRYPTION_KEY='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
 process.env.PII_ENCRYPTION_KEY_VERSION='TEST_ONLY_V1';
 process.env.MEMBER_SHARE_TOKEN_SECRET='TEST_ONLY_MEMBER_SHARE_SECRET_32_BYTES_MINIMUM';
 process.env.MEMBER_REFERRAL_BASE_URL='https://example.invalid';
 process.env.MEMBER_SHARE_TOKEN_TTL_SECONDS='3600';
 const person=await db.person.create({data:{legalName:'MEMBER A TEST ONLY',status:'EFFECTIVE'}});
 const other=await db.person.create({data:{legalName:'MEMBER B TEST ONLY',status:'EFFECTIVE'}});
 const empty=await db.person.create({data:{legalName:'MEMBER EMPTY TEST ONLY',status:'EFFECTIVE'}});
 const contractText='TEST ONLY NETWORK MEMBER CONTRACT';
 const contractHash=createHash('sha256').update(contractText).digest('hex');
 const contract=await db.contractDocumentVersion.create({data:{contractType:'NETWORK_MEMBERSHIP',versionCode:'TEST_ONLY_V1',title:'TEST ONLY NETWORK MEMBER CONTRACT',contentText:contractText,contentHash:contractHash,audience:'NETWORK_MEMBER',required:true,effectiveFrom:new Date('2020-01-01'),approvalReference:'TEST_ONLY_NOT_PRODUCTION_APPROVAL'}});
 const ids=[];
 for(const holder of [person,person,other]){
  const q=await db.qualification.create({data:{currentHolderPersonId:holder.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date('2020-01-01')}});
  await db.qualificationHolderHistory.create({data:{qualificationId:q.qualificationId,holderPersonId:holder.personId,effectiveFrom:new Date('2020-01-01'),sourceType:'TEST_ONLY'}});ids.push(q.qualificationId);
  await db.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom:new Date('2020-01-01'),sourceType:'TEST_ONLY'}});
  await db.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom:new Date('2020-01-01'),sourceType:'TEST_ONLY'}});
 }
 const at=new Date('2026-09-15T16:00:00Z');
 const product=await db.productReference.create({data:{sku:'MEMBER_TEST_ONLY_'+randomUUID(),displayName:'TEST ONLY',currentPrice:1600}});
 const epv=new EpvService(db,new RuntimeRuleService(db),new BonusQueryService(db),new EpvMonthService());
 const monthlyPlan=await db.subscriptionPlan.create({data:{planCode:'MEMBER_TEST_ONLY_'+randomUUID(),displayName:'TEST ONLY',durationMonths:1,prepaidAmount:2000,productBoxQty:1,monthlyRecognizedAmount:2000,monthlyRpv:1200}});
 const orderIds=[];
 for(const [index,id] of ids.slice(0,2).entries()){
  await db.activePeriod.create({data:{qualificationId:id,activeFrom:at,sourceType:'TEST_ONLY',ruleVersionCode:'R1.0B'}});
  const amount=index===0?4800:2800;
  const order=await db.order.create({data:{qualificationId:id,status:'PAID',purpose:'REPURCHASE',grossAmount:amount,netAmount:amount,paidAt:at,ruleVersionCode:'R1.0B',lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:'TEST ONLY',quantity:1,unitPrice:amount,lineAmount:amount,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{testOnly:true,pendingFormalPVMapping:true}}}},include:{lines:true}});orderIds.push(order.orderId);
  await db.$transaction(async tx=>{const event=await tx.pvLedger.create({data:{qualificationId:id,pvType:'GPV',amount:0,sourceType:'ORDER',sourceId:order.orderId,sourceLineId:order.lines[0].orderLineId,eventType:'GPV_CREATED',ruleVersionCode:'R1.0B',occurredAt:at,correlationId:randomUUID()}});await replay.sealGpvEvent(tx,event);});
  await epv.recognizeOrder(order.orderId);
  // Explicit synthetic PV ledger facts: do not infer a formal sale-to-PV mapping.
  await db.pvLedger.create({data:{qualificationId:id,pvType:'PV',amount:index===0?11:23,sourceType:'TEST_ONLY',sourceId:randomUUID(),eventType:'TEST_ONLY_PV_FACT',ruleVersionCode:'R1.0B',occurredAt:at,correlationId:randomUUID()}});
  for(let n=0;n<(index===0?2:1);n++){
   const sub=await db.subscription.create({data:{qualificationId:id,subscriptionPlanId:monthlyPlan.subscriptionPlanId,status:'ACTIVE',startMonth:new Date('2026-09-01'),endMonth:new Date('2026-09-01'),ruleVersionCode:'R1.0B'}});
   const schedule=await db.monthlyRecognitionSchedule.create({data:{subscriptionId:sub.subscriptionId,installmentNo:1,recognitionMonth:new Date('2026-09-01'),recognizedAmount:2000,rpvAmount:1200,dueAt:at,ruleVersionCode:'R1.0B'}});
   await new RpvService(db,{}).recognize(schedule.recognitionId);
  }
 }
 const extra=await db.qualification.create({data:{currentHolderPersonId:other.personId,planLevelCode:'STARTER',status:'EFFECTIVE'}});
 await db.sponsorRelationship.create({data:{sponsorQualificationId:ids[0],childQualificationId:extra.qualificationId,sponsorSequenceNo:1,effectiveFrom:at}});
 await db.binaryPlacement.create({data:{parentQualificationId:ids[0],childQualificationId:extra.qualificationId,side:'LEFT',effectiveFrom:at}});
 await db.sponsorRelationship.create({data:{sponsorQualificationId:ids[0],childQualificationId:ids[2],sponsorSequenceNo:2,effectiveFrom:at}});
 await db.binaryPlacement.create({data:{parentQualificationId:ids[1],childQualificationId:ids[2],side:'LEFT',effectiveFrom:at}});
 const descendant=await db.qualification.create({data:{currentHolderPersonId:other.personId,planLevelCode:'STARTER',status:'EFFECTIVE'}});
 await db.sponsorRelationship.create({data:{sponsorQualificationId:ids[2],childQualificationId:descendant.qualificationId,sponsorSequenceNo:1,effectiveFrom:at}});
 await db.binaryPlacement.create({data:{parentQualificationId:ids[2],childQualificationId:descendant.qualificationId,side:'LEFT',effectiveFrom:at}});
 const subject='TEST_ONLY_'+randomUUID();
 await db.identityLink.create({data:{provider:'LINE',providerSubject:subject,personId:person.personId}});
 app=await NestFactory.create(AppModule,new FastifyAdapter(),{logger:false});
 app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
 app.useGlobalInterceptors(new RequestContextInterceptor(),new EnvelopeInterceptor());
 // Synthetic LINE provider boundary only; production adapter is never bypassable by configuration.
 app.get(LineTokenVerifierService).verify=async token=>{
  if(token==='INVALID_TEST_ONLY')throw new UnauthorizedException({code:'LINE_TOKEN_INVALID'});
  return {subject:token==='UNBOUND_TEST_ONLY'?'TEST_ONLY_UNBOUND':subject,expiresAt:Math.floor(Date.now()/1000)+3600};
 };
 await app.init();const server=app.getHttpAdapter().getInstance();await server.ready();
 let deliveredOtp;app.get(OtpCodeService).generate=()=> '246810';app.get(SmsOtpProviderService).send=async(_destination,code)=>{deliveredOtp=code;return {providerRef:'TEST_ONLY_PROVIDER_REF'}};
 const registrationSessionId=randomUUID(),otpPayload={purpose:'NETWORK_REGISTRATION',destination:'+886912345678',registrationSessionId};
 let otpResponse=await server.inject({method:'POST',url:'/api/v1/auth/otp/challenges',headers:{'idempotency-key':'TEST_ONLY_OTP_CREATE'},payload:otpPayload});
 equal(otpResponse.statusCode,201,'OTP challenge created through provider abstraction');
 const otp=otpResponse.json().data;equal(deliveredOtp,'246810','TEST_ONLY provider receives generated code without API disclosure');
 equal(Object.hasOwn(otp,'code'),false,'OTP response never exposes raw code');
 equal((await server.inject({method:'POST',url:'/api/v1/auth/otp/challenges',headers:{'idempotency-key':'TEST_ONLY_OTP_CREATE'},payload:otpPayload})).json().data.replayed,true,'OTP create lost-response retry is idempotent');
 equal(await db.otpChallenge.count({where:{registrationSessionId}}),1,'OTP retry persists one challenge');
 for(let attempt=1;attempt<=4;attempt++){const invalid=await server.inject({method:'POST',url:`/api/v1/auth/otp/challenges/${otp.challengeId}/verify`,payload:{code:'000000'}});equal(invalid.statusCode,422,'OTP invalid attempt '+attempt+' rejected');}
 otpResponse=await server.inject({method:'POST',url:`/api/v1/auth/otp/challenges/${otp.challengeId}/verify`,payload:{code:'246810'}});equal(otpResponse.statusCode,201,'OTP valid code verifies before fifth failure');
 equal(otpResponse.json().data.status,'VERIFIED','OTP verification status persisted');
 equal((await server.inject({method:'POST',url:`/api/v1/auth/otp/challenges/${otp.challengeId}/verify`,payload:{code:'246810'}})).json().data.replayed,true,'OTP verification redelivery returns original success');
 const lockedPayload={...otpPayload,destination:'+886912345679',registrationSessionId:randomUUID()};
 const lockedChallenge=(await server.inject({method:'POST',url:'/api/v1/auth/otp/challenges',headers:{'idempotency-key':'TEST_ONLY_OTP_LOCK'},payload:lockedPayload})).json().data;
 for(let attempt=1;attempt<=5;attempt++)equal((await server.inject({method:'POST',url:`/api/v1/auth/otp/challenges/${lockedChallenge.challengeId}/verify`,payload:{code:'000000'}})).statusCode,422,'OTP lockout invalid attempt '+attempt);
 equal((await db.otpChallenge.findUniqueOrThrow({where:{otpChallengeId:lockedChallenge.challengeId}})).status,'LOCKED','fifth invalid OTP attempt persists lock');
 equal((await server.inject({method:'POST',url:`/api/v1/auth/otp/challenges/${lockedChallenge.challengeId}/verify`,payload:{code:'246810'}})).statusCode,422,'correct OTP cannot bypass persisted lock');
 process.env.AUTH_CHANNEL_ENABLE_SMS_OTP='false';
 equal((await server.inject({method:'POST',url:'/api/v1/auth/otp/challenges',headers:{'idempotency-key':'TEST_ONLY_DISABLED_OTP'},payload:{...otpPayload,registrationSessionId:randomUUID()}})).statusCode,503,'current LINE release disables OTP challenge creation');
 equal((await server.inject({method:'POST',url:`/api/v1/auth/otp/challenges/${otp.challengeId}/verify`,payload:{code:'246810'}})).statusCode,503,'current LINE release disables OTP verification');
 process.env.AUTH_CHANNEL_ENABLE_SMS_OTP='true';
 equal((await server.inject({method:'POST',url:'/api/v1/member/registration/network',headers:{'idempotency-key':'TEST_ONLY_UNAUTHENTICATED_REGISTRATION'},payload:{}})).statusCode,401,'network registration requires authenticated LINE session');
 equal((await server.inject({method:'POST',url:'/api/v1/registration/network',headers:{'idempotency-key':'TEST_ONLY_RETIRED_ROUTE'},payload:{}})).statusCode,404,'legacy public registration route is retired');
 const call=(method,path,token,body,key='TEST_ONLY_MEMBER_REQUEST')=>server.inject({method,url:'/api/v1/'+path,headers:{...(token?{authorization:'Bearer '+token}:{}),...(method==='PATCH'||method==='POST'&&(['member/orders','member/logout','member/registration/network'].includes(path)||path.endsWith('/consent'))?{'idempotency-key':key}:{})},...(body?{payload:body}:{})});
 // Actual Admin HTTP authorization using isolated opaque sessions. This verifies
 // session/role infrastructure, not formal Entra credentials or production RBAC.
 app.get(ConfigService).set('ADMIN_AUTH_BYPASS','false');
 const adminPath='admin/persons/'+person.personId+'/qualifications';
 // Authorized GETs intentionally append access Audit evidence; monetary facts
 // and outbox remain unchanged. Do not suppress audit to satisfy read assertions.
 const readOnlyModels=['pvLedger','bonusAward','bonusAwardLifecycleEvent','outboxEvent'];
 const readOnlyCounts=await Promise.all(readOnlyModels.map(model=>db[model].count()));
 equal((await call('GET',adminPath)).statusCode,401,'Person Qualification HTTP requires Admin authentication');
 for(const roleCode of ['SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT']){
  const session=await app.get(IdentityTokenService).issue({provider:'ADMIN_LOCAL',subject:'ISOLATED_TEST_ONLY_'+roleCode,roleCode});
  const result=await call('GET',adminPath,session.accessToken);equal(result.statusCode,200,roleCode+' can read Person owned balls');
  equal(result.json().data.map(row=>row.qualificationId).sort(),ids.slice(0,2).sort(),roleCode+' HTTP list exact owned qualifications');
 }
 const adminSession=await app.get(IdentityTokenService).issue({provider:'ADMIN_LOCAL',subject:'ISOLATED_TEST_ONLY_ADMIN_DETAIL',roleCode:'SUPER_ADMIN'});
 const deniedSession=await app.get(IdentityTokenService).issue({provider:'ADMIN_LOCAL',subject:'ISOLATED_TEST_ONLY_FINANCE',roleCode:'FINANCE'});
 equal((await call('GET',adminPath,deniedSession.accessToken)).statusCode,403,'Finance role cannot bypass Person policy through child route');
 equal((await call('GET',adminPath+'?take=1&skip=1',adminSession.accessToken)).json().data.length,1,'Person Qualification HTTP paginates');
 equal((await call('GET','admin/persons/'+empty.personId+'/qualifications',adminSession.accessToken)).json().data,[],'Person without Qualification HTTP empty state');
 equal((await call('GET','admin/persons/'+randomUUID()+'/qualifications',adminSession.accessToken)).statusCode,404,'Missing Person HTTP 404');
 equal((await call('GET','admin/persons/forged/qualifications',adminSession.accessToken)).statusCode,422,'Forged Person UUID HTTP 422');
 equal((await call('GET',adminPath+'?take=101',adminSession.accessToken)).statusCode,422,'Oversized Person Qualification page HTTP 422');
 equal((await call('GET',adminPath+'?skip=-1',adminSession.accessToken)).statusCode,422,'Negative Person Qualification offset HTTP 422');
 for(let i=0;i<readOnlyModels.length;i++)equal(await db[readOnlyModels[i]].count(),readOnlyCounts[i],readOnlyModels[i]+' Admin Person HTTP reads append no facts');
 let res=await call('POST','auth/member/line/exchange',null,{idToken:'VALID_TEST_ONLY'});equal(res.statusCode,201,'synthetic verified LINE exchange');
 const token=res.json().data.accessToken;
 res=await call('GET','member/contracts/required',token);
 equal(res.statusCode,200,'required contracts authenticated');
 equal(res.json().data.map(row=>[row.id,row.contentHash,row.acceptedAt]),[[contract.contractDocumentVersionId,contractHash,null]],'required contract returns exact version/hash and no prior consent');
 const consentPath=`member/contracts/${contract.contractDocumentVersionId}/consent`,consentBody={accepted:true,channel:'MEMBER_WEB'};
 res=await call('POST',consentPath,token,consentBody,'TEST_ONLY_CONSENT');
 equal(res.statusCode,201,'contract consent accepted');
 const consent=res.json().data;
 equal([consent.contractVersionId,consent.contentHash,consent.channel],[contract.contractDocumentVersionId,contractHash,'MEMBER_WEB'],'consent binds displayed version and hash');
 const consentRetry=(await call('POST',consentPath,token,consentBody,'TEST_ONLY_CONSENT')).json().data;
 equal({...consentRetry,replayed:false},consent,'lost-response consent retry returns original evidence');
 equal(consentRetry.replayed,true,'lost-response consent retry is marked replayed');
 equal(await db.consentEvidence.count({where:{personId:person.personId,contractDocumentVersionId:contract.contractDocumentVersionId}}),1,'duplicate consent creates one evidence row');
 equal(await db.outboxEvent.count({where:{aggregateId:person.personId,eventType:'CONTRACT_CONSENTED'}}),1,'duplicate consent creates one outbox event');
 equal((await call('GET','member/contracts/required',token)).json().data[0].acceptedAt,consent.acceptedAt,'required contract read-back exposes accepted timestamp');
 let immutableUpdate;try{await db.consentEvidence.update({where:{consentEvidenceId:consent.consentEvidenceId},data:{channel:'LIFF'}});}catch(error){immutableUpdate=error;}
 equal(Boolean(immutableUpdate),true,'database rejects consent evidence update');
 let immutableDelete;try{await db.consentEvidence.delete({where:{consentEvidenceId:consent.consentEvidenceId}});}catch(error){immutableDelete=error;}
 equal(Boolean(immutableDelete),true,'database rejects consent evidence delete');
 let immutableContract;try{await db.contractDocumentVersion.update({where:{contractDocumentVersionId:contract.contractDocumentVersionId},data:{contentText:'MUTATED'}});}catch(error){immutableContract=error;}
 equal(Boolean(immutableContract),true,'database rejects contract version mutation');
 const qualificationCountBeforeRegistration=await db.qualification.count({where:{currentHolderPersonId:person.personId}});
 const verifiedOtpConsumedBeforeRegistration=await db.otpChallenge.count({where:{status:'VERIFIED',consumedAt:{not:null}}});
 const registrationBody={contractVersionId:contract.contractDocumentVersionId,accepted:true,legalName:person.legalName,alias:person.legalName,gender:'UNSPECIFIED',birthDate:'1990-01-02',mobile:'+886912345680',email:'network.test@example.invalid'};
 let registration=await call('POST','member/registration/network',token,registrationBody,'TEST_ONLY_NETWORK_REGISTER');
 equal(registration.statusCode,201,'authenticated LINE network registration commits');
 const registered=registration.json().data;
 equal([registered.personId,registered.membershipState,registered.enabledAuthenticationProvider,registered.qualificationCreated],[person.personId,'NETWORK_MEMBER','LINE',false],'registration completes existing LINE Person without Qualification');
 equal(await db.qualification.count({where:{currentHolderPersonId:person.personId}}),qualificationCountBeforeRegistration,'network registration creates no Qualification');
 const registeredPerson=await db.person.findUniqueOrThrow({where:{personId:person.personId}});
 equal([registeredPerson.membershipState,registeredPerson.mobileVerifiedAt],['NETWORK_MEMBER',null],'network Person persists contact mobile without SMS verification');
 equal(await db.personMembershipStateEvent.count({where:{personId:person.personId,toState:'NETWORK_MEMBER'}}),1,'network state evidence appended once');
 equal(await db.consentEvidence.count({where:{personId:person.personId,contractDocumentVersionId:contract.contractDocumentVersionId}}),1,'registration reuses immutable consent evidence');
 equal(await db.otpChallenge.count({where:{status:'VERIFIED',consumedAt:{not:null}}}),verifiedOtpConsumedBeforeRegistration,'LINE-first registration consumes no OTP evidence');
 registration=await call('POST','member/registration/network',token,registrationBody,'TEST_ONLY_NETWORK_REGISTER');
 equal([registration.statusCode,registration.json().data.personId,registration.json().data.replayed],[201,person.personId,true],'network registration lost-response retry returns same LINE Person');
 let delivery=await call('GET','member/delivery-profile',token);equal([delivery.statusCode,delivery.json().data.complete],[200,false],'missing delivery profile is explicit incomplete state');
 const deliveryBody={recipientName:'MEMBER A TEST ONLY',phone:'+886223456789',countryCode:'TW',postalCode:'100',region:'Taipei',city:'Zhongzheng',address:'TEST ONLY ROAD 1'};
 delivery=await call('PATCH','member/delivery-profile',token,deliveryBody,'TEST_ONLY_DELIVERY_PROFILE');equal(delivery.statusCode,200,'delivery profile version created');
 const deliveryResult=delivery.json().data;equal([deliveryResult.status,deliveryResult.complete,deliveryResult.replayed],['UPDATED',true,false],'delivery profile mutation returns non-PII result');
 let deliveryRows=await db.deliveryProfile.findMany({where:{personId:person.personId},orderBy:{effectiveFrom:'asc'}});equal(deliveryRows.length,1,'one delivery profile version persisted');
 equal([deliveryRows[0].contactCiphertext.includes(deliveryBody.phone),deliveryRows[0].addressCiphertext.includes(deliveryBody.address),deliveryRows[0].keyVersion],[false,false,'TEST_ONLY_V1'],'delivery phone/address stored encrypted with key version');
 delivery=await call('GET','member/delivery-profile',token);equal([delivery.json().data.phone,delivery.json().data.address,delivery.json().data.complete],[deliveryBody.phone,deliveryBody.address,true],'authenticated owner reads decrypted current delivery profile');
 const deliveryAudit=await db.auditEvent.findFirstOrThrow({where:{entityType:'DeliveryProfile',entityId:deliveryResult.deliveryProfileId}});equal(JSON.stringify(deliveryAudit).includes(deliveryBody.address)||JSON.stringify(deliveryAudit).includes(deliveryBody.phone),false,'delivery audit contains no raw address or phone');
 delivery=await call('PATCH','member/delivery-profile',token,deliveryBody,'TEST_ONLY_DELIVERY_PROFILE');equal([delivery.json().data.deliveryProfileId,delivery.json().data.replayed],[deliveryResult.deliveryProfileId,true],'delivery profile lost-response retry is idempotent');
 const changedDelivery={...deliveryBody,address:'TEST ONLY ROAD 2'};delivery=await call('PATCH','member/delivery-profile',token,changedDelivery,'TEST_ONLY_DELIVERY_PROFILE_2');equal(delivery.statusCode,200,'delivery profile replacement creates new version');
 deliveryRows=await db.deliveryProfile.findMany({where:{personId:person.personId},orderBy:{effectiveFrom:'asc'}});equal([deliveryRows.length,deliveryRows.filter(row=>row.effectiveTo===null).length,deliveryRows[0].effectiveTo!==null],[2,1,true],'delivery profile history closes prior version and keeps one current');
 let deliveryHistoryMutation;try{await db.deliveryProfile.update({where:{deliveryProfileId:deliveryRows[0].deliveryProfileId},data:{recipientName:'MUTATED'}});}catch(error){deliveryHistoryMutation=error;}equal(Boolean(deliveryHistoryMutation),true,'database rejects delivery history rewrite');
 let deliveryHistoryDelete;try{await db.deliveryProfile.delete({where:{deliveryProfileId:deliveryRows[0].deliveryProfileId}});}catch(error){deliveryHistoryDelete=error;}equal(Boolean(deliveryHistoryDelete),true,'database rejects delivery history delete');
 const deliveryIdempotency=await db.idempotencyRecord.findUniqueOrThrow({where:{actorScope_idempotencyKey:{actorScope:`member:delivery-profile:${person.personId}`,idempotencyKey:'TEST_ONLY_DELIVERY_PROFILE'}}});equal(JSON.stringify(deliveryIdempotency.responseBody).includes(deliveryBody.address)||JSON.stringify(deliveryIdempotency.responseBody).includes(deliveryBody.phone),false,'delivery idempotency response contains no raw address or phone');
 const piiKey=process.env.PII_ENCRYPTION_KEY;delete process.env.PII_ENCRYPTION_KEY;equal((await call('GET','member/delivery-profile',token)).statusCode,503,'delivery profile read fails closed without PII key');process.env.PII_ENCRYPTION_KEY=piiKey;
 const otherDeliverySubject='TEST_ONLY_OTHER_DELIVERY_'+randomUUID();await db.identityLink.create({data:{provider:'LINE',providerSubject:otherDeliverySubject,personId:other.personId}});const otherDeliverySession=await new IdentityTokenService(db).issue({provider:'LINE',subject:otherDeliverySubject,personId:other.personId});
 equal((await call('GET','member/delivery-profile?personId='+person.personId,otherDeliverySession.accessToken)).json().data.complete,false,'delivery profile ignores foreign Person query and returns authenticated owner state');
 equal((await call('POST','auth/member/line/exchange',null,{idToken:'VALID_TEST_ONLY'})).statusCode,409,'ID token replay denied');
 equal((await call('POST','auth/member/line/exchange',null,{idToken:'INVALID_TEST_ONLY'})).statusCode,401,'invalid LINE token denied');
 equal((await call('POST','auth/member/line/exchange',null,{idToken:'UNBOUND_TEST_ONLY'})).statusCode,401,'unbound LINE denied');
 const sessionCountBefore=await db.authSession.count({where:{provider:'LINE',personId:person.personId}});
 const lineKeyCountBefore=await db.idempotencyRecord.count({where:{actorScope:'member:line:exchange'}});
 const concurrentExchanges=await Promise.all([call('POST','auth/member/line/exchange',null,{idToken:'CONCURRENT_LINE_TEST_ONLY'}),call('POST','auth/member/line/exchange',null,{idToken:'CONCURRENT_LINE_TEST_ONLY'})]);
 equal(concurrentExchanges.map(r=>r.statusCode).sort(),[201,409],'concurrent LINE exchange single use');
 equal(await db.authSession.count({where:{provider:'LINE',personId:person.personId}}),sessionCountBefore+1,'one concurrent LINE session');
 equal(await db.idempotencyRecord.count({where:{actorScope:'member:line:exchange'}}),lineKeyCountBefore+1,'one concurrent LINE consumption record');
 const memberService=app.get(MemberService),originalMemberDb=memberService.db;
 memberService.db=originalMemberDb.$extends({query:{authSession:{async create(){throw new Error('TEST_ONLY_SESSION_ISSUE_FAILURE');}}}});
 try{equal((await call('POST','auth/member/line/exchange',null,{idToken:'ROLLBACK_LINE_TEST_ONLY'})).statusCode,500,'LINE session issuance injected failure');}finally{memberService.db=originalMemberDb;}
 equal(await db.idempotencyRecord.count({where:{actorScope:'member:line:exchange'}}),lineKeyCountBefore+1,'failed session issue rolls back token consumption');
 equal((await call('POST','auth/member/line/exchange',null,{idToken:'ROLLBACK_LINE_TEST_ONLY'})).statusCode,201,'LINE exchange retry after rolled back issuance');
 equal((await call('GET','member/me')).statusCode,401,'missing session denied');
 res=await call('GET','member/me?personId='+other.personId,token);equal(res.statusCode,200,'member me authenticated');equal(res.json().data.name,person.legalName,'client Person tampering ignored');
 res=await call('GET','member/qualifications',token);equal(res.statusCode,200,'owned qualifications fetched');equal(res.json().data.map(q=>q.id),ids.slice(0,2),'only both owned balls returned');
 for(const id of ids.slice(0,2)){res=await call('POST','member/context/qualification',token,{qualificationId:id});equal(res.statusCode,201,'owned ball context allowed');equal(res.json().data.qualificationId,id,'ball context echoes verified id');}
 res=await call('POST','member/share-links',token,{qualificationId:ids[0]});equal(res.statusCode,201,'owned ball referral share link created');const share=res.json().data,shareUrl=new URL(share.shareUrl);equal([share.qualificationId,shareUrl.origin,shareUrl.pathname.startsWith('/r/')],[ids[0],'https://example.invalid',true],'share link binds owned ball and configured landing origin');equal(app.get(MemberShareLinkService).verify(shareUrl.pathname.slice(3)).qualificationId,ids[0],'encrypted share token verifies to exact owned ball');equal((await call('POST','member/share-links',token,{qualificationId:ids[2]})).statusCode,403,'foreign ball referral share link denied');
 const paths={dashboard:'dashboard',organization:'organization/sponsor',binary:'organization/binary',performance:'performance',bonuses:'bonuses',ledger:'bonuses/ledger',repurchase:'repurchase/status',referrals:'referrals',orders:'orders'};
 const balls=[];
 for(const [index,id] of ids.slice(0,2).entries()){
  const responses={qualifications:(await call('GET','member/qualifications',token)).json(),person:(await call('GET','member/me',token)).json(),products:(await call('GET','member/products',token)).json()};
  for(const [key,path] of Object.entries(paths)){
   const answer=await call('GET','member/'+path+'?qualificationId='+id+'&period=2026-09',token);equal(answer.statusCode,200,'Connected read '+key+' Ball '+(index+1));responses[key]=answer.json();
   equal(answer.json().data.qualificationId,id,'no cross-ball '+key);
   equal((await call('GET','member/'+path+'?qualificationId='+ids[2]+'&period=2026-09',token)).statusCode,403,'direct API foreign-ball '+key+' denied');
  }
  equal([responses.performance.data.pv,responses.performance.data.rpv,responses.performance.data.epv],index===0?[11,2400,1680]:[23,1200,480],'independent original ledger volumes');
  equal([responses.dashboard.data.bonusStatus,responses.dashboard.data.bonusAmount],['PENDING',null],'unfinalized dashboard money remains pending null');
  equal((await call('GET','member/orders/'+orderIds[1-index]+'?qualificationId='+id,token)).statusCode,404,'order URL tampering denied');
  balls.push(responses);
  if(process.env.MEMBER_CONTRACT_OUTPUT_DIR)writeFileSync(process.env.MEMBER_CONTRACT_OUTPUT_DIR+'/ball-'+(index+1)+'.json',JSON.stringify({qualificationId:id,period:'2026-09',responses},null,2)+'\n');
 }
 equal(balls.map(ball=>ball.organization.data.referrals.length),[2,0],'Sponsor trees independent by ball');
 equal(balls.map(ball=>ball.binary.data.left.count),[1,2],'Binary trees independent and distinct from Sponsor');
 equal(balls.map(ball=>ball.bonuses.data.awards.map(award=>[award.name,award.status,award.amount])),[[['EPV','PENDING45D',840]],[['EPV','PENDING45D',240]]],'nonempty Bonus entitlement isolated by ball');
 equal(balls.map(ball=>ball.ledger.data.entries.map(entry=>entry.amount)),[[840],[240]],'nonempty Ledger facts isolated by ball');
 // Synthetic display record, not a grant-policy test. Insert only new facts:
 // reverse UUID order must not reverse the confirmed initial transition.
 const tieAt=new Date('2026-12-01T00:00:00Z');
 const tieAward=await db.bonusAward.create({data:{recipientQualificationId:ids[0],awardType:'EPV',sourceEventId:randomUUID(),theoryAmount:17,payableAmount:17,activeSnapshot:true,ruleVersionCode:'R1.0B',parameterSnapshotHash:(await captureParameters(db,new Date(),'R1.0B')).hash,occurredAt:tieAt,pendingUntil:new Date('2026-12-31'),calculationDetail:{kind:'TEST_ONLY_DISPLAY_RECORD_NOT_GRANT_POLICY'}}});
 await db.bonusAwardLifecycleEvent.createMany({data:[
  {lifecycleEventId:'ffffffff-ffff-4fff-bfff-fffffffffff1',bonusAwardId:tieAward.bonusAwardId,status:'CALCULATED',occurredAt:tieAt,createdAt:tieAt},
  {lifecycleEventId:'00000000-0000-4000-8000-000000000001',bonusAwardId:tieAward.bonusAwardId,status:'PENDING_45D',occurredAt:tieAt,createdAt:tieAt}
 ]});
 equal((await call('GET','member/bonuses?qualificationId='+ids[0]+'&period=2026-12',token)).json().data.awards.map(a=>[a.status,a.amount]),[['PENDING45D',17]],'equal timestamp initial lifecycle ignores reverse UUID order');
 equal(balls.map(ball=>ball.dashboard.data.monthlyRepurchaseStatus),['ACTIVE','ACTIVE'],'dashboard uses original month recognized Core schedules');
 const again=await call('GET','member/performance?qualificationId='+ids[0]+'&period=2026-09',token);
 equal([again.json().data.pv,again.json().data.rpv,again.json().data.epv],[11,2400,1680],'switch back restores deterministic Ball 1 volumes');
 equal((await call('GET','member/dashboard',token)).statusCode,422,'missing scoped GET context fails closed');
 equal((await call('POST','member/context/qualification',token,{qualificationId:ids[2]})).statusCode,403,'foreign ball BOLA denied');
 equal((await call('POST','member/context/qualification',token,{qualificationId:randomUUID()})).statusCode,403,'forged ball denied');
 equal((await call('POST','member/context/qualification',token,{})).statusCode,422,'missing ball fails validation');
 const expired=await new IdentityTokenService(db).issue({provider:'LINE',subject,personId:person.personId,ttlSeconds:-1});
 equal((await call('GET','member/me',expired.accessToken)).statusCode,401,'expired session denied');
 const admin=await new IdentityTokenService(db).issue({provider:'ADMIN_LOCAL',subject,personId:person.personId,roleCode:'ADMIN'});
 equal((await call('GET','member/me',admin.accessToken)).statusCode,401,'Admin credential rejected on Member route');
 const emptySubject='TEST_ONLY_EMPTY_'+randomUUID();await db.identityLink.create({data:{provider:'LINE',providerSubject:emptySubject,personId:empty.personId}});
 const emptySession=await new IdentityTokenService(db).issue({provider:'LINE',subject:emptySubject,personId:empty.personId});
 equal((await call('GET','member/qualifications',emptySession.accessToken)).json().data,[],'Person without Qualification returns empty list');
 await db.memberNotification.createMany({data:[
  {personId:person.personId,category:'SERVICE',title:'TEST_ONLY PERSON NOTICE',body:'PERSON'},
  {personId:person.personId,qualificationId:ids[0],category:'ORDER',title:'TEST_ONLY BALL1',body:'BALL1'},
  {personId:person.personId,qualificationId:ids[1],category:'ACCOUNT',title:'TEST_ONLY BALL2',body:'BALL2'},
  {personId:other.personId,qualificationId:ids[2],category:'SERVICE',title:'TEST_ONLY FOREIGN',body:'FOREIGN'}
 ]});
 const notices1=(await call('GET','member/notifications?qualificationId='+ids[0],token)).json().data;
 const notices2=(await call('GET','member/notifications?qualificationId='+ids[1],token)).json().data;
 equal(notices1.notices.map(n=>n.body).sort(),['BALL1','PERSON'],'notice audience Ball1');
 equal(notices2.notices.map(n=>n.body).sort(),['BALL2','PERSON'],'notice audience Ball2');
 equal((await call('GET','member/notifications?qualificationId='+ids[2],token)).statusCode,403,'foreign notice scope denied');
 equal((await call('GET','member/notifications',token)).statusCode,422,'notice context required');
 const monetaryBeforeProfile=[await db.pvLedger.count(),await db.bonusAward.count(),await db.bonusRecoveryEvent.count()];
 const profile=await call('PATCH','member/profile',token,{name:'MEMBER DISPLAY TEST',email:'member-test@example.invalid',phone:'0912345678'});
 equal(profile.statusCode,200,'own profile update');
 equal(profile.json().data.name,'MEMBER DISPLAY TEST','profile returns persisted display name');
 equal((await db.person.findUnique({where:{personId:person.personId}})).legalName,'MEMBER A TEST ONLY','legal name not changed');
 equal((await call('PATCH','member/profile',token,{personId:other.personId,name:'FORGED'})).statusCode,400,'profile person tampering denied');
 equal((await call('PATCH','member/profile',token,{status:'SUSPENDED'})).statusCode,400,'profile status tampering denied');
 equal((await call('PATCH','member/profile',token,{})).statusCode,422,'empty profile rejected');
 equal((await call('PATCH','member/profile',token,{name:null})).statusCode,400,'null profile field rejected');
 equal((await call('PATCH','member/profile',token,{email:'invalid'})).statusCode,400,'invalid contact rejected');
 equal([await db.pvLedger.count(),await db.bonusAward.count(),await db.bonusRecoveryEvent.count()],monetaryBeforeProfile,'profile does not mutate monetary facts');
 equal(await db.auditEvent.count({where:{actorId:person.personId,action:'MEMBER_PROFILE_UPDATED'}}),1,'successful profile update audited once; rejected writes leave no audit');
 await db.pvLedger.create({data:{qualificationId:ids[0],pvType:'RPV',amount:7,sourceType:'TEST_ONLY',sourceId:randomUUID(),sourceLineId:randomUUID(),eventType:'TEST_ONLY_MISSING_EVIDENCE',ruleVersionCode:'R1.0B',occurredAt:new Date('2026-10-01T00:00:00Z'),correlationId:randomUUID()}});
 const missingEvidence=await call('GET','member/performance?qualificationId='+ids[0]+'&period=2026-10',token);
 equal(missingEvidence.statusCode,422,'historical volume missing evidence fails closed');
 equal(missingEvidence.json().code,'HISTORICAL_SNAPSHOT_MISSING','missing evidence domain code remains explicit');
 const orderCount=await db.order.count();
 const checkoutBody={qualificationId:ids[0],items:[{productId:product.productId,quantity:'1'}]};
 const checkout=await call('POST','member/orders',token,checkoutBody);
 equal(checkout.statusCode,422,'owned checkout fails closed missing product profile');
 equal(checkout.json().code,'RULE_PROFILE_CONFIGURATION_PENDING','missing profile configuration explicit');
 equal((await call('POST','member/orders',token,{...checkoutBody,qualificationId:ids[2]})).statusCode,403,'direct foreign checkout denied');
 equal((await call('POST','member/orders',token,{...checkoutBody,amount:0})).statusCode,400,'client monetary input rejected');
 equal((await call('POST','member/orders',null,checkoutBody)).statusCode,401,'checkout requires Member session');
 equal((await call('POST','member/orders',token,checkoutBody)).statusCode,422,'duplicate unconfigured checkout remains closed');
 equal(await db.order.count(),orderCount,'unconfigured checkout creates no official order');
 const {ProductService}=require('./apps/api/dist/modules/product/product.service.js');
 const productService=new ProductService(db);
 const checkoutProduct=await productService.upsertReference({sku:'CHECKOUT_TEST_ONLY_'+randomUUID(),displayName:'TEST ONLY CHECKOUT',price:'399',gpvRate:'0.6',ruleVersionCode:'R1.0B'});
 const originalProductProfile=await db.productRuleProfile.findFirst({where:{productId:checkoutProduct.productId}});
 equal(/^[a-f0-9]{64}$/.test(originalProductProfile.parameterSnapshotHash),true,'Admin-created product has traceable profile for connected Member checkout');
 let rateChangeError;try{await productService.upsertReference({sku:checkoutProduct.sku,displayName:'SHOULD ROLLBACK',price:'999',gpvRate:'0.9'});}catch(error){rateChangeError=error;}
 equal(rateChangeError?.getResponse().code,'VERSIONED_PRODUCT_PROFILE_REQUIRED','unapproved existing rate change fails closed');
 equal((await db.productReference.findUnique({where:{productId:checkoutProduct.productId}})).currentPrice.toString(),'399','rejected product configuration rolls back price/name');
 equal(JSON.stringify(await db.productRuleProfile.findFirst({where:{productId:checkoutProduct.productId}})),JSON.stringify(originalProductProfile),'original product profile is immutable');
 const orderBody={qualificationId:ids[0],items:[{productId:checkoutProduct.productId,quantity:'2'}]};
 const catalog=(await call('GET','member/products',token)).json().data;
 equal(catalog.find(p=>p.id===checkoutProduct.productId).price,399,'Golden Journey reads authoritative product price');
 equal(catalog.find(p=>p.id===checkoutProduct.productId).available,true,'configured product orderable; not stock confirmation');
 const monetaryBeforeCheckout=JSON.stringify([await db.pvLedger.findMany({orderBy:{eventId:'asc'}}),await db.bonusAward.findMany({orderBy:{bonusAwardId:'asc'}})]);
 let created=await call('POST','member/orders',token,orderBody,'GOLDEN_CHECKOUT_REQUEST');
 equal(created.statusCode,201,'Golden Journey creates Core order');
 const createdOrder=created.json().data;
 equal([createdOrder.total,createdOrder.lines[0].unitPrice,createdOrder.lines[0].quantity],['798','399','2'],'Core authoritative price and quantity');
 equal(createdOrder.lines[0].pv,null,'checkout does not infer PV mapping');
 const stored=await db.order.findUnique({where:{orderId:createdOrder.id},include:{lines:true}});
 equal([stored.status,stored.paidAt,stored.lines[0].gpvAmountSnapshot.toString()],['CONFIRMED',null,'478.8'],'Core snapshot sealed; no payment');
 equal((await call('POST','member/orders',token,orderBody,'GOLDEN_CHECKOUT_REQUEST')).json().data.id,createdOrder.id,'retry returns identical order');
 equal((await call('POST','member/orders',token,{...orderBody,items:[{productId:checkoutProduct.productId,quantity:'1'}]},'GOLDEN_CHECKOUT_REQUEST')).statusCode,409,'order conflicting payload key denied');
 equal((await call('GET',`member/orders/${createdOrder.id}?qualificationId=${ids[0]}`,token)).json().data.total,'798','Golden Journey owned order detail');
 equal((await call('GET',`member/orders/${createdOrder.id}?qualificationId=${ids[1]}`,token)).statusCode,404,'other owned ball cannot access order detail');
 equal((await call('POST','member/orders',token,{...orderBody,items:[{productId:checkoutProduct.productId,quantity:'0'}]},'ZERO_QUANTITY_REQUEST')).statusCode,422,'zero quantity rejected');
 equal((await call('POST','member/orders',token,{...orderBody,purpose:'UPGRADE'},'FORGED_PURPOSE_REQUEST')).statusCode,400,'Member cannot select qualification workflow purpose');
 equal((await call('POST','member/orders',token,{...orderBody,items:[{productId:checkoutProduct.productId,quantity:'2',unitPrice:0}]},'FORGED_PRICE_REQUEST')).statusCode,400,'client product price rejected');
 equal((await call('POST','member/orders',token,{...orderBody,pv:999999},'FORGED_PV_REQUEST')).statusCode,400,'client PV rejected');
 const createdEvent=await db.outboxEvent.findFirst({where:{aggregateId:createdOrder.id,eventType:'MEMBER_ORDER_CREATED'}});
 equal(Boolean(createdEvent),true,'order notification transactional outbox');
 const lease=await claimOutboxLease(db,createdEvent);
 await processMemberOrderNotification(db,lease);
 equal((await db.outboxEvent.findUnique({where:{outboxEventId:createdEvent.outboxEventId}})).processStatus,'PROCESSED','production notification consumer acknowledges');
 await processMemberOrderNotification(db,lease);
 equal(await db.memberNotification.count({where:{sourceEventId:createdEvent.outboxEventId}}),1,'duplicate outbox delivery does not duplicate notice');
 const orderNotice=await db.memberNotification.findUnique({where:{sourceEventId:createdEvent.outboxEventId}});
 equal((await call('GET','member/notifications?qualificationId='+ids[0],token)).json().data.notices.some(n=>n.id===orderNotice.notificationId),true,'Golden Journey sees order notice');
 const readPath=`member/notifications/${orderNotice.notificationId}/read`,readBody={qualificationId:ids[0]};
 const read=await call('PATCH',readPath,token,readBody,'GOLDEN_READ_REQUEST');
 equal(read.statusCode,200,'Golden Journey marks notice read');
 equal((await call('PATCH',readPath,token,readBody,'GOLDEN_READ_REQUEST')).json().data.readAt,read.json().data.readAt,'duplicate read preserves original timestamp');
 equal((await call('PATCH',readPath,token,readBody,'GOLDEN_READ_DIFFERENT_KEY')).json().data.readAt,read.json().data.readAt,'different key does not overwrite read timestamp');
 equal((await call('PATCH',readPath,token,{qualificationId:ids[1]},'WRONG_BALL_READ_REQUEST')).statusCode,404,'notice audience forbids other owned ball');
 equal((await call('GET','member/notifications?qualificationId='+ids[0],token)).json().data.notices.find(n=>n.id===orderNotice.notificationId).readAt,read.json().data.readAt,'read state persists on reload');
 // Test-only injected failure executes real DB writes and must roll back with idempotency.
 const audit=app.get(AuditService),originalWrite=audit.write.bind(audit);let failAction;
 audit.write=async(tx,input)=>{if(input.action===failAction){failAction=undefined;throw new Error('TEST_ONLY_PARTIAL_FAILURE');}return originalWrite(tx,input);};
 failAction='ORDER_CREATED_CONFIRMED';
 const rollbackBefore=[await db.order.count(),await db.outboxEvent.count()];
 equal((await call('POST','member/orders',token,orderBody,'ROLLBACK_ORDER_REQUEST')).statusCode,500,'order injected failure');
 equal([await db.order.count(),await db.outboxEvent.count()],rollbackBefore,'order and outbox rollback');
 equal(await db.idempotencyRecord.count({where:{actorScope:`member:order:create:${person.personId}`,idempotencyKey:'ROLLBACK_ORDER_REQUEST'}}),0,'failed order idempotency rollback');
 equal((await call('POST','member/orders',token,orderBody,'ROLLBACK_ORDER_REQUEST')).statusCode,201,'order partial failure retry succeeds');
 const oldDisplay=(await db.person.findUnique({where:{personId:person.personId}})).preferredName;
 failAction='MEMBER_PROFILE_UPDATED';
 equal((await call('PATCH','member/profile',token,{name:'RETRY DISPLAY'},'ROLLBACK_PROFILE_REQUEST')).statusCode,500,'profile injected failure');
 equal((await db.person.findUnique({where:{personId:person.personId}})).preferredName,oldDisplay,'profile rollback preserves original fields');
 equal(await db.idempotencyRecord.count({where:{actorScope:`member:profile:${person.personId}`,idempotencyKey:'ROLLBACK_PROFILE_REQUEST'}}),0,'profile failure key rollback');
 equal((await call('PATCH','member/profile',token,{name:'RETRY DISPLAY'},'ROLLBACK_PROFILE_REQUEST')).statusCode,200,'profile retry succeeds');
 equal((await call('PATCH','member/profile',token,{name:'RETRY DISPLAY'},'ROLLBACK_PROFILE_REQUEST')).statusCode,200,'profile duplicate succeeds');
 equal(await db.auditEvent.count({where:{actorId:person.personId,action:'MEMBER_PROFILE_UPDATED'}}),2,'profile retry does not duplicate audit');
 equal((await call('PATCH','member/profile',token,{name:'DIFFERENT'},'ROLLBACK_PROFILE_REQUEST')).statusCode,409,'profile conflicting key denied');
 const unreadNotice=notices1.notices.find(n=>n.body==='BALL1');
 failAction='MEMBER_NOTIFICATION_READ';
 const failedReadPath=`member/notifications/${unreadNotice.id}/read`;
 equal((await call('PATCH',failedReadPath,token,readBody,'ROLLBACK_READ_REQUEST')).statusCode,500,'read injected failure');
 equal(await db.memberNotificationRead.count({where:{notificationId:unreadNotice.id}}),0,'read rollback');
 equal((await call('PATCH',failedReadPath,token,readBody,'ROLLBACK_READ_REQUEST')).statusCode,200,'read retry succeeds');
 const concurrentOrders=await Promise.all([call('POST','member/orders',token,orderBody,'CONCURRENT_ORDER_REQUEST'),call('POST','member/orders',token,orderBody,'CONCURRENT_ORDER_REQUEST')]);
 equal(concurrentOrders.every(r=>[201,409].includes(r.statusCode)),true,'concurrent order commit/retryable conflict');
 equal(await db.idempotencyRecord.count({where:{actorScope:`member:order:create:${person.personId}`,idempotencyKey:'CONCURRENT_ORDER_REQUEST'}}),1,'concurrent order has one committed result');
 const concurrentOrder=(await call('POST','member/orders',token,orderBody,'CONCURRENT_ORDER_REQUEST')).json().data;
 equal(await db.outboxEvent.count({where:{aggregateId:concurrentOrder.id,eventType:'MEMBER_ORDER_CREATED'}}),1,'concurrent order has one notification event');
 const consumerEvent=await db.outboxEvent.findFirst({where:{aggregateId:concurrentOrder.id,eventType:'MEMBER_ORDER_CREATED'}});
 const consumerLease=await claimOutboxLease(db,consumerEvent);
 const faultyConsumer=db.$extends({query:{outboxEvent:{async update({args,query}){if(args.where.outboxEventId===consumerEvent.outboxEventId&&args.data.processStatus==='PROCESSED')throw new Error('TEST_ONLY_ACK_FAILURE');return query(args);}}}});
 let consumerError;try{await processMemberOrderNotification(faultyConsumer,consumerLease);}catch(error){consumerError=error;}
 equal(consumerError?.message,'TEST_ONLY_ACK_FAILURE','production consumer injected acknowledgement failure');
 equal(await db.memberNotification.count({where:{sourceEventId:consumerEvent.outboxEventId}}),0,'consumer notice rollback on acknowledgement failure');
 equal((await db.outboxEvent.findUnique({where:{outboxEventId:consumerEvent.outboxEventId}})).processStatus,'PROCESSING','failed consumer does not acknowledge');
 await releaseFailedOutboxLease(db,consumerLease,consumerError);
 const retryEvent=await db.outboxEvent.findUnique({where:{outboxEventId:consumerEvent.outboxEventId}});
 equal(retryEvent.processStatus,'PENDING','consumer failure schedules redelivery');
 const retryLease=await claimOutboxLease(db,retryEvent,new Date(retryEvent.availableAt.getTime()+1));
 await processMemberOrderNotification(db,retryLease);
 equal(await db.memberNotification.count({where:{sourceEventId:consumerEvent.outboxEventId}}),1,'consumer retry creates one notice');
 equal((await db.outboxEvent.findUnique({where:{outboxEventId:consumerEvent.outboxEventId}})).processStatus,'PROCESSED','consumer retry acknowledges atomically');
 const concurrentProfiles=await Promise.all([call('PATCH','member/profile',token,{name:'CONCURRENT DISPLAY'},'CONCURRENT_PROFILE_REQUEST'),call('PATCH','member/profile',token,{name:'CONCURRENT DISPLAY'},'CONCURRENT_PROFILE_REQUEST')]);
 equal(concurrentProfiles.every(r=>[200,409].includes(r.statusCode)),true,'concurrent profile commit/retryable conflict');
 equal((await call('PATCH','member/profile',token,{name:'CONCURRENT DISPLAY'},'CONCURRENT_PROFILE_REQUEST')).statusCode,200,'concurrent profile external retry');
 const personNotice=notices1.notices.find(n=>n.qualificationId===null);
 const concurrentReads=await Promise.all([call('PATCH',`member/notifications/${personNotice.id}/read`,token,readBody,'CONCURRENT_READ_ONE'),call('PATCH',`member/notifications/${personNotice.id}/read`,token,readBody,'CONCURRENT_READ_TWO')]);
 equal(concurrentReads.every(r=>[200,409].includes(r.statusCode)),true,'concurrent read commit/retryable conflict');
 for(const key of ['CONCURRENT_READ_ONE','CONCURRENT_READ_TWO'])equal((await call('PATCH',`member/notifications/${personNotice.id}/read`,token,readBody,key)).statusCode,200,'concurrent read retry');
 equal(await db.memberNotificationRead.count({where:{notificationId:personNotice.id,personId:person.personId}}),1,'one Person read evidence despite different concurrent keys');
 equal((await call('GET','member/notifications?qualificationId='+ids[1],token)).json().data.notices.find(n=>n.id===personNotice.id).readAt!==null,true,'Person notice read state shared across owned balls');
 const profileAcrossBalls=await Promise.all(ids.slice(0,2).map(id=>call('GET','member/dashboard?qualificationId='+id+'&period=2026-09',token)));
 equal(profileAcrossBalls.map(r=>r.json().data.memberName),['CONCURRENT DISPLAY','CONCURRENT DISPLAY'],'Person profile fields shared; ball volumes remain independent');
 for(const [method,path,body] of [['POST','member/orders',orderBody],['PATCH','member/profile',{name:'NO KEY'}],['PATCH',readPath,readBody]]){
  const noKey=await server.inject({method,url:'/api/v1/'+path,headers:{authorization:'Bearer '+token},payload:body});
  equal(noKey.statusCode,400,'Member mutation requires explicit idempotency key: '+path);
 }
 await db.productReference.update({where:{productId:checkoutProduct.productId},data:{currentPrice:499}});
 equal((await call('POST','member/orders',token,orderBody,'CURRENT_PRICE_REQUEST')).json().data.total,'998','Core uses authoritative current price on new order');
 equal((await call('POST','member/orders',token,orderBody,'GOLDEN_CHECKOUT_REQUEST')).json().data.total,'798','idempotent retry preserves original confirmed price');
 await db.productReference.update({where:{productId:checkoutProduct.productId},data:{isActive:false}});
 equal((await call('POST','member/orders',token,orderBody,'INACTIVE_PRODUCT_REQUEST')).statusCode,409,'inactive product rejected');
 equal(await db.idempotencyRecord.count({where:{actorScope:`member:order:create:${person.personId}`,idempotencyKey:'INACTIVE_PRODUCT_REQUEST'}}),0,'product validation failure rolls back key');
 equal(JSON.stringify([await db.pvLedger.findMany({orderBy:{eventId:'asc'}}),await db.bonusAward.findMany({orderBy:{bonusAwardId:'asc'}})]),monetaryBeforeCheckout,'checkout/read/profile preserve all original monetary facts');
 const finalBall1=(await call('GET','member/performance?qualificationId='+ids[0]+'&period=2026-09',token)).json().data;
 equal([finalBall1.pv,finalBall1.rpv,finalBall1.epv],[11,2400,1680],'Golden Journey back to Ball1 remains deterministic');
 await runMemberAdminIntegration({server,db,memberToken:token,adminToken:adminSession.accessToken,financeToken:deniedSession.accessToken,personId:person.personId,qualificationIds:ids,equal});
 const before=[await db.pvLedger.count(),await db.bonusAward.count(),await db.bonusRecoveryEvent.count()];
 for(let i=0;i<3;i++)await call('GET','member/qualifications',token);
 equal([await db.pvLedger.count(),await db.bonusAward.count(),await db.bonusRecoveryEvent.count()],before,'repeated GET has no monetary side effect');
 const logoutSession=(await call('POST','auth/member/line/exchange',null,{idToken:'LOGOUT_TEST_ONLY'})).json().data;
 equal((await call('POST','member/logout',logoutSession.accessToken,{intent:'LOGOUT'},'')).statusCode,400,'logout missing key rejected');
 equal((await call('POST','member/logout',logoutSession.accessToken,{sessionId:randomUUID()},'LOGOUT_INVALID')).statusCode,400,'logout cannot select another session');
 failAction='MEMBER_SESSION_REVOKED';
 equal((await call('POST','member/logout',logoutSession.accessToken,{intent:'LOGOUT'},'ROLLBACK_LOGOUT')).statusCode,500,'logout audit failure injected');
 equal((await db.authSession.findUnique({where:{authSessionId:logoutSession.sessionId}})).status,'ACTIVE','logout session mutation rolls back');
 equal(await db.idempotencyRecord.count({where:{actorScope:`member:logout:${logoutSession.sessionId}`,idempotencyKey:'ROLLBACK_LOGOUT'}}),0,'logout failed key rolls back');
 equal((await call('POST','member/logout',logoutSession.accessToken,{intent:'LOGOUT'},'ROLLBACK_LOGOUT')).statusCode,201,'logout retry confirms revocation');
 equal((await db.authSession.findUnique({where:{authSessionId:logoutSession.sessionId}})).status,'REVOKED','authenticated session revoked');
 equal(await db.auditEvent.count({where:{action:'MEMBER_SESSION_REVOKED',entityId:logoutSession.sessionId}}),1,'single logout audit');
 equal((await call('GET','member/me',logoutSession.accessToken)).statusCode,401,'revoked bearer denied');
 equal((await call('POST','member/logout',logoutSession.accessToken,{intent:'LOGOUT'},'ROLLBACK_LOGOUT')).statusCode,401,'redelivery revoked bearer denied');
 equal((await call('GET','member/me',token)).statusCode,200,'logout preserves other Person session');
 const concurrentLogout=(await call('POST','auth/member/line/exchange',null,{idToken:'CONCURRENT_LOGOUT_TEST_ONLY'})).json().data;
 const logoutReplies=await Promise.all([call('POST','member/logout',concurrentLogout.accessToken,{intent:'LOGOUT'},'CONCURRENT_LOGOUT'),call('POST','member/logout',concurrentLogout.accessToken,{intent:'LOGOUT'},'CONCURRENT_LOGOUT')]);
 equal(logoutReplies.some(r=>r.statusCode===201)&&logoutReplies.every(r=>[201,401,409].includes(r.statusCode)),true,'concurrent logout commit/conflict or revoked denial');
 equal(await db.auditEvent.count({where:{action:'MEMBER_SESSION_REVOKED',entityId:concurrentLogout.sessionId}}),1,'concurrent logout one audit');
 equal([await db.pvLedger.count(),await db.bonusAward.count(),await db.bonusRecoveryEvent.count()],before,'logout has no monetary mutation');
 await db.person.update({where:{personId:person.personId},data:{status:'SUSPENDED'}});
 equal((await call('GET','member/me',token)).statusCode,401,'disabled Person denied despite valid session');
 const document=SwaggerModule.createDocument(app,new DocumentBuilder().addBearerAuth(undefined,'memberBearer').build());
 equal(document.paths['/api/v1/member/me'].get.security,[{memberBearer:[]}],'Member OpenAPI declares auth');
 equal(Boolean(document.paths['/api/v1/auth/member/line/exchange'].post.requestBody),true,'LINE exchange DTO exported');
 if(process.env.MEMBER_CONTRACT_OUTPUT_DIR)writeFileSync(process.env.MEMBER_CONTRACT_OUTPUT_DIR+'/member-journey.json',JSON.stringify({kind:'CONNECTED_DEV_TEST_ONLY_SYNTHETIC_LINE',result:'PASS',operationalCredentialsVerified:false,assertions,results},null,2)+'\n');
 console.log(`MEMBER_IDENTITY_DB_PASS: ${assertions} HTTP/DB assertions; synthetic LINE boundary, two owned balls, BOLA, replay, expiry, disabled Person and OpenAPI; formal LINE NOT VERIFIED`);
}finally{if(app)await app.close();await db.$disconnect();}
