import {Test} from '@nestjs/testing';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {ConfigService} from '@nestjs/config';
import {UnauthorizedException} from '@nestjs/common';
import {PrismaService} from '@ucell/database';
import {SettlementCalendarService} from '@ucell/settlement';
import {SettlementJobsController} from '../src/modules/settlement-jobs/settlement-jobs.controller';
import {AuditService} from '../src/common/audit/audit.service';
import {IdentityTokenService} from '../src/modules/auth/identity-token.service';
import {AdminAuthenticationGuard} from '../src/modules/auth/admin-authentication.guard';
import {AdminRoleGuard} from '../src/modules/auth/admin-role.guard';
describe('settlement job HTTP authorization and input contract',()=>{
  let app:NestFastifyApplication;
  const id='00000000-0000-4000-8000-000000000701';
  const db={periodCloseJob:{findUnique:jest.fn(async()=>({periodCloseJobId:id,outbox:{processStatus:'PENDING'},receipt:null}))},$transaction:jest.fn(async()=>{})};
  beforeAll(async()=>{
    const module=await Test.createTestingModule({controllers:[SettlementJobsController],providers:[
      {provide:PrismaService,useValue:db},{provide:SettlementCalendarService,useValue:{}},{provide:AuditService,useValue:{write:jest.fn()}},
      {provide:IdentityTokenService,useValue:{authenticate:async(role:string)=>{if(!['FINANCE','COMPLIANCE_AUDIT','MEMBER'].includes(role))throw new UnauthorizedException();return {personId:id,role};}}},
      {provide:ConfigService,useValue:{get:(key:string)=>key==='NODE_ENV'?'production':'false'}},AdminAuthenticationGuard,AdminRoleGuard]}).compile();
    app=module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});
    app.useGlobalGuards(module.get(AdminAuthenticationGuard),module.get(AdminRoleGuard));await app.init();await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(()=>app.close());
  it('requires a valid session',async()=>{expect((await app.inject({method:'GET',url:'/admin/settlement-jobs/'+id})).statusCode).toBe(401);});
  it('allows compliance reads but denies compliance and member submissions',async()=>{
    expect((await app.inject({method:'GET',url:'/admin/settlement-jobs/'+id,headers:{authorization:'Bearer COMPLIANCE_AUDIT'}})).statusCode).toBe(200);
    for(const role of ['COMPLIANCE_AUDIT','MEMBER'])expect((await app.inject({method:'POST',url:'/admin/settlement-jobs',headers:{authorization:'Bearer '+role},payload:{}})).statusCode).toBe(403);
  });
  it('rejects malformed periods and caller-supplied actor fields before admission',async()=>{
    const response=await app.inject({method:'POST',url:'/admin/settlement-jobs',headers:{authorization:'Bearer FINANCE'},payload:{kind:'REFERRAL_K0',periodStart:'invalid',periodEnd:'invalid',ruleVersionCode:'R1.0B',prerequisiteIds:[],approvalReference:'REF',requestedBy:id}});
    expect(response.statusCode).toBe(400);
  });
});
