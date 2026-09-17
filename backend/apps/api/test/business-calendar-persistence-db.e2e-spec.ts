import {randomUUID} from 'node:crypto';
import {PrismaService} from '@ucell/database';
import {BusinessCalendarPersistenceService} from '../src/modules/settlement/business-calendar-persistence.service';

const testDatabaseUrl=process.env.CALENDAR_PERSISTENCE_TEST_DATABASE_URL
  ??process.env.PHASE2_TEST_DATABASE_URL
  ??'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public';
const parsed=new URL(testDatabaseUrl);
if(!['localhost','127.0.0.1'].includes(parsed.hostname)||!parsed.pathname.slice(1).endsWith('_test')) throw new Error('CALENDAR_PERSISTENCE_TEST_DATABASE_REQUIRED');
process.env.DATABASE_URL=testDatabaseUrl;

describe('Business calendar and payout anchor PostgreSQL boundary',()=>{
  const db=new PrismaService();
  const service=new BusinessCalendarPersistenceService(db);
  const suffix=randomUUID();
  const rule=(name:string)=>`TEST_CAL_${name}_${suffix}`;
  let isolatedYear=0;
  let missingYear=0;
  const d=(monthDay:string)=>`${isolatedYear}-${monthDay}` as `${number}-${number}-${number}`;
  let qualificationId:string;

  beforeAll(async()=>{
    // Migration 41 evidence is append-only, so shared DB runs cannot clean up old
    // calendars. Allocate years that no persisted version covers instead.
    for(let candidate=3000;candidate<9000&&!isolatedYear;candidate++){
      const from=new Date(`${candidate}-08-01T00:00:00.000Z`),to=new Date(`${candidate}-12-31T00:00:00.000Z`);
      const overlap=await db.businessCalendarVersion.findFirst({where:{effectiveFrom:{lte:to},OR:[{effectiveTo:null},{effectiveTo:{gte:from}}]}});
      if(!overlap) isolatedYear=candidate;
    }
    for(let candidate=8999;candidate>=3000&&!missingYear;candidate--){
      if(candidate===isolatedYear) continue;
      const at=new Date(`${candidate}-09-10T00:00:00.000Z`);
      const overlap=await db.businessCalendarVersion.findFirst({where:{effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gte:at}}]}});
      if(!overlap) missingYear=candidate;
    }
    if(!isolatedYear||!missingYear) throw new Error('TEST_CALENDAR_ISOLATION_YEAR_UNAVAILABLE');
    const person=await db.person.create({data:{legalName:`CALENDAR DB ${suffix}`,status:'EFFECTIVE'}});
    qualificationId=(await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date()}})).qualificationId;
    await service.createVersion({versionCode:`CAL-${suffix}`,effectiveFrom:d('09-01'),effectiveTo:d('12-31'),approvalReference:'SA-v3',dates:[
      {date:d('10-25'),businessDay:true},
      {date:d('11-10'),businessDay:true},
      {date:d('10-26'),businessDay:false,holidayReason:'Observed holiday',source:'TEST_ONLY'},
      {date:d('10-27'),businessDay:true},
    ]});
  });
  afterAll(async()=>{await db.$disconnect();});

  async function batch(name:string,settlementDate:string){
    const start=new Date(`${settlementDate}T00:00:00Z`),end=new Date(start.getTime()+1);
    const row=await db.settlementBatch.create({data:{settlementType:'REFERRAL_K0',periodStart:start,periodEnd:end,ruleVersionCode:rule(name)}});
    const award=await db.bonusAward.create({data:{settlementBatchId:row.settlementBatchId,awardType:'REFERRAL',recipientQualificationId:qualificationId,theoryAmount:'10',payableAmount:'10',activeSnapshot:true,ruleVersionCode:rule(name),occurredAt:start,pendingUntil:start,calculationDetail:{testOnly:true}}});
    return {row,award};
  }

  it('persists canonical 10th to following-month 25th evidence and preserves delayed execution',async()=>{
    const {row,award}=await batch('TENTH',d('09-10'));
    const result=await service.anchorSettlement(row.settlementBatchId,d('09-10'));
    expect(result.schedule).toMatchObject({settlementDate:d('09-10'),nominalPayoutDate:d('10-25'),adjustedPayoutDate:d('10-25')});
    const stored=await db.awardPayoutAnchor.findUniqueOrThrow({where:{bonusAwardId:award.bonusAwardId}});
    expect(stored.settlementDate.toISOString().slice(0,10)).toBe(d('09-10'));
  });

  it('persists canonical 25th to month-after-next 10th',async()=>{
    const {row}=await batch('TWENTY_FIFTH',d('09-25'));
    expect((await service.anchorSettlement(row.settlementBatchId,d('09-25'))).schedule).toMatchObject({nominalPayoutDate:d('11-10'),adjustedPayoutDate:d('11-10')});
  });

  it('moves a non-business nominal payout to the next recorded business day',async()=>{
    const holidayVersion=`HOLIDAY-${suffix}`;
    await service.createVersion({versionCode:holidayVersion,effectiveFrom:d('08-01'),effectiveTo:d('08-31'),approvalReference:'SA-v3-holiday',dates:[
      {date:d('09-25'),businessDay:false,holidayReason:'Holiday',source:'TEST_ONLY'},
      {date:d('09-26'),businessDay:false,holidayReason:'Observed holiday',source:'TEST_ONLY'},
      {date:d('09-27'),businessDay:true},
    ]});
    const {row}=await batch('HOLIDAY',d('08-10'));
    expect((await service.anchorSettlement(row.settlementBatchId,d('08-10'))).schedule.adjustedPayoutDate).toBe(d('09-27'));
  });

  it('is idempotent and readback keeps the original version after a newer calendar appears',async()=>{
    const {row,award}=await batch('REPLAY',d('09-25'));
    const first=await service.anchorSettlement(row.settlementBatchId,d('09-25'));
    const before=await db.awardPayoutAnchor.findUniqueOrThrow({where:{bonusAwardId:award.bonusAwardId}});
    await service.createVersion({versionCode:`LATER-${suffix}`,effectiveFrom:d('09-20'),effectiveTo:d('12-31'),approvalReference:'LATER_APPROVAL',dates:[
      {date:d('11-10'),businessDay:false,holidayReason:'Later calendar holiday',source:'TEST_ONLY'},
      {date:d('11-11'),businessDay:true},
    ]});
    const second=await service.anchorSettlement(row.settlementBatchId,d('09-25'));
    const after=await db.awardPayoutAnchor.findUniqueOrThrow({where:{bonusAwardId:award.bonusAwardId}});
    expect(second.schedule).toEqual(first.schedule);
    expect(after).toEqual(before);
    expect(await db.awardPayoutAnchor.count({where:{bonusAwardId:award.bonusAwardId}})).toBe(1);
  });

  it('stores calendar versions and dates as immutable evidence',async()=>{
    const version=await db.businessCalendarVersion.findUniqueOrThrow({where:{versionCode:`CAL-${suffix}`}});
    await expect(db.businessCalendarVersion.update({where:{businessCalendarVersionId:version.businessCalendarVersionId},data:{approvalReference:'TAMPERED'}})).rejects.toThrow();
    const day=await db.businessCalendarDate.findFirstOrThrow({where:{businessCalendarVersionId:version.businessCalendarVersionId}});
    await expect(db.businessCalendarDate.update({where:{businessCalendarDateId:day.businessCalendarDateId},data:{isBusinessDay:!day.isBusinessDay}})).rejects.toThrow();
  });

  it('fails closed when no approved calendar covers settlement',async()=>{
    const missingDate=`${missingYear}-09-10` as `${number}-${number}-${number}`;
    const {row}=await batch('MISSING',missingDate);
    await expect(service.anchorSettlement(row.settlementBatchId,missingDate)).rejects.toMatchObject({code:'BUSINESS_CALENDAR_VERSION_MISSING'});
    expect(await db.settlementCalendarEvidence.count({where:{settlementBatchId:row.settlementBatchId}})).toBe(0);
  });

  it('rolls back settlement evidence when payout anchor persistence fails',async()=>{
    const {row,award}=await batch('ROLLBACK',d('09-10'));
    const functionName=`calendar_anchor_fail_${award.bonusAwardId.replaceAll('-','')}`;
    await db.$executeRawUnsafe(`CREATE FUNCTION ledger.${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.bonus_award_id = '${award.bonusAwardId}'::uuid THEN RAISE EXCEPTION 'TEST_ONLY_ANCHOR_FAILURE'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER ${functionName} BEFORE INSERT ON ledger.award_payout_anchor FOR EACH ROW EXECUTE FUNCTION ledger.${functionName}()`);
    try {await expect(service.anchorSettlement(row.settlementBatchId,d('09-10'))).rejects.toThrow('TEST_ONLY_ANCHOR_FAILURE');}
    finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${functionName} ON ledger.award_payout_anchor`);
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ledger.${functionName}()`);
    }
    expect(await db.settlementCalendarEvidence.count({where:{settlementBatchId:row.settlementBatchId}})).toBe(0);
    expect(await db.awardPayoutAnchor.count({where:{bonusAwardId:award.bonusAwardId}})).toBe(0);
  });
});
