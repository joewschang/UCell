import { UnauthorizedException } from '@nestjs/common';
import { AdminAuthenticationGuard } from '../src/modules/auth/admin-authentication.guard';
import { OrderService } from '../src/modules/order/order.service';
import { QualificationWorkflowService } from '../src/modules/qualification/qualification-workflow.service';

const packageVersion={
  packageProfileVersionId:'package-version',profile:{packageClass:'QUALIFICATION',stableCode:'STARTER'},
  currency:'TWD',priceAmount:{toString:()=> '14400'},displayName:'Starter',selectableProductQuantity:1,
  membershipEffect:'FORMAL_ELIGIBILITY',qualificationEffect:'CREATE_QUALIFICATION',activeDurationUnit:null,
  activeDurationValue:null,recognitionConfigRef:'R1.0B',configHash:'a'.repeat(64),
};

function packageHarness(){
  let sequence=0;
  const tx:any={
      $queryRaw:jest.fn(async()=>[]),binaryTreeMembership:{findUnique:jest.fn(async()=>null)},
    person:{findUnique:jest.fn(async()=>({status:'EFFECTIVE'}))},
    qualification:{create:jest.fn(async({data}:any)=>({qualificationId:`ball-${++sequence}`,...data}))},
    qualificationHolderHistory:{create:jest.fn()},qualificationStatusHistory:{create:jest.fn()},
    order:{create:jest.fn(async({data}:any)=>({orderId:`order-${sequence}`,qualificationId:data.qualificationId,lines:[]}))},
    packagePurchaseSnapshot:{create:jest.fn(async()=>({packagePurchaseSnapshotId:`snapshot-${sequence}`}))},
  };
  const stored=new Map<string,unknown>();
  const idempotency={execute:jest.fn(async(scope:string,key:string,payload:unknown,work:(tx:any)=>Promise<unknown>)=>{
    const identity=`${scope}:${key}`;
    if(stored.has(identity))return {value:stored.get(identity),replayed:true};
    const value=await work(tx);stored.set(identity,value);return {value,replayed:false};
  })};
  const audit={write:jest.fn()},outbox={enqueue:jest.fn()};
  const product={productId:'product',sku:'SKU',displayName:'Product'};
  const packages={checkoutData:jest.fn(async()=>({version:packageVersion,selections:[{productRuleProfileId:'profile',quantity:1,profile:{productRuleProfileId:'profile'},product,productConfigHash:'b'.repeat(64)}]}))};
  return {tx,service:new OrderService({} as any,idempotency as any,audit as any,outbox as any,packages as any)};
}

describe('Boundary Golden B15-B17 package-created Qualifications',()=>{
  const input={packageVersionId:'package-version',selections:[{productRuleProfileId:'profile',quantity:1}]};
  it('B15 creates an additional independent Ball for every distinct package operation',async()=>{
    const h=packageHarness();
    const first:any=await h.service.createMember(input,'fulfillment-1','request-1','person');
    const second:any=await h.service.createMember(input,'fulfillment-2','request-2','person');
    expect(first.value.qualificationId).not.toBe(second.value.qualificationId);
    expect(h.tx.qualification.create).toHaveBeenCalledTimes(2);
    expect(h.tx.qualificationHolderHistory.create).toHaveBeenCalledTimes(2);
  });
  it('B16 applies no Person-level maximum-count restriction',async()=>{
    const h=packageHarness();
    for(let index=0;index<32;index++)await h.service.createMember(input,`fulfillment-${index}`,`request-${index}`,'person');
    expect(h.tx.qualification.create).toHaveBeenCalledTimes(32);
  });
  it('B17 replays duplicate package fulfillment without creating another Ball',async()=>{
    const h=packageHarness();
    const first:any=await h.service.createMember(input,'same-fulfillment','request-1','person');
    const retry:any=await h.service.createMember(input,'same-fulfillment','request-2','person');
    expect(retry.replayed).toBe(true);
    expect(retry.value.qualificationId).toBe(first.value.qualificationId);
    expect(h.tx.qualification.create).toHaveBeenCalledTimes(1);
    expect(h.tx.packagePurchaseSnapshot.create).toHaveBeenCalledTimes(1);
  });
});

describe('Boundary Golden B18-B19 company-held exit',()=>{
  it('preserves Qualification identity, trees, carry and historical monetary rows',async()=>{
    const workflow={qualificationWorkflowId:'exit',qualificationId:'ball-stable',workflowType:'EXIT',status:'SUBMITTED',payload:{reviewFeePaid:true,companyHolderPersonId:'company'}};
    const tx:any={
      $queryRaw:jest.fn(async()=>[]),binaryTreeMembership:{findUnique:jest.fn(async()=>null)},
      qualificationWorkflow:{findUniqueOrThrow:jest.fn(async()=>workflow),update:jest.fn()},
      qualificationHolderHistory:{findFirst:jest.fn(async()=>({holderHistoryId:'holder-old'})),update:jest.fn(),create:jest.fn()},
      qualification:{findUniqueOrThrow:jest.fn(async()=>({kind:'MEMBER_ORIGIN'})),update:jest.fn(async({where,data}:any)=>({...where,...data}))},person:{findUnique:jest.fn(async()=>({personId:'company'}))},
      sponsorRelationship:{update:jest.fn(),create:jest.fn(),delete:jest.fn()},binaryPlacement:{update:jest.fn(),create:jest.fn(),delete:jest.fn()},
      binaryCarry:{update:jest.fn(),create:jest.fn(),delete:jest.fn()},bonusAward:{update:jest.fn(),create:jest.fn(),delete:jest.fn()},pvLedger:{update:jest.fn(),create:jest.fn(),delete:jest.fn()},
    };
    const status={transition:jest.fn()};
    const service=new QualificationWorkflowService({$transaction:async(work:any)=>work(tx)} as any,status as any);
    await service.approve('exit',new Date('2100-01-01T00:00:00Z'));
    expect(tx.qualification.update).toHaveBeenCalledWith({where:{qualificationId:'ball-stable'},data:{currentHolderPersonId:'company',status:'CLOSED',activeFlag:false}});
    expect(tx.qualificationHolderHistory.create).toHaveBeenCalledWith({data:expect.objectContaining({qualificationId:'ball-stable',holderPersonId:'company',sourceType:'QUALIFICATION_EXIT_COMPANY_HELD'})});
    for(const model of [tx.sponsorRelationship,tx.binaryPlacement,tx.binaryCarry,tx.bonusAward,tx.pvLedger]){
      expect(model.update).not.toHaveBeenCalled();expect(model.create).not.toHaveBeenCalled();expect(model.delete).not.toHaveBeenCalled();
    }
  });
});

describe('Boundary Golden B20 Stage-only Admin identity',()=>{
  const context=()=>({switchToHttp:()=>({getRequest:()=>({originalUrl:'/api/v1/admin/health',headers:{}})})}) as any;
  it('allows the explicitly configured local identity in Stage only',async()=>{
    const guard=new AdminAuthenticationGuard({authenticate:jest.fn()} as any,{get:(key:string)=>key==='ADMIN_AUTH_BYPASS'?'true':'staging'} as any);
    await expect(guard.canActivate(context())).resolves.toBe(true);
  });
  it('cannot authenticate to Production even if the Stage bypass flag leaks',async()=>{
    const authenticate=jest.fn();
    const guard=new AdminAuthenticationGuard({authenticate} as any,{get:(key:string)=>key==='ADMIN_AUTH_BYPASS'?'true':'production'} as any);
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authenticate).not.toHaveBeenCalled();
  });
});
