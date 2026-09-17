import { ConflictException } from '@nestjs/common';
import { Prisma } from '@ucell/database';
import { GlobalPoolPersistence } from '../src/modules/global-pool/global-pool-persistence';

const start=new Date('2026-08-25T16:00:00.000Z');
const end=new Date('2026-09-09T16:00:00.000Z');
const base={settlementId:'10000000-0000-4000-8000-000000000001',periodStart:start,periodEnd:end,totalGpv:new Prisma.Decimal(1000),poolRate:new Prisma.Decimal('.05'),poolAvailable:new Prisma.Decimal(50),distributedAmount:new Prisma.Decimal(10),undistributedAmount:new Prisma.Decimal(40),ruleVersionCode:'R1.0B',parameterSnapshot:{} as Prisma.InputJsonValue,awards:[]};

describe('Global settlement Reservoir A persistence',()=>{
  it('writes final settlement and initial Reservoir A effect in the same transaction boundary',async()=>{
    const calls:string[]=[],tx:any={
      globalPoolSettlement:{create:jest.fn(async({data}:any)=>{calls.push('settlement');return data;})},
      globalPoolAward:{create:jest.fn()},
      reservoirLedgerEffect:{create:jest.fn(async({data}:any)=>{calls.push('reservoir');return data;})},
    };
    await new GlobalPoolPersistence().persist(tx,base);
    expect(calls).toEqual(['settlement','reservoir']);
    expect(tx.globalPoolSettlement.create.mock.calls[0][0].data).toMatchObject({distributedAmount:base.distributedAmount,undistributedAmount:base.undistributedAmount});
    expect(tx.reservoirLedgerEffect.create.mock.calls[0][0].data).toMatchObject({reservoirCode:'A',effectType:'GLOBAL_UNDISTRIBUTED',amount:base.undistributedAmount});
  });

  it('propagates a Reservoir write failure so the enclosing database transaction rolls back',async()=>{
    const tx:any={globalPoolSettlement:{create:jest.fn(async({data}:any)=>data)},globalPoolAward:{create:jest.fn()},reservoirLedgerEffect:{create:jest.fn(async()=>{throw new Error('INJECTED_RESERVOIR_FAILURE');})}};
    await expect(new GlobalPoolPersistence().persist(tx,base)).rejects.toThrow('INJECTED_RESERVOIR_FAILURE');
  });

  it.each(['missing','tampered'])('fails closed for %s Reservoir evidence on replay',async(kind)=>{
    const persistence=new GlobalPoolPersistence();
    const settlement={globalPoolSettlementId:base.settlementId,periodStart:start,periodEnd:end,undistributedAmount:base.undistributedAmount,ruleVersionCode:'R1.0B'};
    const validTx:any={globalPoolSettlement:{findUnique:jest.fn(async()=>settlement)},reservoirLedgerEffect:{findFirst:jest.fn(async()=>null)}};
    if(kind==='tampered'){
      validTx.reservoirLedgerEffect.findFirst.mockResolvedValue({sourcePeriodStart:start,sourcePeriodEnd:end,amount:base.undistributedAmount,ruleVersionCode:'R1.0B',idempotencyKey:`reservoir:A:global-undistributed:${base.settlementId}`,evidenceHash:'tampered'});
    }
    await expect(persistence.verifiedExisting(validTx,start,end,'R1.0B')).rejects.toBeInstanceOf(ConflictException);
  });
});
