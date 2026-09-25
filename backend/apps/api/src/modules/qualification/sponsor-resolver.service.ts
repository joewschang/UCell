import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';

const BALL=/^[A-Z][A-Z0-9_-]{0,39}(?:X\d{6,}|\d{6,})$/;
const ALIAS=/^[A-Z][A-Z0-9_-]{1,39}$/;
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
  if(!code||!ALIAS.test(code))throw new UnprocessableEntityException({code:'SPONSOR_CODE_INVALID'});
  if(BALL.test(code)){
   const row=await db.qualification.findFirst({where:{ballNo:code,status:'EFFECTIVE',effectiveAt:{lte:at}},select:{qualificationId:true,ballNo:true,planLevelCode:true,effectiveAt:true,kind:true,currentHolderPersonId:true}});
   if(!row||!row.ballNo||!row.currentHolderPersonId||row.kind==='COMPANY_BOOTSTRAP')throw new UnprocessableEntityException({code:'SPONSOR_CODE_INELIGIBLE'});
   return {kind:'BALL',sponsorQualificationId:row.qualificationId,sponsorBallNo:row.ballNo,planLevelCode:row.planLevelCode,effectiveAt:row.effectiveAt,ruleVersion,sponsorOwnerPersonId:row.currentHolderPersonId};
  }
  const alias=await db.companySponsorAlias.findFirst({where:{aliasNormalized:code,effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}],targetQualification:{status:'EFFECTIVE',kind:'COMPANY_BOOTSTRAP'}},orderBy:{effectiveFrom:'desc'},select:{targetQualificationId:true,displayLabel:true,policyVersion:true,effectiveFrom:true}});
  if(!alias)throw new UnprocessableEntityException({code:'SPONSOR_CODE_INELIGIBLE'});
  return {kind:'COMPANY_ALIAS',sponsorQualificationId:alias.targetQualificationId,displayLabel:alias.displayLabel,effectiveAt:alias.effectiveFrom,ruleVersion,policyVersion:alias.policyVersion};
 }
}
