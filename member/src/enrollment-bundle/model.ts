import type {PackageProduct,PackageQuote} from '../memberData';

export const MAX_BUNDLE_BALLS = 63;
export type Pick = {productRuleProfileId:string; quantity:number};
export type PackageDraft = {
  version:string; name:string; coupon:string; quotedCoupon:string; quote?:PackageQuote; products?:PackageProduct[];
  quantities:Record<string,number>;
};
export type BallDraft = {qualification:PackageDraft; repurchase?:PackageDraft};
export type OrderedPackage = {packageVersionId:string; quoteHash:string; couponCode?:string; selections:Pick[]};
export type BundleRequest = {
  sponsorCode?:string; fulfillmentMethod?:'DELIVERY'|'COMPANY_PICKUP'; deliveryUpdatedAt?:string;
  balls:Array<{qualification:OrderedPackage; repurchase?:OrderedPackage}>;
};

export function emptyPackage(version='', name=''):PackageDraft {
  return {version,name,coupon:'',quotedCoupon:'',quantities:{}};
}
export function emptyBall():BallDraft { return {qualification:emptyPackage()}; }
export function copyBall(ball:BallDraft):BallDraft {
  const copy=(p:PackageDraft):PackageDraft=>({...p,quantities:{...p.quantities}});
  return {qualification:copy(ball.qualification),...(ball.repurchase?{repurchase:copy(ball.repurchase)}:{})};
}
export function parentPosition(position:number) { return position===1?null:Math.floor(position/2); }
export function placementLabel(position:number) {
  return position===1?'此組起點':'第 '+parentPosition(position)+' 球的'+(position%2===0?'左':'右')+'區';
}
export function quantityTotal(choice:PackageDraft) { return Object.values(choice.quantities).reduce((a,b)=>a+b,0); }
export function validPackage(choice:PackageDraft) {
  const {quote,products}=choice;
  if (!choice.version || !quote || !products || choice.coupon.trim().toUpperCase()!==choice.quotedCoupon ||
      quantityTotal(choice)!==quote.selectableProductQuantity) return false;
  return Object.entries(choice.quantities).every(([id,n])=>{
    if(n===0) return true;
    const p=products.find(x=>x.productRuleProfileId===id);
    return !!p && p.available && Number.isSafeInteger(n) && n>0 && n>=(p.minQty??1) &&
      n<=(p.maxQty??quote.selectableProductQuantity) && n%p.selectionIncrement===0;
  });
}
export function completeBall(ball:BallDraft) {
  return validPackage(ball.qualification) && (!ball.repurchase || validPackage(ball.repurchase));
}
export function quantityStep(choice:PackageDraft,p:PackageProduct,direction:1|-1) {
  const current=choice.quantities[p.productRuleProfileId]??0;
  const min=Math.ceil(Math.max(p.minQty??1,1)/p.selectionIncrement)*p.selectionIncrement;
  if (direction===-1) return Math.max(0,current-p.selectionIncrement<min?0:current-p.selectionIncrement);
  const proposed=current?current+p.selectionIncrement:min;
  const required=choice.quote?.selectableProductQuantity??0;
  if (!p.available || proposed>(p.maxQty??required) || quantityTotal(choice)-current+proposed>required) return current;
  return proposed;
}
export function money(raw:string) {
  const [integer,decimal='']=raw.split('.');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(decimal.replace(/0+$/,'')?'.'+decimal.replace(/0+$/,''):'');
}
// Keep all quoted decimal places when totaling independent orders.
export function sumAmounts(amounts:string[]) {
  if(!amounts.length) return '0';
  const parts=amounts.map(a=>{
    if(!/^\d+(\.\d{1,4})?$/.test(a)) throw Error('套組報價金額格式異常，請重新取得報價。');
    const [whole,fraction='']=a.split('.');
    return BigInt(whole)*10000n+BigInt(fraction.padEnd(4,'0'));
  });
  const total=parts.reduce((a,b)=>a+b,0n),fraction=String(total%10000n).padStart(4,'0').replace(/0+$/,'');
  return String(total/10000n)+(fraction?'.'+fraction:'');
}
export function asOrder(choice:PackageDraft):OrderedPackage {
  if(!validPackage(choice)) throw Error('請完成每顆球的套組與商品選擇。');
  return {packageVersionId:choice.version, quoteHash:choice.quote!.quoteHash,
    ...(choice.quotedCoupon?{couponCode:choice.quotedCoupon}:{}),
    selections:Object.entries(choice.quantities).filter(([,quantity])=>quantity>0)
      .sort(([a],[b])=>a.localeCompare(b)).map(([productRuleProfileId,quantity])=>({productRuleProfileId,quantity}))};
}
export function readBallCount(raw:string) {
  if(!/^\d+$/.test(raw)) return null;
  const value=Number(raw);
  return value>=2&&value<=MAX_BUNDLE_BALLS&&Number.isSafeInteger(value)?value:null;
}
