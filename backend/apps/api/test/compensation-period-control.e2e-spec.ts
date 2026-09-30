import {BadRequestException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {CompensationPeriodControlController} from '../src/modules/settlement-jobs/compensation-period-control.controller';
import {CompensationPeriodControlService} from '../src/modules/settlement-jobs/compensation-period-control.service';
jest.mock('../src/modules/settlement-jobs/compensation-volume-evidence',()=>({compensationVolumeEvidence:async()=>({ready:true,counts:{GPV:0,RPV:0,EPV:0},invalid:{GPV:0,RPV:0,EPV:0},lateOriginals:0})}));
jest.mock('../src/modules/settlement-jobs/compensation-period-evidence',()=>({compensationPeriodEvidence:async(tx:any,period:any)=>{
 const kinds=['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL','WELFARE','PAYABLE_PREPARATION'],jobs=await tx.periodCloseJob.findMany();
 const required=kinds.map(kind=>({kind,...period})),missing=required.filter(row=>!jobs.some((job:any)=>job.kind===row.kind));
 return {configured:true,required,jobs:jobs.map((job:any)=>({...period,...job})),missing,problems:[],sealed:new Set(jobs.filter((job:any)=>job.receipt).map((job:any)=>job.periodCloseJobId)),allComplete:missing.length===0&&jobs.every((job:any)=>job.receipt&&job.outbox.processStatus==='PROCESSED'),inputSealedAt:jobs.find((job:any)=>job.kind==='REFERRAL_K0')?.receipt?.completedAt??null,sourcePeriod:{...period,settlementSourceIds:[],globalSourceIds:[]}};
}}));

jest.mock('../src/modules/admin-operations/company-reservoir-invariants',()=>({companyReservoirCandidates:async()=>[]}));
import {createFinanceReviewArtifact} from '../src/modules/admin-operations/payout-review-artifact';
const d=(value:string|number)=>new Prisma.Decimal(value),uuid='11111111-1111-4111-8111-111111111111';
function fixture(){
 const jobs=['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL','WELFARE','PAYABLE_PREPARATION'].map((kind,index)=>({periodCloseJobId:`00000000-0000-4000-8000-00000000000${index}`,kind,outbox:{processStatus:'PROCESSED',attemptCount:1,lastError:null},receipt:{completedAt:new Date('2026-09-09Z')}}));
 const source={bonusAwardId:uuid,recipientQualificationId:uuid,awardType:'REFERRAL',theoryAmount:d(100),payableAmount:d(80),pendingUntil:new Date('2026-01-01Z'),economicDestination:null,lifecycleEvents:[{status:'EFFECTIVE'}]};
 const payable={payableEntryId:uuid,sourceType:'BONUS_AWARD',sourceId:uuid,qualificationId:uuid,grossAmount:d(80),ruleVersionCode:'R1.0B',status:'PAID',payoutLineId:uuid};
 const periodStart=new Date('2026-09-01Z'),periodEnd=new Date('2026-09-08Z');
 const exportArtifact={payoutExportArtifactId:uuid,payoutBatchId:uuid,revision:1,exportReference:'BANK-1',generatedAt:new Date(),...createFinanceReviewArtifact({schemaVersion:1,format:'GENERIC_FINANCE_CSV_V1',exportRevision:1,payoutBatchId:uuid,periodStart:periodStart.toISOString(),periodEnd:periodEnd.toISOString(),totalGross:'80',totalRecovery:'10',totalNet:'70',lines:[{payoutLineId:uuid,memberNo:null,ballNo:null,grossAmount:'80',recoveryOffset:'10',netAmount:'70'}]},'BANK-1')};
 const batch={payoutBatchId:uuid,periodStart,periodEnd,status:'PAID',totalGross:d(80),totalRecovery:d(10),totalNet:d(70),approvals:[{stage:'FINANCE_REVIEW',decision:'APPROVED',actorId:'finance'},{stage:'COMPLIANCE_REVIEW',decision:'APPROVED',actorId:'compliance'}],exportArtifacts:[exportArtifact],lines:[{payoutLineId:uuid,recipientQualificationId:uuid,grossAmount:d(80),recoveryOffset:d(10),netAmount:d(70),payableEntries:[payable],recoveryApplications:[{amount:d(10)}]}],paymentResults:[{payoutLineId:uuid,resultStatus:'PAID',paidAmount:d(70),occurredAt:new Date()}]};
 const tx:any={
  outboxEvent:{count:jest.fn().mockResolvedValue(0)},monthlyRecognitionSchedule:{count:jest.fn().mockResolvedValue(0)},periodCloseJob:{findMany:jest.fn().mockResolvedValue(jobs)},
  settlementBatch:{findMany:jest.fn().mockResolvedValue([{settlementBatchId:uuid,settlementType:'REFERRAL_K0',status:'FINALIZED',totalTheory:d(100),poolAvailable:d(80),kFactor:d('.8'),finalizedAt:new Date('2026-09-09Z')}])},
  bonusAward:{findMany:jest.fn().mockResolvedValue([source])},rpvUplineAwardEvent:{findMany:jest.fn().mockResolvedValue([])},globalPoolAward:{findMany:jest.fn().mockResolvedValue([])},entitlementReplayPosting:{findMany:jest.fn().mockResolvedValue([])},
  payableEntry:{findMany:jest.fn().mockResolvedValue([payable])},bonusRecoveryEvent:{findMany:jest.fn().mockResolvedValue([{bonusRecoveryEventId:uuid,recoveryAmount:d(10),recoveredAmount:d(10),outstandingAmount:d(0),applications:[{amount:d(10)}]}])},
  reservoirLedgerEffect:{aggregate:jest.fn().mockResolvedValue({_count:1,_sum:{amount:d(5)}})},payoutBatch:{findMany:jest.fn().mockResolvedValue([batch])},operationalException:{findMany:jest.fn().mockResolvedValue([])},fulfillmentErpHandoff:{count:jest.fn().mockResolvedValue(0)},
 };
 return {tx,source,payable,db:{$transaction:jest.fn((work:any)=>work(tx))}};
}
describe('COMPENSATION_PERIOD_CONTROL',()=>{
 it('does not let a paid payout override a blocking close job',async()=>{
  const {db,tx}=fixture();tx.periodCloseJob.findMany.mockResolvedValue([{periodCloseJobId:uuid,kind:'REFERRAL_K0',outbox:{processStatus:'DEAD',attemptCount:10,lastError:'PERIOD_CLOSE_EXECUTION_FAILED'},receipt:null}]);
  expect((await new CompensationPeriodControlService(db as any).read({periodStart:'2026-09-01Z',periodEnd:'2026-09-08Z',ruleVersionCode:'R1.0B'})).lifecycle).toBe('BLOCKED');
 });
 it.each(['missingJobs','pendingAwards','openPayables'])('does not financially close paid payouts with %s',async condition=>{
  const {db,tx,source,payable}=fixture();
  if(condition==='missingJobs')tx.periodCloseJob.findMany.mockResolvedValue([]);
  if(condition==='pendingAwards')source.pendingUntil=new Date('2999-01-01Z');
  if(condition==='openPayables')payable.status='OPEN';
  expect((await new CompensationPeriodControlService(db as any).read({periodStart:'2026-09-01Z',periodEnd:'2026-09-08Z',ruleVersionCode:'R1.0B'})).lifecycle).not.toBe('FINANCIALLY_RECONCILED');
 });
 it('counts cumulative payment confirmations once per line',async()=>{
  const {db,tx}=fixture(),rows=await tx.payoutBatch.findMany();
  rows[0].paymentResults=[{payoutLineId:uuid,resultStatus:'PAID',paidAmount:d(40),occurredAt:new Date('2026-09-10Z')},{payoutLineId:uuid,resultStatus:'PAID',paidAmount:d(70),occurredAt:new Date('2026-09-11Z')}];
  const result=await new CompensationPeriodControlService(db as any).read({periodStart:'2026-09-01Z',periodEnd:'2026-09-08Z',ruleVersionCode:'R1.0B'});
  expect(result.amountBridge.bankPaid).toBe('70.0000');
 });
 it.each([{paymentResults:[]},{paymentResults:[{payoutLineId:uuid,resultStatus:'PAID',paidAmount:d(40),occurredAt:new Date()}]}])('requires bank evidence matching net even when the batch is marked PAID',async({paymentResults})=>{
  const {db,tx}=fixture(),rows=await tx.payoutBatch.findMany();rows[0].paymentResults=paymentResults;
  expect((await new CompensationPeriodControlService(db as any).read({periodStart:'2026-09-01Z',periodEnd:'2026-09-08Z',ruleVersionCode:'R1.0B'})).lifecycle).toBe('BLOCKED');
 });
 it('allows only Finance and Compliance read roles',()=>{expect(Reflect.getMetadata('roles',CompensationPeriodControlController)).toEqual(['SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT']);});
 it('derives a member-economic lifecycle while keeping ERP accounting separate',async()=>{const {db}=fixture(),result=await new CompensationPeriodControlService(db as any).read({periodStart:'2026-09-01T00:00:00Z',periodEnd:'2026-09-08T00:00:00Z',ruleVersionCode:'R1.0B'}),serialized=JSON.stringify(result);expect(result.lifecycle).toBe('FINANCIALLY_RECONCILED');expect(result.amountBridge).toMatchObject({grossTheory:'100.0000',awardAfterEligibilityAndK:'80.0000',companyReservoirB:'5.0000',recoveryRequired:'10.0000',payoutNet:'70.0000',bankPaid:'70.0000',erpAccountingProjection:null});expect(result.checkpoints.find(row=>row.code==='ERP_ACCOUNTING')).toMatchObject({status:'BLOCKED_EXTERNAL'});expect(result.authority.hardClose).toBe('Not persisted by this read model');expect(serialized).not.toContain(uuid);});
 it('surfaces failed governed jobs as blocking without inventing a close',async()=>{const {db,tx}=fixture();tx.periodCloseJob.findMany.mockResolvedValue([{periodCloseJobId:uuid,kind:'REFERRAL_K0',outbox:{processStatus:'DEAD',attemptCount:10,lastError:'PERIOD_CLOSE_EXECUTION_FAILED'},receipt:null}]);tx.payoutBatch.findMany.mockResolvedValue([]);const result=await new CompensationPeriodControlService(db as any).read({periodStart:'2026-09-01T00:00:00Z',periodEnd:'2026-09-08T00:00:00Z',ruleVersionCode:'R1.0B'});expect(result.lifecycle).toBe('BLOCKED');expect(result.blockingExceptions[0]).toMatchObject({code:'PERIOD_CLOSE_EXECUTION_FAILED',status:'OPEN'});expect(result.blockingExceptions[0].reference).not.toContain(uuid);});
 it('does not expose raw Worker error text through the control read',async()=>{const {db,tx}=fixture();tx.periodCloseJob.findMany.mockResolvedValue([{periodCloseJobId:uuid,kind:'GLOBAL',outbox:{processStatus:'DEAD',attemptCount:2,lastError:'connection failed for member@example.test with token secret'},receipt:null}]);tx.payoutBatch.findMany.mockResolvedValue([]);const result=await new CompensationPeriodControlService(db as any).read({periodStart:'2026-09-01T00:00:00Z',periodEnd:'2026-09-08T00:00:00Z',ruleVersionCode:'R1.0B'});expect(result.jobs[0].blockingCode).toBe('PERIOD_CLOSE_FAILED');expect(result.blockingExceptions[0].code).toBe('PERIOD_CLOSE_FAILED');expect(JSON.stringify(result)).not.toContain('member@example.test');});
 it('does not call unstarted immutable requests a Soft Close',async()=>{const {db,tx}=fixture();tx.periodCloseJob.findMany.mockResolvedValue(['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL','WELFARE','PAYABLE_PREPARATION'].map((kind,index)=>({periodCloseJobId:`00000000-0000-4000-8000-00000000000${index}`,kind,outbox:{processStatus:'PENDING',attemptCount:0,lastError:null},receipt:null})));tx.payoutBatch.findMany.mockResolvedValue([]);const result=await new CompensationPeriodControlService(db as any).read({periodStart:'2026-09-01T00:00:00Z',periodEnd:'2026-09-08T00:00:00Z',ruleVersionCode:'R1.0B'});expect(result.lifecycle).toBe('READY_TO_CLOSE');expect(result.checkpoints.find(row=>row.code==='SOFT_CLOSE')).toMatchObject({status:'PENDING'});expect(result.checkpoints.find(row=>row.code==='HISTORICAL_CORRECTION')).toMatchObject({status:'PASS'});});
 it('uses an explicit bounded operational threshold for aggregate aging evidence',async()=>{const db={$queryRaw:jest.fn().mockResolvedValue([{category:'RECOVERY_OUTSTANDING',item_count:2n,amount:d(45),oldest_at:new Date('2026-09-01T00:00:00Z')}])};const result=await new CompensationPeriodControlService(db as any).aging({thresholdHours:24,asOf:'2026-09-10T00:00:00Z'});expect(result.thresholdHours).toBe(24);expect(result.cutoff).toBe('2026-09-09T00:00:00.000Z');expect(result.items).toHaveLength(6);expect(result.items.find(row=>row.category==='RECOVERY_OUTSTANDING')).toEqual({category:'RECOVERY_OUTSTANDING',count:2,amount:'45.0000',oldestAt:'2026-09-01T00:00:00.000Z',status:'ATTENTION'});expect(result.items.find(row=>row.category==='BANK_TRANSFER_FAILED')?.status).toBe('CLEAR');expect(result.authority.threshold).toContain('Operator-supplied');});
 it('rejects missing, out-of-range or invalid aging controls',async()=>{const service=new CompensationPeriodControlService({} as any);await expect(service.aging({thresholdHours:0})).rejects.toBeInstanceOf(BadRequestException);await expect(service.aging({thresholdHours:8761})).rejects.toBeInstanceOf(BadRequestException);await expect(service.aging({thresholdHours:24,asOf:'invalid'})).rejects.toBeInstanceOf(BadRequestException);});
 it('fails closed for an invalid range or rule',async()=>{const service=new CompensationPeriodControlService({} as any);await expect(service.read({periodStart:'bad',periodEnd:'2026-09-08Z',ruleVersionCode:'R1'})).rejects.toBeInstanceOf(BadRequestException);await expect(service.read({periodStart:'2026-09-08Z',periodEnd:'2026-09-01Z',ruleVersionCode:'R1'})).rejects.toBeInstanceOf(BadRequestException);await expect(service.read({periodStart:'2026-09-01Z',periodEnd:'2026-09-08Z',ruleVersionCode:''})).rejects.toBeInstanceOf(BadRequestException);});
});
