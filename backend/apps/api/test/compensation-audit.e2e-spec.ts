import {auditOrderVolume} from '../../../packages/database/src/compensation-audit-orders';
import {createHash} from 'node:crypto';
import {periodBinary} from '@ucell/database';
import {binaryCalculationEnvelope} from '../../../packages/database/src/award-rebase-topology';
import {binary,d} from './phase2-fixtures';
import {verifyPayoutSources} from '@ucell/database';

describe('current-tree recalculation and payout verification',()=>{
  it('retains rebased sides when replaying a later partial return',async()=>{
    const original=binary();
    original.evidence.carryRecipients[0].leftCarryIn='0';
    const binaryEdges=original.evidence.sources.flatMap((s:any)=>s.evidence.binary.map((e:any)=>({...e,side:'RIGHT'})));
    const hash=createHash('sha256').update(JSON.stringify(binaryEdges.map((e:any)=>['B',e.childQualificationId,e.parentQualificationId,e.side]).sort())).digest('hex');
    const tx={auditEvent:{findFirst:async()=>({afterData:{hash,sponsor:[],binary:binaryEdges},afterHash:hash})}};
    const changed=await binaryCalculationEnvelope(tx as any,original);
    const volume=new Map([['left',d(600)],['right',d(900)]]);
    expect(original.evidence.sources[0].evidence.binary[0].side).toBe('LEFT');
    expect(periodBinary(changed,volume,new Map()).pairedPv.get('root')!.toString()).toBe('0');
    expect(periodBinary(changed,volume,new Map()).carryOut.get('root')!.right.toString()).toBe('1500');
  });
  function payoutFixture(){
    const occurredAt=new Date('2026-08-01T00:00:00Z');
    const batch={periodStart:occurredAt,periodEnd:new Date('2026-09-01T00:00:00Z'),totalGross:d(100),totalRecovery:d(0),totalNet:d(100)};
    const entry={sourceType:'BONUS_AWARD',sourceId:'award',qualificationId:'q',ruleVersionCode:'R1',status:'ALLOCATED',grossAmount:d(100)};
    const application={amount:d(100),recoveryEvent:{bonusAward:{recipientQualificationId:'q'}}};
    const line={payoutLineId:'line',recipientQualificationId:'q',grossAmount:d(100),recoveryOffset:d(0),netAmount:d(100),
      payableEntries:[entry],recoveryApplications:[] as typeof application[]};
    const holder={holderPersonId:null,holderLegalEntityId:'company'};
    const tx={payoutBatch:{findUniqueOrThrow:async()=>batch},payoutLine:{findMany:async()=>[line]},
      bonusAward:{findUniqueOrThrow:async()=>({recipientQualificationId:'q',occurredAt,payableAmount:d(100)})},
      awardEconomicDestination:{findFirst:async()=>null},qualification:{findUniqueOrThrow:async()=>({currentHolderLegalEntityId:'company',currentHolderPersonId:null,currentCompanyPrincipalId:null})},
      qualificationHolderHistory:{findMany:async()=>[holder]},qualificationOwnerInterval:{findMany:async()=>[{ownerType:'LEGAL_ENTITY',legalEntityId:'company',personId:null}]},
      settlementBatch:{findMany:async()=>[]}};
    return {tx,line,entry,application,batch,holder,verify:()=>verifyPayoutSources(tx as any,'batch')};
  }
  it('blocks an award belonging to a different current or historical legal beneficiary',async()=>{
    const f=payoutFixture();
    f.tx.qualification.findUniqueOrThrow=async()=>({currentHolderLegalEntityId:'new',currentHolderPersonId:null,currentCompanyPrincipalId:null});
    await expect(f.verify()).rejects.toThrow('受領身分需要覆核');
    const conflict=payoutFixture();conflict.holder.holderLegalEntityId='different';
    await expect(conflict.verify()).rejects.toThrow('受領身分需要覆核');
  });
  it('requires the same recipient on every payable and each recovery applied to a payout line',async()=>{
    const f=payoutFixture();f.line.recipientQualificationId='another';
    await expect(f.verify()).rejects.toThrow('受領資格');
    const offset=payoutFixture();offset.application.recoveryEvent.bonusAward.recipientQualificationId='another';
    offset.line.recoveryApplications.push(offset.application);
    await expect(offset.verify()).rejects.toThrow('追回沖抵的受領資格');
  });
  it('rejects missing gross evidence, an unallocated payable, unsubstantiated offsets and wrong batch totals',async()=>{
    const missing=payoutFixture();missing.line.payableEntries=[];
    await expect(missing.verify()).rejects.toThrow('來源總額');
    const state=payoutFixture();state.entry.status='OPEN';
    await expect(state.verify()).rejects.toThrow('分配狀態');
    const offset=payoutFixture();offset.line.recoveryOffset=d(5);offset.line.netAmount=d(95);
    await expect(offset.verify()).rejects.toThrow('追回沖抵');
    const totals=payoutFixture();totals.batch.totalNet=d(101);
    await expect(totals.verify()).rejects.toThrow('批次與明細');
  });
  it('accepts reconciled positive payouts, fully evidenced recovery offsets, and empty zero-value lines',async()=>{
    await expect(payoutFixture().verify()).resolves.toBeUndefined();
    const settled=payoutFixture();
    settled.line.recoveryApplications.push(settled.application);
    settled.line.recoveryOffset=settled.batch.totalRecovery=d(100);settled.line.netAmount=settled.batch.totalNet=d(0);
    await expect(settled.verify()).resolves.toBeUndefined();
    const zero=payoutFixture();
    zero.line.payableEntries=[];zero.line.grossAmount=zero.line.netAmount=zero.batch.totalGross=zero.batch.totalNet=d(0);
    await expect(zero.verify()).resolves.toBeUndefined();
  });
});

