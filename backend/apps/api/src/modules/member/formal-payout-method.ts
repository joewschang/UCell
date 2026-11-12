import { PiiCryptoService } from '../../common/security/pii-crypto.service';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';

type Reader = Prisma.TransactionClient | PrismaService;
export type PayoutMethod = 'BANK_TRANSFER' | 'COMPANY_CASH';
const editableStates = ['DRAFT','SUBMITTED','NEEDS_MORE_INFO','UNDER_REVIEW'];

export async function payoutChoice(db:Reader, id:string) {
  const rows=await db.$queryRaw<{method:PayoutMethod;version:number;status:string}[]>`
    SELECT coalesce(p.method,'BANK_TRANSFER') AS method,coalesce(p.version,0) AS version,a.status
      FROM identity.formal_member_application a LEFT JOIN identity.formal_payout_method p
        ON p.application_id=a.formal_member_application_id
     WHERE a.formal_member_application_id=${id}::uuid`;
  if(!rows[0]) throw new NotFoundException({code:'FORMAL_APPLICATION_NOT_FOUND'});
  return {method:rows[0].method,version:rows[0].version,editable:editableStates.includes(rows[0].status)};
}

export async function lockChoice(tx:Prisma.TransactionClient,id:string) {
  await tx.$queryRaw`SELECT formal_member_application_id FROM identity.formal_member_application WHERE formal_member_application_id=${id}::uuid FOR UPDATE`;
  return payoutChoice(tx,id);
}

export async function setChoice(tx:Prisma.TransactionClient,id:string,method:PayoutMethod,actor:string){
  await tx.$executeRaw`INSERT INTO identity.formal_payout_method(application_id,method,version,changed_by)
    VALUES (${id}::uuid,${method},1,${actor}::uuid) ON CONFLICT (application_id) DO UPDATE
    SET method=excluded.method,version=identity.formal_payout_method.version+1,changed_by=excluded.changed_by,changed_at=now()`;
}

export async function saveApprovedMethod(tx:Prisma.TransactionClient,app:{formalMemberApplicationId:string;applicantType:string;legalEntityId:string|null;personId:string}){
  const entity=app.applicantType==='LEGAL_ENTITY', owner=entity?app.legalEntityId:app.personId;
  if(!owner) throw new ConflictException({code:'FORMAL_PAYOUT_HOLDER_REQUIRED'});
  const {method}=await payoutChoice(tx,app.formalMemberApplicationId);
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(20261030,211)");
  await tx.$executeRaw`INSERT INTO membership.holder_payout_method(owner_type,owner_id,method,application_id)
    VALUES (${entity?'LEGAL_ENTITY':'PERSON'},${owner}::uuid,${method},${app.formalMemberApplicationId}::uuid)
    ON CONFLICT(owner_type,owner_id) DO UPDATE SET method=excluded.method,application_id=excluded.application_id`;
}

export async function holderMethod(db:Reader,type:'PERSON'|'LEGAL_ENTITY',id:string):Promise<PayoutMethod>{
  const [choice]=await db.$queryRaw<{method:PayoutMethod}[]>`SELECT method FROM membership.holder_payout_method WHERE owner_type=${type} AND owner_id=${id}::uuid`;
  return choice?.method??'BANK_TRANSFER';
}

export function requiredEvidence<T extends string>(types:readonly T[], method:PayoutMethod):T[]{
  return types.filter(t=>method!=='COMPANY_CASH'||(t!=='BANKBOOK_COVER'&&t!=='CORPORATE_BANK_PROOF'));
}

export function bankErrors(payload:{bankCode?:string;bankAccount?:string;accountHolder?:string} | null, method:PayoutMethod){
  if(method==='COMPANY_CASH') return [];
  return (['bankCode','bankAccount','accountHolder'] as const).flatMap((key,i)=>payload?.[key]?.trim()?[]:[['FORMAL_BANK_CODE_REQUIRED','FORMAL_BANK_ACCOUNT_REQUIRED','FORMAL_ACCOUNT_HOLDER_REQUIRED'][i]]);
}

export function requireBank(payload:Parameters<typeof bankErrors>[0],method:PayoutMethod){
  const [code]=bankErrors(payload,method);
  if(code) throw new UnprocessableEntityException({code,message:'銀行匯款須填寫銀行代碼、帳號與戶名。'});
}


// Legacy bank applications were validated on every write. Only a changed choice can
// expose a snapshot saved without bank details, e.g. after switching back from cash.
export async function snapshotBankErrors(db:Reader,id:string,choice:{method:PayoutMethod;version:number}){
  if(choice.method==='COMPANY_CASH'||choice.version===0) return [];
  const snap=await db.formalMemberApplicationSnapshot.findFirst({where:{formalMemberApplicationId:id},orderBy:{version:'desc'},select:{payloadCiphertext:true,keyVersion:true}});
  return bankErrors(snap?new PiiCryptoService().decrypt<Parameters<typeof bankErrors>[0]>(snap.payloadCiphertext,snap.keyVersion):null,choice.method);
}

export async function methodFields(db:Reader,id:string){
  const c=await payoutChoice(db,id);return {payoutMethod:c.method,payoutMethodVersion:c.version};
}
