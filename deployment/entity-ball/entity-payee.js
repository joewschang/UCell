'use strict';
const {BadRequestException,ConflictException}=require('@nestjs/common');
const {randomUUID}=require('node:crypto');
function fail(message){throw new BadRequestException(message);}
async function lookup(db,memberNo){
  const entity=await db.legalEntity.findUnique({where:{memberNo},select:{legalEntityId:true,memberNo:true,registeredName:true,registrationNo:true,status:true,membershipState:true}});
  if(!entity)return null;
  if(await db.person.count({where:{memberNo}}))throw new ConflictException('會員編號對應多位持有人，請先核對資料');
  if(entity.status!=='ACTIVE'||entity.membershipState!=='FORMAL_MEMBER')fail('法人尚未生效');
  return entity;
}
async function profile(db,id){
  const [row]=await db.$queryRaw`SELECT payload FROM ledger.nhi_payout_entity_profile WHERE legal_entity_id=${id}::uuid`;
  return row?.payload??null;
}
async function staged(db,id){
  const [row]=await db.$queryRaw`SELECT bank,version FROM membership.holder_remittance_account WHERE owner_type='LEGAL_ENTITY' AND owner_id=${id}::uuid`;
  return row;
}
async function view(service,e){
  const p=await profile(service.db,e.legalEntityId);
  const candidate=!p&&await staged(service.db,e.legalEntityId);
  const bank=candidate&&service.pii.decrypt(candidate.bank.ciphertext,candidate.bank.keyVersion);
  return {legalEntityId:e.legalEntityId,memberNo:e.memberNo,legalName:e.registeredName,profile:service.safeProfile(p),stagedBank:bank?{version:candidate.version,lastFour:bank.accountNumber.slice(-4)}:null};
}
async function save(service,memberNo,b,u,validDay){
  return service.db.$transaction(async tx=>{
    await service.lock(tx);
    const e=await lookup(tx,memberNo);
    if(!e)throw new ConflictException('法人資料已變更');
    const id=e.legalEntityId;
    if(!validDay(b.validFrom)||!validDay(b.validTo)||b.validFrom>b.validTo)fail('請確認適用期間');
    if(b.treatment!=='NOT_APPLICABLE'||!b.evidence?.trim()||b.evidence.length>500||!b.reason?.trim()||b.reason.length>500)fail('法人請由財務覆核非個人所得的適用方式，填寫理由與憑證依據');
    if(b.identityNumber?.trim()!==e.registrationNo||b.legalName?.trim()!==e.registeredName)fail('統編及所得人名稱須與法人登記資料一致');
    const current=await profile(tx,id);
    if(b.expectedVersion!==undefined && (current?.version??null)!==b.expectedVersion)throw new ConflictException('收款資料已更新，請重新查詢');
    const candidate=await staged(tx,id);
    if((b.useStagedBank||b.stagedVersion!==undefined)&&(candidate?.version??null)!==b.stagedVersion)throw new ConflictException('匯款資料已變更，請重新查詢');
    if(b.useStagedBank&&!candidate)fail('尚無待核對的匯款帳戶');
    const details=b.useStagedBank?service.pii.decrypt(candidate.bank.ciphertext,candidate.bank.keyVersion):b;
    if(!/^\d{7}$/.test(details.bankBranchCode)||!/^\d{6,16}$/.test(details.accountNumber)||details.accountName?.trim()!==e.registeredName)fail('請核對七碼銀行分行、帳號及法人登記戶名');
    const bank=service.pii.encrypt({bankBranchCode:details.bankBranchCode,accountNumber:details.accountNumber,accountName:e.registeredName});
    const identity=service.pii.encrypt({number:e.registrationNo,name:e.registeredName});
    const payload={version:randomUUID(),legalEntityId:id,memberNo,legalName:e.registeredName,identity,bank,identityKey:service.identityKey('LEGAL_ENTITY:'+e.registrationNo),idLast:e.registrationNo.slice(-4),accountLast:details.accountNumber.slice(-4),treatment:b.treatment,exemptionKind:null,validFrom:b.validFrom,validTo:b.validTo,evidence:b.evidence,reason:b.reason,reviewedBy:u.personId,reviewedAt:new Date().toISOString()};
    await tx.$executeRaw`INSERT INTO ledger.nhi_payout_entity_profile(legal_entity_id,payload,updated_by) VALUES(${id}::uuid,${JSON.stringify(payload)}::jsonb,${u.personId}::uuid) ON CONFLICT(legal_entity_id) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=now()`;
    await tx.$executeRaw`DELETE FROM membership.holder_remittance_account WHERE owner_type='LEGAL_ENTITY' AND owner_id=${id}::uuid`;
    await service.event(tx,null,'PROFILE_REVIEWED',u.personId,{legalEntityId:id,version:payload.version});
    return service.safeProfile(payload);
  });
}
async function changedOwner(tx,group){
 const ids=[...new Set(group.lines.map(l=>l.qualificationId))];
 const holder=group.legalEntityId?{kind:'MEMBER_ORIGIN',currentHolderLegalEntityId:group.legalEntityId}:{currentHolderPersonId:group.personId};
 const matched=await tx.qualification.count({where:{qualificationId:{in:ids},...holder}});
 return matched!==ids.length;
}
module.exports={lookup,profile,view,save,changedOwner};
