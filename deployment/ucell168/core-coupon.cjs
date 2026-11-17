'use strict';
const {UnprocessableEntityException}=require('@nestjs/common');
const {Prisma}=require('@ucell/database');
const code='UCELL168', rule='CORE_BUY3_PAY2_V1';
function reject(message){throw new UnprocessableEntityException({code:'CORE_COUPON_INVALID',message});}
async function eligible(tx, qualificationId, at, submitted){
  if(submitted!==code) reject('主商品優惠碼無效。');
  const offer=await tx.couponDefinition.findUnique({where:{code}});
  if(!offer||!offer.enabled||offer.ruleCode!==rule||at<offer.startsAt||at>=offer.endsAt) reject('優惠碼未啟用或不在活動期間。');
  const active=await tx.activePeriod.findFirst({where:{qualificationId,activeFrom:{lte:at},OR:[{activeTo:null},{activeTo:{gt:at}}]},select:{qualificationId:true}});
  if(!active) reject('請選擇目前活躍的正式會員資格球。');
  return offer;
}
function price(lines,gross){
  if(!lines.length||lines.some(l=>l.commercialOfferingSnapshot?.offeringType!=='CORE_PRODUCT'||!l.quantity.isInteger()||l.quantity.lte(0)||l.unitPrice.lte(0)))reject('此優惠限商城主商品。');
  const units=lines.reduce((s,l)=>s+l.quantity.toNumber(),0),free=Math.floor(units/3);
  if(!free)reject('任選至少三盒主商品才能使用此優惠碼。');
  let remaining=free,discount=new Prisma.Decimal(0);
  for(const line of [...lines].sort((a,b)=>a.unitPrice.cmp(b.unitPrice)||a.skuSnapshot.localeCompare(b.skuSnapshot))){
    const qty=Math.min(remaining,line.quantity.toNumber()),amount=line.unitPrice.mul(qty);
    remaining-=qty;discount=discount.add(amount);
    line.lineAmount=line.lineAmount.sub(amount);
    line.gpvAmountSnapshot=line.lineAmount.mul(line.gpvRateSnapshot);
    line.ruleProfileSnapshot={...line.ruleProfileSnapshot,coreCoupon:{code,freeQuantity:qty,discount:amount.toFixed(2),netPaid:line.lineAmount.toFixed(2)}};
  }
  return {couponCode:code,ruleCode:rule,quantity:units,freeQuantity:free,grossAmount:gross.toFixed(2),discountAmount:discount.toFixed(2),total:gross.sub(discount).toFixed(2)};
}
async function quote(service,personId,dto){
  if(!dto.qualificationId||dto.packageVersionId||dto.commercialOfferingCode||!dto.items?.length)reject('請選擇正式會員資格球及主商品。');
  return service.prisma.$transaction(async tx=>{
    const {QualificationAccessService}=require('../auth/qualification-access.service');
    await new QualificationAccessService(tx).assertHolder(personId,dto.qualificationId);
    const at=new Date();
    const ball=await tx.qualification.findUnique({where:{qualificationId:dto.qualificationId}});
    if(ball?.status!=='EFFECTIVE'||ball.kind==='COMPANY_BOOTSTRAP')reject('此優惠限已生效的正式會員資格。');
    await eligible(tx,dto.qualificationId,at,dto.couponCode);
    const products=await tx.productReference.findMany({where:{productId:{in:dto.items.map(i=>i.productId)},isActive:true}});
    const lines=[];let gross=new Prisma.Decimal(0);
    for(const item of dto.items){
      const p=products.find(p=>p.productId===item.productId),quantity=new Prisma.Decimal(item.quantity);
      if(!p||!quantity.isInteger()||quantity.lte(0)||quantity.gt(99)||p.currency!=='TWD')reject('請重新確認商品與盒數。');
      const offering=await service.lineOffering(tx,item,p,null,'WEB_MEMBER',at);
      const lineAmount=p.currentPrice.mul(quantity);gross=gross.add(lineAmount);
      lines.push({skuSnapshot:p.sku,commercialOfferingSnapshot:offering,quantity,unitPrice:p.currentPrice,lineAmount,gpvRateSnapshot:0});
    }
    return price(lines,gross);
  });
}
module.exports={code,rule,reject,eligible,price,quote};

