import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {BonusLifecycleService} from '../src/modules/bonus/bonus-lifecycle.service';
import {UnifiedPayableService} from '../src/modules/payout/unified-payable.service';
import {RecoveryBalanceService} from '../src/modules/payout/recovery-balance.service';
import {matureBonusAwards} from '../../worker/src/main';
import {matureBonusAward} from '@ucell/database';
const url=process.env.PHASE2_TEST_DATABASE_URL;
if(!url||!/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1)))throw Error('ISOLATED_DATABASE_REQUIRED');
describe('Annual accumulated award maturity backlog (synthetic source awards)',()=>{
 const db=new PrismaClient({datasources:{db:{url}}});afterAll(()=>db.$disconnect());
 it('advances past 501 terminal awards, matures 600 pending awards in bounded polls and materializes once',async()=>{
  const person=await db.person.create({data:{legalName:'SYNTHETIC ANNUAL BACKLOG'}});
  const q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date('2023-01-01Z')}});
  const rule='TEST_MATURITY_'+randomUUID(),now=new Date('2025-03-01Z'),old=new Date('2024-01-01Z');
  // Direct source fixtures exercise downstream maturity/payable routing only;
  // they do not certify upstream bonus formulas or enrollment/payment workflows.
  const types=['REFERRAL','RETAIL_REFERRAL','EQUALIZATION','BINARY','MATCHING','EPV'] as const;
  const terminal=Array.from({length:501},()=>randomUUID()),pending=Array.from({length:600},()=>randomUUID());
  const reversed=randomUUID(),future=randomUUID();
  const ids=[...terminal,...pending,reversed,future];
  const dates=new Map<string,Date>(ids.map((id,i)=>[id,i<501?new Date('2023-11-01Z'):id===future?new Date('2025-02-15Z'):new Date(Date.UTC(2024,(i-501)%12,1))]));
  const due=(id:string)=>new Date(dates.get(id)!.getTime()+45*86400000);
  await db.bonusAward.createMany({data:ids.map((id,i)=>({bonusAwardId:id,awardType:types[i%6],recipientQualificationId:q.qualificationId,sourceEventId:randomUUID(),theoryAmount:'10',payableAmount:'10',kFactor:1,activeSnapshot:true,planLevelSnapshot:'STARTER',ruleVersionCode:rule,occurredAt:dates.get(id)!,pendingUntil:due(id),calculationDetail:{synthetic:'DOWNSTREAM_ONLY'}}))});
  await db.bonusAwardLifecycleEvent.createMany({data:[...terminal.map(id=>({bonusAwardId:id,status:'PENDING_45D' as const,occurredAt:dates.get(id)!})),...terminal.map(id=>({bonusAwardId:id,status:'EFFECTIVE' as const,occurredAt:old})),...pending.concat(reversed,future).map(id=>({bonusAwardId:id,status:'PENDING_45D' as const,occurredAt:dates.get(id)!})),{bonusAwardId:reversed,status:'REVERSED' as const,occurredAt:new Date('2024-02-01Z')}]});
  const maturity=new BonusLifecycleService(db as any);
  expect(await maturity.matureDueAwards(now)).toEqual({matured:500});
  expect(await matureBonusAwards(db as any,now)).toEqual({matured:100});
  expect(await maturity.matureDueAwards(now)).toEqual({matured:0});
  const effective=await db.bonusAwardLifecycleEvent.groupBy({by:['bonusAwardId'],where:{bonusAwardId:{in:pending},status:'EFFECTIVE'},_count:true});
  expect(effective).toHaveLength(600);expect(effective.every(e=>e._count===1)).toBe(true);
  expect(await db.bonusAwardLifecycleEvent.count({where:{bonusAwardId:{in:[reversed,future]},status:'EFFECTIVE'}})).toBe(0);
  const pay=new UnifiedPayableService(db as any,new RecoveryBalanceService(db as any));
  expect(await pay.materialize(now,rule)).toEqual({created:1101});expect(await pay.materialize(now,rule)).toEqual({created:0});
  const byType=await db.payableEntry.groupBy({by:['awardType'],where:{qualificationId:q.qualificationId},_sum:{grossAmount:true},_count:true});
  for(let i=0;i<types.length;i++){
   const row=byType.find(r=>r.awardType===types[i])!;expect(row._count).toBe(i<3?184:183);expect(row._sum.grossAmount!.toString()).toBe(i<3?'1840':'1830');
  }
  const batch=await pay.createPayoutBatch(new Date('2024-01-01Z'),now,rule);
  expect(batch.totalGross.toString()).toBe('11010');expect(batch.totalNet.toString()).toBe('11010');expect(batch.totalRecovery.toString()).toBe('0');
  expect(await db.payableEntry.count({where:{qualificationId:q.qualificationId,status:'ALLOCATED'}})).toBe(1101);
  expect(await db.payableEntry.count({where:{sourceId:{in:[reversed,future]}}})).toBe(0);
  const empty=await pay.createPayoutBatch(new Date('2024-01-01Z'),now,rule);expect(empty.totalGross.toString()).toBe('0');
 },120000);
 it('equal timestamps and concurrent maturity produce exactly one EFFECTIVE',async()=>{
  const p=await db.person.create({data:{legalName:'SYNTHETIC SAME TIMESTAMP'}}),at=new Date('2024-01-01Z');
  const q=await db.qualification.create({data:{currentHolderPersonId:p.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:at}});
  const a=await db.bonusAward.create({data:{awardType:'REFERRAL',recipientQualificationId:q.qualificationId,sourceEventId:randomUUID(),theoryAmount:10,payableAmount:10,kFactor:1,activeSnapshot:true,planLevelSnapshot:'STARTER',ruleVersionCode:'R1.0B',occurredAt:at,pendingUntil:at,calculationDetail:{synthetic:true}}});
  await db.bonusAwardLifecycleEvent.createMany({data:[{bonusAwardId:a.bonusAwardId,status:'CALCULATED',occurredAt:at},{bonusAwardId:a.bonusAwardId,status:'PENDING_45D',occurredAt:at}]});
  expect((await Promise.all([matureBonusAward(db,a.bonusAwardId,at),matureBonusAward(db,a.bonusAwardId,at)])).sort()).toEqual([false,true]);
  expect(await matureBonusAward(db,a.bonusAwardId,at)).toBe(false);
  expect(await db.bonusAwardLifecycleEvent.count({where:{bonusAwardId:a.bonusAwardId,status:'EFFECTIVE'}})).toBe(1);
 });
});
