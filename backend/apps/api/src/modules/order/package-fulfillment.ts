import {ConflictException,UnprocessableEntityException} from '@nestjs/common';
import {Prisma} from '@ucell/database';
export async function packageFulfillment(tx:Prisma.TransactionClient,personId:string,method:string|undefined,updatedAt:string|undefined,hasGoods:boolean){
 if(!hasGoods)return {version:1,method:'NONE'};
 if(!method)return undefined; // Preserve existing clients and paper orders.
 if(method==='COMPANY_PICKUP')return {version:1,method,location:'總公司',address:'台中市南屯區文心南九路89號1樓',confirmedAt:new Date().toISOString()};
 if(method!=='DELIVERY'||!updatedAt||!Number.isFinite(Date.parse(updatedAt)))throw new UnprocessableEntityException({code:'DELIVERY_PROFILE_REQUIRED',message:'請填寫完整宅配資料後再繼續。'});
 await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${personId},0))) AS lock_row`;
 const profile=await tx.deliveryProfile.findFirst({where:{personId,effectiveTo:null},orderBy:{effectiveFrom:'desc'}});
 if(!profile||profile.effectiveFrom.getTime()!==Date.parse(updatedAt))throw new ConflictException({code:'CHECKOUT_ADDRESS_CHANGED',message:'宅配資料已變更，請返回確認後重試。'});
 return {version:1,method,deliveryProfileId:profile.deliveryProfileId,deliveryUpdatedAt:updatedAt,confirmedAt:new Date().toISOString()};
}
