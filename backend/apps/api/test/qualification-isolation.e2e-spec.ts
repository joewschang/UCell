import { QualificationGuard } from '../src/common/guards/qualification.guard';
import { ActiveService } from '../src/modules/active/active.service';
import { MemberShareLinkService } from '../src/modules/member/member-share-link.service';
import { ForbiddenException } from '@nestjs/common';
const context=(req:any)=>({switchToHttp:()=>({getRequest:()=>req})}) as any;
describe('Qualification isolation (P0)', () => {
  it('Person A cannot read Person B qualification',async()=>{
    const findFirst=jest.fn(async()=>null),guard=new QualificationGuard({qualification:{findFirst}} as any);
    await expect(guard.canActivate(context({user:{personId:'A'},headers:{'x-qualification-id':'ballB'}}))).rejects.toMatchObject({response:{code:'QUALIFICATION_NOT_OWNED'}});
    expect(findFirst).toHaveBeenCalledWith({where:{qualificationId:'ballB',currentHolderPersonId:'A'},select:{qualificationId:true}});
  });
  it('same person Ball A active does not make Ball B active',async()=>{
    const at=new Date('2020-01-01'),findFirst=jest.fn(async({where}:any)=>where.qualificationId==='ballA'?{activePeriodId:'periodA'}:null);
    const service=new ActiveService({activePeriod:{findFirst}} as any,{} as any);
    expect(await service.isActiveAt('ballA',at)).toBe(true);expect(await service.isActiveAt('ballB',at)).toBe(false);
    expect(findFirst).toHaveBeenLastCalledWith({where:{qualificationId:'ballB',activeFrom:{lte:at},OR:[{activeTo:null},{activeTo:{gt:at}}]},orderBy:{activeFrom:'desc'}});
  });
  it('missing qualification context returns AMBIGUOUS_QUALIFICATION',async()=>{
    const findFirst=jest.fn(),guard=new QualificationGuard({qualification:{findFirst}} as any);
    await expect(guard.canActivate(context({user:{personId:'A'},headers:{}}))).rejects.toMatchObject({response:{code:'AMBIGUOUS_QUALIFICATION'}});
    expect(findFirst).not.toHaveBeenCalled();
  });
  it('member share link is bound to selected qualification',async()=>{
    const previous={secret:process.env.MEMBER_SHARE_TOKEN_SECRET,base:process.env.MEMBER_REFERRAL_BASE_URL,ttl:process.env.MEMBER_SHARE_TOKEN_TTL_SECONDS};
    process.env.MEMBER_SHARE_TOKEN_SECRET='TEST_ONLY_32_BYTE_MEMBER_SHARE_SECRET';process.env.MEMBER_REFERRAL_BASE_URL='https://member.test.invalid';process.env.MEMBER_SHARE_TOKEN_TTL_SECONDS='3600';
    try{
      const assertHolder=jest.fn(async(personId:string,qualificationId:string)=>{if(personId!=='A'||qualificationId!=='ballA')throw new ForbiddenException('QUALIFICATION_ACCESS_DENIED');});
      const service=new MemberShareLinkService({assertHolder} as any),now=new Date('2026-09-16T00:00:00.000Z');
      const link=await service.create('A','ballA',now),token=new URL(link.shareUrl).pathname.split('/').pop()!;
      expect(link).toMatchObject({qualificationId:'ballA',expiresAt:'2026-09-16T01:00:00.000Z'});
      expect(link.shareUrl).not.toContain('ballA');
      expect(service.verify(token,now)).toMatchObject({version:1,qualificationId:'ballA'});
      await expect(service.create('A','ballB',now)).rejects.toBeInstanceOf(ForbiddenException);
      expect(assertHolder).toHaveBeenNthCalledWith(1,'A','ballA',now);expect(assertHolder).toHaveBeenNthCalledWith(2,'A','ballB',now);
    }finally{
      for(const [key,value] of Object.entries(previous)){const name=key==='secret'?'MEMBER_SHARE_TOKEN_SECRET':key==='base'?'MEMBER_REFERRAL_BASE_URL':'MEMBER_SHARE_TOKEN_TTL_SECONDS';if(value===undefined)delete process.env[name];else process.env[name]=value;}
    }
  });
});
