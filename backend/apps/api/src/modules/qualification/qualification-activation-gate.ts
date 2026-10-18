import {ConflictException} from '@nestjs/common';
import {Prisma} from '@ucell/database';
/** A paid reservation becomes an operating qualification only after formal approval. */
export async function assertQualificationActivation(tx:Prisma.TransactionClient,setup:{qualificationId:string;ownerPersonId:string|null;ownerLegalEntityId:string|null;qualifyingOrderId:string}){
 const owner=setup.ownerPersonId?await tx.person.findUnique({where:{personId:setup.ownerPersonId},select:{membershipState:true}}):setup.ownerLegalEntityId?await tx.legalEntity.findUnique({where:{legalEntityId:setup.ownerLegalEntityId},select:{membershipState:true}}):null;
 if(owner?.membershipState!=='FORMAL_MEMBER')throw new ConflictException({code:'FORMAL_MEMBERSHIP_APPROVAL_REQUIRED',message:'請先完成正式會員審核，再進行球位安置。'});
 const payment=await tx.order.findUnique({where:{orderId:setup.qualifyingOrderId},select:{status:true,qualificationId:true}});
 if(payment?.status!=='PAID'||payment.qualificationId!==setup.qualificationId)throw new ConflictException({code:'QUALIFICATION_PAYMENT_REQUIRED',message:'資格套組尚未確認付款，無法啟用球位。'});
}
