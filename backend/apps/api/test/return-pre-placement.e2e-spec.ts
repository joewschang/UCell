import {Prisma} from '@prisma/client';
import {ReturnService} from '../src/modules/return/return.service';

describe('ReturnService pre-placement reversal',()=>{
 it('reverses a pending setup only after a full qualification-order return',async()=>{
  const line={orderLineId:'line',quantity:new Prisma.Decimal(1),lineAmount:new Prisma.Decimal(100),gpvAmountSnapshot:new Prisma.Decimal(0)};
  const createdReturn={returnCaseId:'return-1'};
  const tx:any={
   order:{findUnique:jest.fn().mockResolvedValue({orderId:'order',status:'PAID',paidAt:new Date('2044-01-01T00:00:00.000Z'),netAmount:new Prisma.Decimal(100),qualificationId:'qualification',ruleVersionCode:'R1',lines:[line]}),update:jest.fn()},
   returnCase:{findUnique:jest.fn().mockResolvedValue(null),create:jest.fn().mockResolvedValue(createdReturn),findUniqueOrThrow:jest.fn().mockResolvedValue({...createdReturn,lines:[]})},
   returnLine:{aggregate:jest.fn().mockResolvedValue({_sum:{returnAmount:new Prisma.Decimal(0),quantity:new Prisma.Decimal(0)}}),create:jest.fn()},
   settlementBatch:{findMany:jest.fn().mockResolvedValue([])},settlementRecalculationRequest:{createMany:jest.fn()},
   qualificationSetup:{findUnique:jest.fn().mockResolvedValue({qualificationId:'qualification',setupStatus:'PLACEMENT_PENDING'}),update:jest.fn()}
  };
  const idempotency:any={execute:jest.fn(async (_scope:string,_key:string,_dto:any,work:any)=>work(tx))};
  const audit:any={write:jest.fn().mockResolvedValue(undefined)},outbox:any={enqueue:jest.fn().mockResolvedValue(undefined)};
  const service=new ReturnService(tx,idempotency,audit,outbox);
  await service.post('order',{reasonCode:'TEST',occurredAt:'2044-01-02T00:00:00.000Z',lines:[{orderLineId:'line',quantity:'1'}]} as any,'key','request','operator');
  expect(tx.qualificationSetup.update).toHaveBeenCalledWith({where:{qualificationId:'qualification'},data:{setupStatus:'REVERSED'}});
  expect(outbox.enqueue).toHaveBeenCalledWith(tx,expect.objectContaining({eventType:'QUALIFICATION_PRE_PLACEMENT_REVERSED',aggregateId:'qualification'}));
  expect(audit.write).toHaveBeenCalledWith(tx,expect.objectContaining({action:'QUALIFICATION_PRE_PLACEMENT_REVERSED'}));
 });
});
