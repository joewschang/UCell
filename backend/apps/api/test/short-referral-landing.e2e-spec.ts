import {ReferralAttributionService} from '../src/modules/member/referral-attribution.service';
it('records a short-link visit against the original canonical referral link',async()=>{
 const now=new Date(),expires=new Date(now.getTime()+86400000),short='s_'+'a'.repeat(22),legacy='encrypted-original';
 const links={resolveToken:jest.fn(async()=>legacy),preview:jest.fn(async()=>({destination:'/shop?sku=TIP-363'})),verify:jest.fn(()=>({qualificationId:'q'})),hash:jest.fn((t:string)=>'hash:'+t),createTransition:jest.fn(()=>'transition')};
 const tx:any={$queryRaw:jest.fn(),referralLink:{findUnique:jest.fn(async()=>({referralLinkId:'link',referrerQualificationId:'q',status:'ACTIVE',expiresAt:expires}))},referralAttribution:{findUnique:jest.fn(async()=>null),create:jest.fn(async({data}:any)=>({...data,referralAttributionId:'visit',version:1}))},referralAttributionHistory:{create:jest.fn()}};const db={$transaction:(fn:any)=>fn(tx)};
 const service=new ReferralAttributionService(db as any,links as any,{} as any,{} as any);expect(await service.land(short,'visitor',now)).toMatchObject({referralAttributionId:'visit',destination:'/shop?sku=TIP-363',accepted:true});expect(tx.referralLink.findUnique).toHaveBeenCalledWith({where:{tokenHash:'hash:'+legacy}});expect(links.verify).toHaveBeenCalledWith(legacy,now);
});
