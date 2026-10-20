import {PrismaService} from '@ucell/database';
export type ShareTarget={productSku?:string;eventCode?:string};
/** Public announcement fields only; never return registration or meeting credentials. */
export async function currentShareTarget(db:PrismaService,target:ShareTarget,now:Date){
 if(target.productSku){
  if(!/^TIP-\d{3}$/.test(target.productSku))return null;
  const p=await db.productReference.findFirst({where:{sku:target.productSku,isActive:true},select:{sku:true,displayName:true,iconUrl:true,currentPrice:true,currency:true,ruleProfiles:{where:{effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]},select:{ruleVersionCode:true,parameterSnapshotHash:true}}}});
  if(!p)return null;
  const available=p.ruleProfiles.length===1&&p.ruleProfiles[0].ruleVersionCode==='R1.0B'&&/^[a-f0-9]{64}$/.test(p.ruleProfiles[0].parameterSnapshotHash??'');
  const image=p.iconUrl&&/^\/products\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(p.iconUrl)?p.iconUrl:null;
  return {kind:'PRODUCT' as const,reference:p.sku,title:p.displayName,summary:'查看目前上架商品與價格，實際金額以訂單確認為準。',thumbnailUrl:image?'https://member.ucell.life'+image:null,price:p.currentPrice.toString(),currency:p.currency,available,destination:'/shop?sku='+p.sku};
 }
 if(target.eventCode){
  if(!/^[A-Z][A-Z0-9_-]{2,39}$/.test(target.eventCode))return null;
  const e=await db.memberEvent.findUnique({where:{eventCode:target.eventCode},select:{memberEventId:true,status:true,versions:{where:{status:'PUBLISHED',approvedAt:{not:null}},orderBy:{version:'desc'},take:1,select:{title:true,description:true,audiencePolicy:true,eventType:true,startsAt:true,endsAt:true,capacity:true}}}});
  const v=e?.versions[0];if(!e||e.status!=='PUBLISHED'||!v||v.audiencePolicy!=='NETWORK_MEMBER'||v.endsAt<=now)return null;
  const count=v.capacity===null?0:await db.memberEventRegistration.count({where:{memberEventId:e.memberEventId,status:{in:['REGISTERED','CHECKED_IN','ATTENDED']}}});
  return {kind:'EVENT' as const,reference:target.eventCode,title:v.title,summary:v.description,thumbnailUrl:null,eventType:v.eventType,startsAt:v.startsAt.toISOString(),endsAt:v.endsAt.toISOString(),registrationStatus:v.startsAt<=now?'STARTED':v.capacity!==null&&count>=v.capacity?'FULL':'OPEN',destination:'/events?event='+encodeURIComponent(target.eventCode)};
 }
 return null;
}
