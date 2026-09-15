import { QualificationGuard } from '../src/common/guards/qualification.guard';
import { ActiveService } from '../src/modules/active/active.service';
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
  it.todo('member share link is bound to selected qualification');
});
