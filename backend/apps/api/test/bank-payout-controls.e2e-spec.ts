import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {Prisma} from '@ucell/database';
const input={format:'BULK_REMITTANCE' as const,exportReference:'BANK-1',recipients:[{payoutLineId:'line-1',accountName:'測試會員',accountNumber:'00012345678901',bankBranchCode:'1234567'}]};
function setup(){
 const amount=new Prisma.Decimal('100.12'),zero=new Prisma.Decimal(0),at=new Date('2026-01-15T00:00:00Z');
 const entry={payableEntryId:'entry-1',payoutLineId:'line-1',qualificationId:'q-1',sourceType:'BONUS_AWARD',sourceId:'award-1',
   awardType:'REFERRAL',grossAmount:amount,status:'ALLOCATED',ruleVersionCode:'PAYOUT_TEST_FIXTURE'};
 const line={payoutLineId:'line-1',recipientQualificationId:'q-1',grossAmount:amount,recoveryOffset:zero,netAmount:amount,payableEntries:[entry],recoveryApplications:[]};
 const batch={status:'EXPORTED',periodStart:new Date('2026-01-01Z'),periodEnd:new Date('2026-02-01Z'),totalNet:amount,totalGross:amount,totalRecovery:zero,
   approvals:[{stage:'FINANCE_REVIEW',decision:'APPROVED',actorId:'finance'},{stage:'COMPLIANCE_REVIEW',decision:'APPROVED',actorId:'compliance'}],paymentResults:[],lines:[line]};
 let artifact:any=null;
 const tx={
   $queryRaw:jest.fn(),
   payoutBatch:{findUniqueOrThrow:jest.fn(async()=>batch)},
   payoutLine:{findMany:jest.fn(async()=>[line])},
   bonusAward:{findUniqueOrThrow:jest.fn(async()=>({bonusAwardId:'award-1',recipientQualificationId:'q-1',occurredAt:at,payableAmount:amount}))},
   awardEconomicDestination:{findFirst:jest.fn(async()=>null)},
   qualification:{findUniqueOrThrow:jest.fn(async()=>({currentHolderPersonId:'person-1',currentHolderLegalEntityId:null}))},
   qualificationHolderHistory:{findMany:jest.fn(async()=>[{holderPersonId:'person-1',holderLegalEntityId:null}])},
   qualificationOwnerInterval:{findMany:jest.fn(async()=>[])},
   settlementBatch:{findMany:jest.fn(async()=>[])},
   payoutExportArtifact:{findFirst:jest.fn(async():Promise<{revision:number}|null>=>null),findUnique:jest.fn(async()=>artifact),aggregate:jest.fn(async()=>({_max:{revision:1}})),create:jest.fn(async({data}:any)=>artifact=data)}
 };
 const audit={write:jest.fn()};
 const service=new AdminOperationsService({$transaction:async(fn:any)=>fn(tx)} as any,audit as any);
 return {service,tx,batch,audit};
}
it('requires Finance authorization before bank export',async()=>{const s=setup();await expect(s.service.exportBankPayout('batch',input,'member','MEMBER','r','c')).rejects.toThrow('FINANCE_ROLE_REQUIRED');expect(s.tx.$queryRaw).not.toHaveBeenCalled();});
it('does not issue a second bank submission file under a fresh reference',async()=>{const s=setup();s.tx.payoutExportArtifact.findFirst.mockResolvedValue({revision:2});await expect(s.service.exportBankPayout('batch',input,'finance','FINANCE','r','c')).rejects.toThrow('BANK_EXPORT_ALREADY_CREATED_USE_STORED_DOWNLOAD');expect(s.tx.payoutExportArtifact.create).not.toHaveBeenCalled();});
it('requires independent approvals, unpaid state and reconciled total',async()=>{for(const change of [{status:'PAID'},{paymentResults:[{}]},{totalNet:new Prisma.Decimal('101')},{approvals:[{stage:'FINANCE_REVIEW',decision:'APPROVED',actorId:'same'},{stage:'COMPLIANCE_REVIEW',decision:'APPROVED',actorId:'same'}]}]){const s=setup();Object.assign(s.batch,change);await expect(s.service.exportBankPayout('batch',input,'finance','FINANCE','r','c')).rejects.toThrow();expect(s.tx.payoutExportArtifact.create).not.toHaveBeenCalled();}});
it('stores a fixed XLS snapshot without changing payout state, audits no account data and replays exact request',async()=>{const s=setup(),first=await s.service.exportBankPayout('batch',input,'finance','FINANCE','r','c'),second=await s.service.exportBankPayout('batch',input,'finance','FINANCE','r2','c2');expect(second).toEqual(first);expect(first.revision).toBe(2);expect(s.tx.payoutExportArtifact.create).toHaveBeenCalledTimes(1);expect(s.batch.status).toBe('EXPORTED');expect(JSON.stringify(s.audit.write.mock.calls)).not.toContain(input.recipients[0].accountNumber);await expect(s.service.exportBankPayout('batch',{...input,recipients:[{...input.recipients[0],accountNumber:'00012345678902'}]},'finance','FINANCE','r3','c3')).rejects.toThrow('BANK_EXPORT_REFERENCE_CONFLICT');});
