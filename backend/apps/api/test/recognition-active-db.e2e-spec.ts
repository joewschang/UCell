import {Prisma,PrismaService,recognizeConsumption} from '@ucell/database';
import {randomUUID} from 'node:crypto';

const ROLLBACK='TEST_ROLLBACK';
const at=(local:string)=>new Date(`${local}+08:00`);

describe('R1.0B v3 recognition and Active DB slice',()=>{
  it('uses qualification-scoped Taipei-month evidence and exactly-once concrete GPV',async()=>{
    const db=new PrismaService();
    try{
      await expect(db.$transaction(async tx=>{
        const person=await tx.person.create({data:{legalName:'RECOGNITION ACTIVE DB TEST',status:'EFFECTIVE'}});
        const ballA=await tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE'}});
        const ballB=await tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE'}});
        const input=(sourceId:string,recognizedAt:Date,amount:string)=>({qualificationId:ballA.qualificationId,sourceType:'TEST_ORDER',sourceId,
          amount,eligible:true,concreteVolumeType:'GPV' as const,productProfileVersion:'TEST_PROFILE_V1',ruleVersionCode:'TEST_ONLY',
          parameterSnapshotHash:'test-only-parameter-hash',recognizedAt,activeThreshold:'1200',correlationId:randomUUID()});

        const before=await recognizeConsumption(tx,input(randomUUID(),at('2026-09-30T11:59:59'),'1199'));
        expect(before.accumulator?.thresholdCrossed).toBe(false);
        expect(await tx.activePeriod.count({where:{qualificationId:ballA.qualificationId,activeFrom:{lte:at('2026-09-30T11:59:59')},OR:[{activeTo:null},{activeTo:{gt:at('2026-09-30T11:59:59')}}]}})).toBe(0);

        const crossing=await recognizeConsumption(tx,input(randomUUID(),at('2026-09-30T12:00:00'),'1'));
        expect(crossing.accumulator?.thresholdCrossed).toBe(true);
        expect(await tx.activePeriod.count({where:{qualificationId:ballA.qualificationId,activeFrom:{lte:at('2026-09-30T12:00:00')},OR:[{activeTo:null},{activeTo:{gt:at('2026-09-30T12:00:00')}}]}})).toBe(1);
        expect(await tx.activePeriod.count({where:{qualificationId:ballA.qualificationId,activeFrom:{lte:at('2026-09-30T12:00:01')},OR:[{activeTo:null},{activeTo:{gt:at('2026-09-30T12:00:01')}}]}})).toBe(1);
        expect(await tx.activePeriod.count({where:{qualificationId:ballB.qualificationId,activeFrom:{lte:at('2026-09-30T12:00:01')},OR:[{activeTo:null},{activeTo:{gt:at('2026-09-30T12:00:01')}}]}})).toBe(0);

        const october=await recognizeConsumption(tx,input(randomUUID(),at('2026-10-01T00:00:00'),'1'));
        expect(october.accumulator?.cumulativeBefore.toString()).toBe('0');
        expect(october.accumulator?.sequenceNo).toBe(1);
        expect(await tx.activePeriod.count({where:{qualificationId:ballA.qualificationId,activeFrom:{lte:at('2026-10-01T00:00:00')},OR:[{activeTo:null},{activeTo:{gt:at('2026-10-01T00:00:00')}}]}})).toBe(0);

        const sourceId=randomUUID(),first=await recognizeConsumption(tx,input(sourceId,at('2026-10-01T12:00:00'),'100'));
        const replay=await recognizeConsumption(tx,input(sourceId,at('2026-10-01T12:00:00'),'100'));
        expect(first.created).toBe(true);expect(replay.created).toBe(false);
        expect(replay.volume?.eventId).toBe(first.volume?.eventId);
        expect(await tx.pvLedger.count({where:{sourceType:'TEST_ORDER',sourceId,pvType:'GPV'}})).toBe(1);
        expect(await tx.volumeRecognitionClassification.count({where:{volumeEventId:first.volume!.eventId,concreteVolumeType:'GPV'}})).toBe(1);

        const historicalSource=randomUUID(),historicalAt=at('2026-10-02T09:00:00');
        const historical=await tx.pvLedger.create({data:{qualificationId:ballA.qualificationId,pvType:'GPV',amount:'50',sourceType:'TEST_ORDER',sourceId:historicalSource,
          eventType:'GPV_CREATED',ruleVersionCode:'TEST_ONLY',parameterSnapshotHash:'test-only-parameter-hash',occurredAt:historicalAt,correlationId:randomUUID()}});
        const attached=await recognizeConsumption(tx,input(historicalSource,historicalAt,'50'));
        expect(attached.volume?.eventId).toBe(historical.eventId);
        expect(await tx.pvLedger.count({where:{sourceType:'TEST_ORDER',sourceId:historicalSource,pvType:'GPV'}})).toBe(1);
        expect(await tx.volumeRecognitionClassification.count({where:{volumeEventId:historical.eventId}})).toBe(1);
        throw new Error(ROLLBACK);
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000})).rejects.toThrow(ROLLBACK);
    }finally{await db.$disconnect();}
  },40000);
});
