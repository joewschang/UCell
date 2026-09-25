import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';

/** Sole public sponsor-code resolver: ballNo or governed alias only; never memberNo/UUID/holder PII. */
@Injectable()
export class SponsorResolver {
 constructor(private readonly db:PrismaService){}
 async resolve(input:{code:string;effectiveAt?:Date;ruleVersion?:string}){
  const {sponsorOwnerPersonId,...publicEvidence}=await this.resolveWithin(this.db,input);
  return publicEvidence;
 }
 async resolveWithin(db:Pick<PrismaService,'qualification'>,input:{code:string;effectiveAt?:Date;ruleVersion?:string}){
  const code=input.code?.trim();
  if(!/^[A-Z][A-Z0-9_-]{0,39}(?:X\d{6,}|\d{6,})$/.test(code??''))throw new UnprocessableEntityException({code:'SPONSOR_CODE_INVALID'});
  const row=await db.qualification.findFirst({where:{ballNo:code,status:'EFFECTIVE',effectiveAt:{lte:input.effectiveAt??new Date()}},select:{qualificationId:true,ballNo:true,planLevelCode:true,effectiveAt:true,kind:true,currentHolderPersonId:true}});
  if(!row||!row.ballNo||!row.currentHolderPersonId)throw new UnprocessableEntityException({code:'SPONSOR_CODE_INELIGIBLE'});
  if(row.kind==='COMPANY_BOOTSTRAP')throw new UnprocessableEntityException({code:'SPONSOR_CODE_INELIGIBLE'});
  return {sponsorQualificationId:row.qualificationId,sponsorBallNo:row.ballNo,planLevelCode:row.planLevelCode,effectiveAt:row.effectiveAt,ruleVersion:input.ruleVersion??'R1.0B',sponsorOwnerPersonId:row.currentHolderPersonId};
 }
}
