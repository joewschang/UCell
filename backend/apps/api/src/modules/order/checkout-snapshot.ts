import {ConflictException,UnprocessableEntityException} from '@nestjs/common';
import {Prisma} from '@ucell/database';
export type CheckoutInput={paymentMethod:'BANK_TRANSFER'|'CASH';deliveryUpdatedAt:string;expectedTotal:string};
export async function resolveCheckoutSnapshot(tx:Prisma.TransactionClient,personId:string,input:CheckoutInput|undefined,total:Prisma.Decimal){
 if(!input)return undefined;
 if(!['BANK_TRANSFER','CASH'].includes(input.paymentMethod)||!/^\d+(\.\d{1,2})?$/.test(input.expectedTotal)||!Number.isFinite(Date.parse(input.deliveryUpdatedAt)))throw new UnprocessableEntityException({code:'CHECKOUT_INVALID',message:'請確認付款方式、商品金額與配送資料。'});
 if(!total.equals(input.expectedTotal))throw new ConflictException({code:'CHECKOUT_PRICE_CHANGED',message:'商品價格已更新，請重新整理商品清單並確認金額後再結帳。'});
 await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${personId},0))) AS lock_row`;
 const profile=await tx.deliveryProfile.findFirst({where:{personId,effectiveTo:null},orderBy:{effectiveFrom:'desc'}});
 if(!profile)throw new UnprocessableEntityException({code:'DELIVERY_PROFILE_REQUIRED',message:'請先儲存完整配送資料。'});
 if(profile.effectiveFrom.getTime()!==Date.parse(input.deliveryUpdatedAt))throw new ConflictException({code:'CHECKOUT_ADDRESS_CHANGED',message:'配送資料已變更，請重新載入並確認地址後再建立訂單。'});
 return {version:1,paymentMethod:input.paymentMethod,deliveryProfileId:profile.deliveryProfileId,deliveryUpdatedAt:profile.effectiveFrom.toISOString(),confirmedAt:new Date().toISOString()};
}
