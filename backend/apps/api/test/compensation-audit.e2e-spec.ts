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
  it('rejects a changed legal beneficiary before a bank export',async()=>{
    const tx={payoutBatch:{findUniqueOrThrow:async()=>({})},payableEntry:{findMany:async()=>[{sourceType:'BONUS_AWARD',sourceId:'id',qualificationId:'q',grossAmount:d(100)}]},
      bonusAward:{findUniqueOrThrow:async()=>({recipientQualificationId:'q',occurredAt:new Date(),payableAmount:d(100)})},
      awardEconomicDestination:{findFirst:async()=>null},qualification:{findUniqueOrThrow:async()=>({currentHolderLegalEntityId:'new',currentHolderPersonId:null})},
      qualificationHolderHistory:{findMany:async()=>[]},qualificationOwnerInterval:{findMany:async()=>[{ownerType:'LEGAL_ENTITY',legalEntityId:'original'}]}};
    await expect(verifyPayoutSources(tx as any,'batch')).rejects.toThrow('受領身分需要覆核');
  });
});

describe('repurchase audit coverage',()=>{
  it.each([3,6,12])('finds an absent installment on a %i-month package beyond the first 200 orders',async duration=>{
    const packages=Array.from({length:203},(_,index)=>({orderId:String(index),activeDurationValue:duration,targetQualificationId:'ball'}));
    const tx={
      qualificationSetup:{findMany:async()=>[]},order:{findMany:async()=>packages},
      packagePurchaseSnapshot:{findMany:async()=>packages},monthlyRecognitionSchedule:{findMany:async()=>[]},
      subscription:{findMany:async({where}:{where:{orderId:string}})=>[{qualificationId:'ball',schedules:Array.from({length:where.orderId==='202'?duration-1:duration},(_,index)=>({installmentNo:index+1}))}]},
    };
    const result=await auditOrderVolume(tx as any,{periodStart:new Date(0),periodEnd:new Date(1),ruleVersionCode:'test'} as any);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({reason:'INSTALLMENT',order:'202',qid:'ball'});
  });
});
