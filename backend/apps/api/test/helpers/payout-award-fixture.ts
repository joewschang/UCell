import {randomUUID} from 'node:crypto';
import {PrismaClient, type PayoutLine} from '@prisma/client';

/** Build a real, effective award and its ledger entry before approving a synthetic payout. */
export function attachPayoutAward(
  db: PrismaClient, line: Pick<PayoutLine,'payoutLineId'|'recipientQualificationId'|'grossAmount'>,
  personId: string, occurredAt: Date, ruleVersionCode = 'SYNTHETIC',
) {
  return db.$transaction(async tx=>{
    const qualificationId=line.recipientQualificationId;
    const holder=await tx.qualificationHolderHistory.findFirst({where:{qualificationId,
      effectiveFrom:{lte:occurredAt},OR:[{effectiveTo:null},{effectiveTo:{gt:occurredAt}}]}});
    if(!holder) {
      await tx.qualificationHolderHistory.create({data:{qualificationId,holderPersonId:personId,
        effectiveFrom:occurredAt,sourceType:'PAYOUT_TEST_FIXTURE'}});
    } else if(holder.holderPersonId!==personId) {
      throw Error('Synthetic payout person does not own the qualification at award time');
    }
    const award=await tx.bonusAward.create({data:{
      recipientQualificationId:qualificationId,awardType:'REFERRAL',sourceEventId:randomUUID(),
      activeSnapshot:true,theoryAmount:line.grossAmount,payableAmount:line.grossAmount,ruleVersionCode,
      occurredAt,pendingUntil:occurredAt,calculationDetail:{fixture:'payout'},
    }});
    await tx.bonusAwardLifecycleEvent.create({data:{bonusAwardId:award.bonusAwardId,status:'EFFECTIVE',occurredAt}});
    return tx.payableEntry.create({data:{qualificationId,payoutLineId:line.payoutLineId,
      sourceType:'BONUS_AWARD',sourceId:award.bonusAwardId,awardType:award.awardType,
      grossAmount:award.payableAmount,availableAt:occurredAt,status:'ALLOCATED',ruleVersionCode}});
  });
}
