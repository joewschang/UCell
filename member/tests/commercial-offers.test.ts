import {expect,it,vi} from 'vitest';
import {getCommercialOffers} from '../src/memberData';
import {memberApi} from '../src/memberApi';
vi.mock('../src/memberApi',()=>({memberApi:vi.fn()}));
const offer={offeringCode:'STAGE_CORE_TIP_363',offeringTypeLabel:'主商品',composition:[],selectionRule:{eligibleSkus:['TIP-363'],requiredTotalQuantity:1},recognitionProfile:{displayName:'TIP-363 晶萃源力飲',coverImage:'/products/tip-363.png',packaging:'封面包裝標示：10 瓶',priceLabel:'Stage 測試價；正式售價待確認'}};
it('preserves approved catalog display fields and the SKU selection rule',async()=>{
 vi.mocked(memberApi).mockResolvedValue([offer]);
 const rows=await getCommercialOffers(new AbortController().signal);
 expect(rows[0]).toMatchObject({displayName:offer.recognitionProfile.displayName,coverImage:'/products/tip-363.png',priceLabel:offer.recognitionProfile.priceLabel,selectionRule:{eligibleSkus:['TIP-363']}});
});
it('does not embed external or malformed images supplied by catalog metadata',async()=>{
 vi.mocked(memberApi).mockResolvedValue([{...offer,recognitionProfile:{...offer.recognitionProfile,coverImage:'https://untrusted.invalid/tracking.png'}}]);
 expect((await getCommercialOffers(new AbortController().signal))[0].coverImage).toBeUndefined();
});
