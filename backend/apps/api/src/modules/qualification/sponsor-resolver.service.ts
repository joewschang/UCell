import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';

const BALL=/^[A-Z][A-Z0-9_-]{0,39}(?:X\d{6,}|\d{6,})$/;
const ACCOUNT_BALL=/^(?:TW8888888888|TW09\d{8}|\d{10})-\d{2,19}$/;
export const SPONSOR_CODE=/^(?:[A-Z][A-Z0-9_-]{1,39}|\d{10}-\d{2,19})$/i;
/** Sole public sponsor-code resolver: Ball evidence or a governed Qualification-only Company Alias. */
@Injectable()
export class SponsorResolver {
 constructor(private readonly db:PrismaService){}
 async resolve(input:{code:string;effectiveAt?:Date;ruleVersion?:string}){
  const evidence=await this.resolveWithin(this.db,input);
  if(evidence.kind==='COMPANY_ALIAS')return {kind:evidence.kind,displayLabel:evidence.displayLabel,effectiveAt:evidence.effectiveAt,ruleVersion:evidence.ruleVersion,policyVersion:evidence.policyVersion};
  const {sponsorOwnerPersonId,...publicEvidence}=evidence; return publicEvidence;
 }
 async resolveWithin(db:Pick<PrismaService,'qualification'|'companySponsorAlias'>,input:{code:string;effectiveAt?:Date;ruleVersion?:string}):Promise<any>{
  const code=input.code?.trim().toUpperCase(),at=input.effectiveAt??new Date(),ruleVersion=input.ruleVersion??'R1.0B';
  if(!code||!SPONSOR_CODE.test(code))throw new UnprocessableEntityException({code:'SPONSOR_CODE_INVALID'});
  if(ACCOUNT_BALL.test(code)||BALL.test(code)){
   const row=await db.qualification.findFirst({where:{ballNo:code,status:'EFFECTIVE',effectiveAt:{lte:at}},select:{qualificationId:true,ballNo:true,planLevelCode:true,effectiveAt:true,kind:true,currentHolderPersonId:true,currentHolderLegalEntityId:true,currentCompanyPrincipalId:true}});
   if(!row?.ballNo||(!row.currentHolderPersonId&&!row.currentHolderLegalEntityId&&!row.currentCompanyPrincipalId)||
     (row.kind==='COMPANY_BOOTSTRAP'&&!ACCOUNT_BALL.test(code)))throw new UnprocessableEntityException({code:'SPONSOR_CODE_INELIGIBLE'});
   return {kind:'BALL',sponsorQualificationId:row.qualificationId,sponsorBallNo:row.ballNo,planLevelCode:row.planLevelCode,effectiveAt:row.effectiveAt,ruleVersion,sponsorOwnerPersonId:row.currentHolderPersonId};
  }
  if(!db.companySponsorAlias)throw new UnprocessableEntityException({code:'SPONSOR_CODE_INVALID'});
  const alias=await db.companySponsorAlias.findFirst({where:{aliasNormalized:code,effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}],targetQualification:{status:'EFFECTIVE',kind:'COMPANY_BOOTSTRAP'}},orderBy:{effectiveFrom:'desc'},select:{targetQualificationId:true,displayLabel:true,policyVersion:true,effectiveFrom:true,targetQualification:{select:{currentHolderPersonId:true}}}});
  if(!alias)throw new UnprocessableEntityException({code:'SPONSOR_CODE_INELIGIBLE'});
  return {kind:'COMPANY_ALIAS',sponsorQualificationId:alias.targetQualificationId,displayLabel:alias.displayLabel,effectiveAt:alias.effectiveFrom,ruleVersion,policyVersion:alias.policyVersion,sponsorOwnerPersonId:alias.targetQualification.currentHolderPersonId};
 }
}

export async function saveSponsorSelection(tx:Prisma.TransactionClient,input:{qualificationId:string;sponsorId:string;
  ownerId:string|null;personId:string;at:Date;policyVersion:string;correlationId:string}){
 const {qualificationId,sponsorId,ownerId,personId,at,policyVersion,correlationId}=input;
 if(ownerId)return tx.qualificationSponsorSelectionEvidence.create({data:{qualificationId,attributionReferrerQualificationId:sponsorId,
   selectedSponsorQualificationId:sponsorId,selectedSponsorOwnerPersonId:ownerId,selectedByPersonId:personId,selectedAt:at,source:'MANUAL_INPUT',policyVersion,correlationId}});
 // Legal entities and company principals own qualifications directly. Their operating representatives do not own them.
 const recorded=await tx.$executeRaw`INSERT INTO organization.qualification_sponsor_selection_evidence(
   qualification_sponsor_selection_evidence_id,qualification_id,attribution_referrer_qualification_id,selected_sponsor_qualification_id,
   selected_sponsor_owner_person_id,selected_by_person_id,selected_at,source,policy_version,correlation_id)
   SELECT gen_random_uuid(),${qualificationId}::uuid,q.qualification_id,q.qualification_id,NULL,${personId}::uuid,${at},'MANUAL_INPUT',${policyVersion},${correlationId}::uuid
   FROM membership.qualification q WHERE q.qualification_id=${sponsorId}::uuid AND q.status='EFFECTIVE' AND q.effective_at<=${at}
     AND (q.current_holder_legal_entity_id IS NOT NULL OR q.current_company_principal_id IS NOT NULL OR q.kind='COMPANY_BOOTSTRAP')`;
 if(!recorded)throw new UnprocessableEntityException({code:'SPONSOR_CODE_INELIGIBLE'});
}
