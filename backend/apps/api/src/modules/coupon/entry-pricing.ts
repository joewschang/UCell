import {ConflictException,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import {createHash} from 'node:crypto';
export const ENTRY_POLICY='PO_20261021_ENTRY_V2';
export const ENTRY_RULE='ENTRY_MINUS_14400_3_V1';
export async function quoteEntry(tx:Prisma.TransactionClient|PrismaService,v:any,code:string|undefined,personId:string,now=new Date(),lock=false){
 const entry=v.profile.packageClass==='QUALIFICATION';
 if(code&&!entry)throw new UnprocessableEntityException({code:'COUPON_CATEGORY_MISMATCH',message:'優惠碼僅適用新建會員資格套組。'});
 let coupon=null;
 if(code){
  const normalized=code.trim().toUpperCase();
  if(!/^[A-Z0-9_-]{3,40}$/.test(normalized))throw new UnprocessableEntityException({code:'COUPON_INVALID',message:'請確認優惠碼。'});
  if(lock)await tx.$queryRaw`SELECT id FROM commerce.coupon_definition WHERE code=${normalized} FOR UPDATE`;
  coupon=await tx.couponDefinition.findUnique({where:{code:normalized}});
  if(!coupon||!coupon.enabled||now<coupon.startsAt||now>=coupon.endsAt)throw new ConflictException({code:'COUPON_UNAVAILABLE',message:'優惠碼不存在、尚未開始、已停用或已到期。'});
  if(coupon.category!=='QUALIFICATION'||coupon.ruleCode!==ENTRY_RULE||!coupon.packageCodes.includes(v.profile.stableCode))throw new ConflictException({code:'COUPON_PACKAGE_MISMATCH',message:'此優惠碼不適用目前選擇的套組。'});
  const where={couponId:coupon.id,OR:[{redeemedAt:{not:null}},{expiresAt:{gt:now},order:{status:'CONFIRMED' as const}}]};
  const total=coupon.maxUses?await tx.couponRedemption.count({where}):0;
  const personal=coupon.perPersonLimit?await tx.couponRedemption.count({where:{...where,personId}}):0;
  if(coupon.maxUses&&total>=coupon.maxUses||coupon.perPersonLimit&&personal>=coupon.perPersonLimit)throw new ConflictException({code:'COUPON_LIMIT_REACHED',message:'優惠碼使用次數已達上限。'});
 }
 const discount=new Prisma.Decimal(coupon?14400:0),fee=new Prisma.Decimal(entry?600:0),goods=v.priceAmount.sub(discount),quantity=v.selectableProductQuantity-(coupon?3:0);
 const basis:Record<string,[number,number]>={STARTER:[14400,3],ELITE:[43200,9],LEADER:[72000,15]};
 if(entry&&(!basis[v.profile.stableCode]||!v.priceAmount.eq(basis[v.profile.stableCode][0])||v.selectableProductQuantity!==basis[v.profile.stableCode][1]))throw new ConflictException({code:'ENTRY_PACKAGE_CONFIGURATION_INVALID',message:'套組價格與盒數尚未完成設定，請聯絡客服。'});
 if(goods.lt(0)||quantity<0||entry&&(!['STARTER','ELITE','LEADER'].includes(v.profile.stableCode)||v.currency!=='TWD'))throw new ConflictException({code:'COUPON_CONFIGURATION_INVALID'});
 const value={packageVersionId:v.packageProfileVersionId,packageCode:v.profile.stableCode,originalAmount:v.priceAmount.toFixed(2),discountAmount:discount.toFixed(2),goodsAmount:goods.toFixed(2),qualificationFee:fee.toFixed(2),total:goods.add(fee).toFixed(2),selectableProductQuantity:quantity,couponCode:coupon?.code??null,couponId:coupon?.id??null,couponRevision:coupon?.revision??null,ruleCode:coupon?.ruleCode??null,description:coupon?.description??null,endsAt:coupon?.endsAt.toISOString()??null,recognitionPolicy:entry?ENTRY_POLICY:v.recognitionConfigRef};
 return {...value,quoteHash:createHash('sha256').update(JSON.stringify(value)).digest('hex')};
}
