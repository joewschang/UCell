import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(new URL('../package.json',import.meta.url)),apiRequire=createRequire(new URL('../apps/api/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const {NestFactory}=apiRequire('@nestjs/core'),{FastifyAdapter}=apiRequire('@nestjs/platform-fastify');
const {ValidationPipe,UnauthorizedException}=apiRequire('@nestjs/common');
const {SwaggerModule,DocumentBuilder}=apiRequire('@nestjs/swagger');
const {AppModule}=require('./apps/api/dist/app.module.js');
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
 }
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
 equal((await call('POST','member/context/qualification',token,{qualificationId:ids[2]})).statusCode,403,'foreign ball BOLA denied');
 equal((await call('POST','member/context/qualification',token,{qualificationId:randomUUID()})).statusCode,403,'forged ball denied');
 equal((await call('POST','member/context/qualification',token,{})).statusCode,400,'missing ball fails validation');
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
