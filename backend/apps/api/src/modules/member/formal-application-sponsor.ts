import {UnprocessableEntityException} from '@nestjs/common';
import {SponsorResolver} from '../qualification/sponsor-resolver.service';
export async function validateFormalSponsor(db:any,personId:string,value:unknown){
 const code=typeof value==='string'?value.trim().toUpperCase():'';
 if(!code)throw new UnprocessableEntityException({code:'FORMAL_SPONSOR_BALL_REQUIRED'});
 if(!/^[A-Z][A-Z0-9_-]{0,39}(?:X\d{6,}|\d{6,})$/.test(code))throw new UnprocessableEntityException({code:'FORMAL_SPONSOR_BALL_INVALID'});
 // Application review may refer to a company-owned Ball. This does not grant
 // a personal sponsor relationship, placement, or bonus entitlement.
 const company=await db.qualification.findUnique({where:{ballNo:code},select:{qualificationId:true,ballNo:true,kind:true,status:true,effectiveAt:true,currentCompanyPrincipalId:true,currentCompanyPrincipal:{select:{status:true}},binaryTreeMembership:{select:{binaryTree:{select:{status:true,companyPrincipalId:true}}}}}});
 if(company?.kind==='COMPANY_BOOTSTRAP'){
  const tree=company.binaryTreeMembership?.binaryTree;
  if(company.status!=='EFFECTIVE'||!company.effectiveAt||new Date(company.effectiveAt)>new Date()||!company.currentCompanyPrincipalId||company.currentCompanyPrincipal?.status!=='ACTIVE'||tree?.status!=='ACTIVE'||tree.companyPrincipalId!==company.currentCompanyPrincipalId)throw new UnprocessableEntityException({code:'SPONSOR_CODE_INELIGIBLE'});
  return {kind:'BALL',sponsorQualificationId:company.qualificationId,sponsorBallNo:company.ballNo,sponsorOwnerPersonId:null};
 }
 const evidence=await new SponsorResolver(db).resolveWithin(db,{code});
 if(evidence.kind!=='BALL'||evidence.sponsorOwnerPersonId===personId)throw new UnprocessableEntityException({code:'FORMAL_SPONSOR_BALL_INVALID'});
 return evidence;
}
