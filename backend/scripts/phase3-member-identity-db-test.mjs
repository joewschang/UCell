import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const require=createRequire(new URL('../package.json',import.meta.url)),apiRequire=createRequire(new URL('../apps/api/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const {NestFactory}=apiRequire('@nestjs/core'),{FastifyAdapter}=apiRequire('@nestjs/platform-fastify');
const {ValidationPipe,UnauthorizedException}=apiRequire('@nestjs/common');
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
const {EnvelopeInterceptor}=require('./apps/api/dist/common/interceptors/envelope.interceptor.js');
const {RequestContextInterceptor}=require('./apps/api/dist/common/interceptors/request-context.interceptor.js');
const url=new URL(process.env.DATABASE_URL??'');assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.match(process.env.GOLDEN_ISOLATION_DATABASE??'',/^ucell_dev_golden_[a-f0-9]{32}$/);assert.equal(url.pathname,'/'+process.env.GOLDEN_ISOLATION_DATABASE);
const db=new PrismaClient();let app,assertions=0;
function equal(actual,expected,label){assert.deepEqual(actual,expected,label);assertions++;}
try{
 const person=await db.person.create({data:{legalName:'MEMBER A TEST ONLY',status:'EFFECTIVE'}});
 const other=await db.person.create({data:{legalName:'MEMBER B TEST ONLY',status:'EFFECTIVE'}});
 const empty=await db.person.create({data:{legalName:'MEMBER EMPTY TEST ONLY',status:'EFFECTIVE'}});
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
 const call=(method,path,token,body)=>server.inject({method,url:'/api/v1/'+path,headers:token?{authorization:'Bearer '+token}:{},...(body?{payload:body}:{})});
 let res=await call('POST','auth/member/line/exchange',null,{idToken:'VALID_TEST_ONLY'});equal(res.statusCode,201,'synthetic verified LINE exchange');
 const token=res.json().data.accessToken;
 equal((await call('POST','auth/member/line/exchange',null,{idToken:'VALID_TEST_ONLY'})).statusCode,409,'ID token replay denied');
 equal((await call('POST','auth/member/line/exchange',null,{idToken:'INVALID_TEST_ONLY'})).statusCode,401,'invalid LINE token denied');
 equal((await call('POST','auth/member/line/exchange',null,{idToken:'UNBOUND_TEST_ONLY'})).statusCode,401,'unbound LINE denied');
 equal((await call('GET','member/me')).statusCode,401,'missing session denied');
 res=await call('GET','member/me?personId='+other.personId,token);equal(res.statusCode,200,'member me authenticated');equal(res.json().data.name,person.legalName,'client Person tampering ignored');
 res=await call('GET','member/qualifications',token);equal(res.statusCode,200,'owned qualifications fetched');equal(res.json().data.map(q=>q.id),ids.slice(0,2),'only both owned balls returned');
 for(const id of ids.slice(0,2)){res=await call('POST','member/context/qualification',token,{qualificationId:id});equal(res.statusCode,201,'owned ball context allowed');equal(res.json().data.qualificationId,id,'ball context echoes verified id');}
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
 const before=[await db.pvLedger.count(),await db.bonusAward.count(),await db.bonusRecoveryEvent.count()];
 for(let i=0;i<3;i++)await call('GET','member/qualifications',token);
 equal([await db.pvLedger.count(),await db.bonusAward.count(),await db.bonusRecoveryEvent.count()],before,'repeated GET has no monetary side effect');
 await db.person.update({where:{personId:person.personId},data:{status:'SUSPENDED'}});
 equal((await call('GET','member/me',token)).statusCode,401,'disabled Person denied despite valid session');
 const document=SwaggerModule.createDocument(app,new DocumentBuilder().addBearerAuth(undefined,'memberBearer').build());
 equal(document.paths['/api/v1/member/me'].get.security,[{memberBearer:[]}],'Member OpenAPI declares auth');
 equal(Boolean(document.paths['/api/v1/auth/member/line/exchange'].post.requestBody),true,'LINE exchange DTO exported');
 console.log(`MEMBER_IDENTITY_DB_PASS: ${assertions} HTTP/DB assertions; synthetic LINE boundary, two owned balls, BOLA, replay, expiry, disabled Person and OpenAPI; formal LINE NOT VERIFIED`);
}finally{if(app)await app.close();await db.$disconnect();}