describe('repurchase audit coverage',()=>{
  it.each([3,6,12])('finds an absent installment on a %i-month package beyond the first 200 orders',async duration=>{
    const packages=Array.from({length:203},(_,index)=>({orderId:String(index),activeDurationValue:duration,targetQualificationId:'ball'}));
    const tx={
      qualificationSetup:{findMany:async()=>[]},order:{findMany:async()=>packages},
      subscriptionCancellation:{findMany:async()=>[]},packagePurchaseSnapshot:{findMany:async()=>packages},monthlyRecognitionSchedule:{findMany:async()=>[]},
      subscription:{findMany:async({where}:{where:{orderId:string}})=>[{qualificationId:'ball',schedules:Array.from({length:where.orderId==='202'?duration-1:duration},(_,index)=>({installmentNo:index+1}))}]},
    };
    const result=await auditOrderVolume(tx as any,{periodStart:new Date(0),periodEnd:new Date(1),ruleVersionCode:'test'} as any);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({reason:'INSTALLMENT',order:'202',qid:'ball'});
  });
});

describe('sealed repurchase calendar and volume policy',()=>{
  it.each([['0',0],['1200',1]])('checks the saved monthly GPV amount %s and the reserved start month',async(gpv,count)=>{
    const dueAt=new Date('2020-11-30T16:00:00Z');
    const row={subscriptionId:'s',subscription:{orderId:'o',qualificationId:'q',status:'ACTIVE'},recognitionId:'r',status:'RECOGNIZED',installmentNo:1,recognizedAmount:d(2000),rpvAmount:d(1200),dueAt};
    const events=['RPV',...(count?['GPV']:[])].map(pvType=>({pvType,amount:d(1200),qualificationId:'q'}));
    const tx={qualificationSetup:{findMany:async()=>[]},subscriptionCancellation:{findMany:async()=>[]},
      order:{findMany:async()=>[],findUniqueOrThrow:async()=>({paidAt:new Date('2020-11-08T13:00:00Z')})},
      packagePurchaseSnapshot:{findMany:async()=>[],findUnique:async()=>({packageClass:'ACTIVE_DURATION',packageCode:'ACTIVE_QUARTER',priceAmount:d(6000),selectableProductQuantity:2})},
      monthlyRecognitionSchedule:{findMany:async()=>[row]},auditEvent:{findFirst:async()=>({afterData:{timing:'PAYMENT_THEN_MONTH_START',startMonth:'2020-12-01T00:00:00Z',gpvPerMonth:gpv}})},pvLedger:{findMany:async()=>events}};
    const batch={periodStart:new Date(0),periodEnd:new Date('2020-12-02'),ruleVersionCode:'test'};
    expect((await auditOrderVolume(tx as any,batch as any)).issues).toHaveLength(0);
    events.push({pvType:'GPV',amount:d(1200),qualificationId:'q'});
    expect((await auditOrderVolume(tx as any,batch as any)).issues[0].reason).toBe('INSTALLMENT');
  });
});
