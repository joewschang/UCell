import {describe,expect,it} from 'vitest';
import {asOrder,completeBall,emptyPackage,money,parentPosition,placementLabel,quantityStep,readBallCount,sumAmounts,validPackage} from '../src/enrollment-bundle/model';
import type {PackageProduct,PackageQuote} from '../src/memberData';

const product={productRuleProfileId:'item',available:true,minQty:3,maxQty:8,selectionIncrement:2} as PackageProduct;
const makePackage=(quantity:number)=>({...emptyPackage('version','資格'),products:[product],quantities:{item:quantity},
  quote:{quoteHash:'verified',selectableProductQuantity:6,total:'5400'} as PackageQuote});

describe('multi-ball enrollment',()=>{
  it('keeps the root external and fills incomplete levels from left to right',()=>{
    expect(Array.from({length:7},(_,i)=>parentPosition(i+1))).toEqual([null,1,1,2,2,3,3]);
    expect(placementLabel(6)).toBe('第 3 球的左區');
    expect(placementLabel(7)).toBe('第 3 球的右區');
    expect(parentPosition(63)).toBe(31);
  });
  it('accepts two through six whole levels and rejects single-shop, partial number, negatives and oversized inputs',()=>{
    expect(readBallCount('2')).toBe(2);expect(readBallCount('63')).toBe(63);
    for(const value of ['','1','0','64','2.0','3a','-2'])expect(readBallCount(value)).toBeNull();
  });
  it('selects valid batches and refuses incomplete or unavailable products, including reserved packages',()=>{
    const initial=makePackage(0);
    expect(quantityStep(initial,product,+1)).toBe(4);
    expect(quantityStep(makePackage(4),product,-1)).toBe(0);
    expect(quantityStep(makePackage(6),product,+1)).toBe(6);
    expect(validPackage(makePackage(5))).toBe(false);
    expect(completeBall({qualification:makePackage(6)})).toBe(true);
    expect(completeBall({qualification:makePackage(6),repurchase:makePackage(4)})).toBe(false);
    expect(validPackage({...makePackage(6),products:[{...product,available:false}]})).toBe(false);
  });
  it('requires a fresh coupon quote and sends only the verified quote and selected product IDs',()=>{
    expect(validPackage({...makePackage(6),coupon:'TRY'})).toBe(false);
    const choice={...makePackage(6),coupon:'TRY',quotedCoupon:'TRY'};
    expect(asOrder(choice)).toEqual({packageVersionId:'version',quoteHash:'verified',couponCode:'TRY',selections:[{productRuleProfileId:'item',quantity:6}]});
  });
  it('adds quoted amounts exactly and keeps future repurchases out of the current balance',()=>{
    expect(sumAmounts(['4800.534','0.4660','600'])).toBe('5401');
    expect(money(sumAmounts(['5400','5400','5400']))).toBe('16,200');
    expect(sumAmounts([])).toBe('0');
  });
});
